#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  candidateCodeFor,
  decisionAuditFor,
  fingerprintForRestaurant,
  indexClassificationResults,
  parseManualOverrideFields,
  planRestaurantChange,
  snapshotForRestaurant,
  snapshotsEqual,
} = require("../lib/domain/cuisine-apply.cjs");
const {
  normalizeCandidateName,
} = require("../lib/domain/cuisine-candidate-review.cjs");

const ROOT = path.resolve(__dirname, "..");

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function usage() {
  return `Usage: node scripts/apply-cuisine-classification.cjs [options]

The default is a read-only dry-run. SQLite writes require --apply.

Options:
  --ai-results <path>          Phase 4 result JSONL
  --web-results <path>         Phase 5 result JSONL (wins over AI for the same restaurant)
  --deterministic-report <path> Phase 3 deterministic report JSON
  --review <path>              Candidate review artifact with approve/merge/reject decisions
  --cuisine-types <path>       Optional active CuisineType export for offline dry-run validation
  --batch-id <id>              Stable batch id; required with --apply, supported by --rollback
  --restaurant-id <id[,id]>    Narrow to one or more restaurant ids (repeatable)
  --limit <number>             Maximum number of ready plans
  --apply                      Apply the selected batch in one transaction
  --rollback                   Roll back --batch-id; also requires --apply to write
  --database <url>             DATABASE_URL override (default: file:./dev.db)
  --output <path>              Persist the complete result JSON
  --help                       Show this help
`;
}

function parseArgs(argv) {
  const options = {
    aiResults: null,
    webResults: null,
    deterministicReport: null,
    review: null,
    cuisineTypes: null,
    batchId: null,
    restaurantIds: [],
    limit: null,
    apply: false,
    rollback: false,
    database: null,
    output: null,
    help: false,
  };
  const valueOptions = new Map([
    ["--ai-results", "aiResults"],
    ["--web-results", "webResults"],
    ["--deterministic-report", "deterministicReport"],
    ["--review", "review"],
    ["--cuisine-types", "cuisineTypes"],
    ["--batch-id", "batchId"],
    ["--restaurant-id", "restaurantIds"],
    ["--limit", "limit"],
    ["--database", "database"],
    ["--output", "output"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--rollback") options.rollback = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else {
      const [name, inlineValue] = argument.split("=", 2);
      const key = valueOptions.get(name);
      if (!key) throw new Error(`Unknown option: ${argument}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      if (key === "restaurantIds") options.restaurantIds.push(...String(value).split(","));
      else options[key] = value;
    }
  }
  for (const key of ["aiResults", "webResults", "deterministicReport", "review", "cuisineTypes", "output"]) {
    if (options[key]) options[key] = path.resolve(ROOT, String(options[key]));
  }
  options.restaurantIds = [...new Set(options.restaurantIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (options.limit !== null) {
    options.limit = Number(options.limit);
    if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error("--limit must be a positive integer");
  }
  if (options.rollback && !options.batchId) throw new Error("--rollback requires --batch-id");
  if (options.apply && !options.batchId) throw new Error("--apply requires an explicit --batch-id");
  if (!options.rollback && !options.aiResults && !options.webResults && !options.deterministicReport) {
    throw new Error("a classification input is required unless --rollback is used");
  }
  return options;
}

function readJsonOrJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.results)) return parsed.results;
    if (Array.isArray(parsed.records)) return parsed.records;
    return [parsed];
  } catch {
    return text.split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at ${filePath}:${index + 1}: ${error instanceof Error ? error.message : error}`, { cause: error });
      }
    });
  }
}

function readReview(filePath) {
  if (!filePath) return null;
  const review = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (review?.readOnly !== true || !Array.isArray(review?.candidates)) throw new Error("review must be a read-only candidate artifact");
  return review;
}

function readCuisineTypes(filePath) {
  if (!filePath) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const types = Array.isArray(parsed) ? parsed : parsed?.cuisineTypes;
  if (!Array.isArray(types)) throw new Error("CuisineType export must contain an array or cuisineTypes array");
  return types;
}

function readRowsQuery(prisma, restaurantIds) {
  return prisma.restaurant.findMany({
    where: restaurantIds.length > 0 ? { id: { in: restaurantIds } } : undefined,
    include: {
      tags: {
        include: { tag: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });
}

function decisionHasCandidate(records) {
  return records.some((record) => {
    const payload = record?.result ?? record;
    return payload?.proposedNewCuisineType != null;
  });
}

function planSummary(plans) {
  const summary = {};
  for (const plan of plans) summary[plan.status] = (summary[plan.status] ?? 0) + 1;
  return summary;
}

function plannedCuisineFor(plan) {
  if (plan.candidateDecision?.status !== "create-candidate") return plan.after.cuisineTypeId;
  return {
    status: "approved-candidate-created-only-on-apply",
    name: plan.candidateDecision.candidate.approvedName || plan.candidateDecision.candidate.name,
    normalizedName: plan.candidateDecision.candidate.normalizedName,
    code: candidateCodeFor(plan.candidateDecision.candidate.normalizedName),
  };
}

async function loadActiveCuisineTypes(prisma, offlineTypes) {
  if (offlineTypes) return offlineTypes;
  return prisma.cuisineType.findMany({ where: { status: "active" }, orderBy: { id: "asc" } });
}

async function buildPlans({ prisma, classificationRecords, review, activeCuisineTypes, restaurantIds, limit }) {
  const classifications = indexClassificationResults({
    deterministicRecords: classificationRecords.deterministic,
    aiRecords: classificationRecords.ai,
    webRecords: classificationRecords.web,
    activeCuisineTypes,
  });
  const selectedClassifications = [...classifications.values()]
    .filter((classification) => restaurantIds.length === 0 || restaurantIds.includes(classification.restaurantId))
    .sort((left, right) => left.restaurantId - right.restaurantId);
  const rows = await readRowsQuery(prisma, selectedClassifications.map((classification) => classification.restaurantId));
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const plans = [];
  for (const classification of selectedClassifications) {
    const restaurant = rowsById.get(classification.restaurantId);
    if (!restaurant) {
      plans.push({ status: "restaurant-not-found", restaurantId: classification.restaurantId, reason: "restaurant does not exist" });
      continue;
    }
    plans.push(planRestaurantChange({ restaurant, classification, review, activeCuisineTypes }));
  }
  const ready = plans.filter((plan) => plan.status === "ready");
  const limitedReady = limit === null ? ready : ready.slice(0, limit);
  const readyIds = new Set(limitedReady.map((plan) => plan.restaurantId));
  return {
    plans: plans.map((plan) => plan.status === "ready" && !readyIds.has(plan.restaurantId)
      ? { ...plan, status: "limit-skipped", reason: "outside --limit" }
      : plan),
    classifications,
  };
}

async function loadRestaurant(tx, restaurantId) {
  return tx.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      tags: {
        include: { tag: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

async function ensureApprovedCuisineType(tx, candidate) {
  const normalizedName = cleanText(candidate.normalizedName || normalizeCandidateName(candidate.approvedName || candidate.name));
  const name = cleanText(candidate.approvedName || candidate.name);
  if (!normalizedName || !name) throw new Error("approved candidate requires name and normalizedName");
  const existing = await tx.cuisineType.findUnique({ where: { normalizedName } });
  if (existing) {
    if (existing.status === "active") return existing;
    if (existing.status === "candidate") {
      return tx.cuisineType.update({ where: { id: existing.id }, data: { name, status: "active", createdBy: "manual" } });
    }
    throw new Error(`approved candidate conflicts with disabled CuisineType ${existing.id}`);
  }
  return tx.cuisineType.create({
    data: {
      code: candidateCodeFor(normalizedName),
      name,
      normalizedName,
      status: "active",
      createdBy: "manual",
    },
  });
}

function relationForName(restaurant, name) {
  const key = normalizeCandidateName(name);
  return restaurant.tags.find((relation) => normalizeCandidateName(relation.tag?.normalizedName ?? relation.tag?.name) === key) ?? null;
}

async function applyTagOperations(tx, restaurant, plan) {
  for (const tagName of plan.removedTags) {
    const relation = relationForName(restaurant, tagName);
    if (!relation || relation.owner === "manual") continue;
    await tx.restaurantTag.update({
      where: { restaurantId_tagId: { restaurantId: restaurant.id, tagId: relation.tagId } },
      data: {
        owner: "ai",
        sourceName: relation.sourceName || relation.tag.name,
        kind: "legacy_cuisine",
        isPublic: false,
        visibilityReason: "canonical-cuisine-duplicate",
      },
    });
  }
  for (const tagName of plan.addedTags) {
    let tag = await tx.tag.findUnique({ where: { normalizedName: normalizeCandidateName(tagName) } });
    if (!tag) {
      tag = await tx.tag.create({ data: { name: tagName, normalizedName: normalizeCandidateName(tagName) } });
    }
    const relation = restaurant.tags.find((candidate) => candidate.tagId === tag.id);
    if (relation) {
      if (relation.owner === "manual") continue;
      await tx.restaurantTag.update({
        where: { restaurantId_tagId: { restaurantId: restaurant.id, tagId: tag.id } },
        data: { owner: "ai", kind: "auxiliary", isPublic: true, visibilityReason: null },
      });
    } else {
      await tx.restaurantTag.create({
        data: {
          restaurantId: restaurant.id,
          tagId: tag.id,
          position: restaurant.tags.reduce((max, current) => Math.max(max, current.position), -1) + 1,
          owner: "ai",
          sourceName: null,
          kind: "auxiliary",
          isPublic: true,
          visibilityReason: null,
        },
      });
    }
  }
}

async function applyPlans({ prisma, plans, batchId, source = "cuisine-classification" }) {
  const actionable = plans.filter((plan) => plan.status === "ready");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cuisineApplyBatch.findUnique({ where: { id: batchId } });
    if (existing?.status === "applied" || existing?.status === "rolled_back") {
      return { batchId, status: "idempotent", applied: 0, protected: 0, skipped: 0 };
    }
    if (existing) throw new Error(`batch ${batchId} already exists with status ${existing.status}`);
    await tx.cuisineApplyBatch.create({ data: { id: batchId, status: "applying", source, createdBy: "manual" } });
    let applied = 0;
    let protectedCount = 0;
    for (const plan of actionable) {
      const restaurant = await loadRestaurant(tx, plan.restaurantId);
      if (!restaurant) throw new Error(`restaurant ${plan.restaurantId} disappeared during apply`);
      const current = snapshotForRestaurant(restaurant);
      if (!snapshotsEqual(current, plan.before)) throw new Error(`restaurant ${plan.restaurantId} changed after fingerprint validation`);
      const currentFingerprint = fingerprintForRestaurant(restaurant, plan.classification.savedSourceCuisineTypes);
      if (currentFingerprint !== plan.inputFingerprint) throw new Error(`restaurant ${plan.restaurantId} changed after fingerprint validation`);
      let targetCuisineType = null;
      if (plan.requiresCuisineCreation) targetCuisineType = await ensureApprovedCuisineType(tx, plan.candidateDecision.candidate);
      else if (plan.after.cuisineTypeId != null) targetCuisineType = await tx.cuisineType.findUnique({ where: { id: plan.after.cuisineTypeId } });
      const shouldUpdateCuisine = plan.requiresCuisineCreation
        || plan.after.cuisineTypeId !== plan.before.cuisineTypeId;
      if (shouldUpdateCuisine && !targetCuisineType) {
        throw new Error(`active CuisineType target for restaurant ${restaurant.id} was not found during apply`);
      }
      if (shouldUpdateCuisine) {
        await tx.restaurant.update({ where: { id: restaurant.id }, data: { cuisineTypeId: targetCuisineType.id } });
      }
      await applyTagOperations(tx, restaurant, plan);
      const afterRestaurant = await loadRestaurant(tx, restaurant.id);
      const after = snapshotForRestaurant(afterRestaurant);
      const protectedFieldsJson = plan.protectedFields.length > 0 ? JSON.stringify(plan.protectedFields) : null;
      await tx.cuisineApplyChange.create({
        data: {
          batchId,
          restaurantId: restaurant.id,
          inputFingerprint: plan.inputFingerprint,
          beforeJson: JSON.stringify(plan.before),
          afterJson: JSON.stringify(after),
          decisionJson: JSON.stringify(decisionAuditFor(plan)),
          actionStatus: snapshotsEqual(plan.before, after) ? "protected" : "applied",
          protectedFieldsJson,
        },
      });
      if (snapshotsEqual(plan.before, after)) protectedCount += 1;
      else applied += 1;
    }
    await tx.cuisineApplyBatch.update({ where: { id: batchId }, data: { status: "applied" } });
    return { batchId, status: "applied", applied, protected: protectedCount, skipped: plans.length - actionable.length };
  }, { maxWait: 30_000, timeout: 180_000 });
}

function tagMap(tags) {
  return new Map((tags ?? []).map((tag) => [tag.tagId, tag]));
}

async function restoreTags(tx, restaurantId, before, current) {
  const beforeByTagId = tagMap(before.tags);
  const currentByTagId = tagMap(current.tags);
  for (const currentTag of current.tags) {
    if (beforeByTagId.has(currentTag.tagId)) continue;
    if (currentTag.owner === "manual") continue;
    await tx.restaurantTag.delete({ where: { restaurantId_tagId: { restaurantId, tagId: currentTag.tagId } } });
  }
  for (const beforeTag of before.tags) {
    const existing = currentByTagId.get(beforeTag.tagId);
    if (existing?.owner === "manual") continue;
    if (existing) {
      await tx.restaurantTag.update({
        where: { restaurantId_tagId: { restaurantId, tagId: beforeTag.tagId } },
        data: {
          position: beforeTag.position,
          owner: beforeTag.owner,
          sourceName: beforeTag.sourceName,
          kind: beforeTag.kind || "auxiliary",
          isPublic: beforeTag.isPublic,
          visibilityReason: beforeTag.visibilityReason ?? null,
        },
      });
    } else {
      await tx.restaurantTag.create({
        data: {
          restaurantId,
          tagId: beforeTag.tagId,
          position: beforeTag.position,
          owner: beforeTag.owner,
          sourceName: beforeTag.sourceName,
          kind: beforeTag.kind || "auxiliary",
          isPublic: beforeTag.isPublic,
          visibilityReason: beforeTag.visibilityReason ?? null,
        },
      });
    }
  }
}

async function rollbackBatch({ prisma, batchId, restaurantIds = [], limit = null }) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.cuisineApplyBatch.findUnique({
      where: { id: batchId },
      include: { changes: { orderBy: { id: "asc" } } },
    });
    if (!batch) throw new Error(`batch ${batchId} was not found`);
    if (batch.status === "rolled_back") return { batchId, status: "idempotent", rolledBack: 0, protected: 0 };
    const pendingChanges = batch.changes.filter((change) => change.actionStatus !== "rolled_back");
    const changes = pendingChanges
      .filter((change) => restaurantIds.length === 0 || restaurantIds.includes(change.restaurantId))
      .slice(0, limit ?? pendingChanges.length);
    const fullBatchSelected = restaurantIds.length === 0 && limit === null && changes.length === pendingChanges.length;
    let rolledBack = 0;
    let protectedCount = 0;
    for (const change of changes) {
      const restaurant = await loadRestaurant(tx, change.restaurantId);
      if (!restaurant) throw new Error(`restaurant ${change.restaurantId} is missing; rollback stopped`);
      const before = JSON.parse(change.beforeJson);
      const after = JSON.parse(change.afterJson);
      const current = snapshotForRestaurant(restaurant);
      const fields = parseManualOverrideFields(restaurant.manualOverrideFields);
      const batchChangedCuisine = before.cuisineTypeId !== after.cuisineTypeId;
      const batchChangedTags = !snapshotsEqual(before.tags, after.tags);
      const currentDiffersFromAfterCuisine = current.cuisineTypeId !== after.cuisineTypeId;
      const currentDiffersFromAfterTags = !snapshotsEqual(current.tags, after.tags);
      const protectCuisine = batchChangedCuisine && (
        [...fields].some((field) => ["cuisine", "cuisineType", "cuisineTypeId", "foodType"].includes(field))
        || currentDiffersFromAfterCuisine && [...fields].some((field) => ["cuisine", "cuisineType", "cuisineTypeId", "foodType"].includes(field))
      );
      const protectTags = batchChangedTags && (
        [...fields].some((field) => ["tag", "tags", "restaurantTag", "restaurantTags"].includes(field))
        || currentDiffersFromAfterTags && current.tags.some((tag) => tag.owner === "manual")
      );
      if ((currentDiffersFromAfterCuisine && !protectCuisine) || (currentDiffersFromAfterTags && !protectTags)) {
        throw new Error(`restaurant ${change.restaurantId} changed after batch ${batchId}; rollback stopped safely`);
      }
      if (!protectCuisine && batchChangedCuisine) {
        await tx.restaurant.update({ where: { id: restaurant.id }, data: { cuisineTypeId: before.cuisineTypeId } });
      }
      if (!protectTags && batchChangedTags) {
        await restoreTags(tx, restaurant.id, before, current);
      }
      const protectedFields = [
        ...(protectCuisine ? ["cuisineTypeId"] : []),
        ...(protectTags ? ["tags"] : []),
      ];
      await tx.cuisineApplyChange.update({
        where: { id: change.id },
        data: {
          actionStatus: protectedFields.length > 0 ? "rolled_back_with_protection" : "rolled_back",
          protectedFieldsJson: protectedFields.length > 0 ? JSON.stringify(protectedFields) : change.protectedFieldsJson,
        },
      });
      if (protectedFields.length > 0) protectedCount += 1;
      else rolledBack += 1;
    }
    await tx.cuisineApplyBatch.update({
      where: { id: batchId },
      data: {
        status: fullBatchSelected ? "rolled_back" : "partially_rolled_back",
        rolledBackAt: fullBatchSelected ? new Date() : null,
      },
    });
    return {
      batchId,
      status: fullBatchSelected ? "rolled_back" : "partially_rolled_back",
      rolledBack,
      protected: protectedCount,
    };
  }, { maxWait: 30_000, timeout: 180_000 });
}

async function previewRollback({ prisma, batchId, restaurantIds = [], limit = null }) {
  const batch = await prisma.cuisineApplyBatch.findUnique({
    where: { id: batchId },
    include: { changes: { orderBy: { id: "asc" } } },
  });
  if (!batch) throw new Error(`batch ${batchId} was not found`);
  const changes = batch.changes
    .filter((change) => restaurantIds.length === 0 || restaurantIds.includes(change.restaurantId))
    .slice(0, limit ?? batch.changes.length);
  return {
    batchId,
    status: "dry-run-rollback",
    batchStatus: batch.status,
    changes: changes.map((change) => ({
      changeId: change.id,
      restaurantId: change.restaurantId,
      actionStatus: change.actionStatus,
      before: JSON.parse(change.beforeJson),
      after: JSON.parse(change.afterJson),
      protectedFields: change.protectedFieldsJson ? JSON.parse(change.protectedFieldsJson) : [],
    })),
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  if (options.database) process.env.DATABASE_URL = String(options.database);
  process.env.DATABASE_URL ||= "file:./dev.db";
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    if (options.rollback) {
      const result = options.apply
        ? await rollbackBatch({ prisma, batchId: options.batchId, restaurantIds: options.restaurantIds, limit: options.limit })
        : await previewRollback({ prisma, batchId: options.batchId, restaurantIds: options.restaurantIds, limit: options.limit });
      const output = { mode: options.apply ? "apply" : "dry-run", readOnly: !options.apply, writesDatabase: options.apply, ...result };
      if (options.output) { fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`); }
      process.stdout.write(`${JSON.stringify(options.output ? { ...output, changes: output.changes?.length, output: options.output } : output, null, 2)}\n`);
      return result;
    }
    const offlineCuisineTypes = readCuisineTypes(options.cuisineTypes);
    const activeCuisineTypes = await loadActiveCuisineTypes(prisma, offlineCuisineTypes);
    const classificationRecords = {
      deterministic: options.deterministicReport ? readJsonOrJsonl(options.deterministicReport) : [],
      ai: options.aiResults ? readJsonOrJsonl(options.aiResults) : [],
      web: options.webResults ? readJsonOrJsonl(options.webResults) : [],
    };
    const allRecords = [...classificationRecords.deterministic, ...classificationRecords.ai, ...classificationRecords.web];
    const review = readReview(options.review);
    if (decisionHasCandidate(allRecords) && !review) throw new Error("candidate results require --review; pending candidates are never applied implicitly");
    const planned = await buildPlans({
      prisma,
      classificationRecords,
      review,
      activeCuisineTypes,
      restaurantIds: options.restaurantIds,
      limit: options.limit,
    });
    if (!options.apply) {
      const output = {
        mode: "dry-run",
        readOnly: true,
        writesDatabase: false,
        applyVersion: "cuisine-apply-v1",
        batchId: options.batchId || null,
        summary: planSummary(planned.plans),
        plans: planned.plans.map((plan) => ({
          restaurantId: plan.restaurantId,
          status: plan.status,
          reason: plan.reason,
          currentFingerprint: plan.currentFingerprint ?? null,
          expectedFingerprint: plan.expectedFingerprint ?? plan.inputFingerprint ?? null,
          before: plan.before ?? null,
          after: plan.after ?? null,
          plannedCuisineType: plan.status === "ready" ? plannedCuisineFor(plan) : null,
          removedTags: plan.removedTags ?? [],
          addedTags: plan.addedTags ?? [],
          protectedFields: plan.protectedFields ?? [],
        })),
      };
      if (options.output) { fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`); }
      process.stdout.write(`${JSON.stringify(options.output ? { ...output, plans: output.plans.length, output: options.output } : output, null, 2)}\n`);
      return output;
    }
    const result = await applyPlans({ prisma, plans: planned.plans, batchId: options.batchId });
    const output = { mode: "apply", readOnly: false, writesDatabase: true, ...result };
    if (options.output) { fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`); }
    process.stdout.write(`${JSON.stringify({ ...output, output: options.output }, null, 2)}\n`);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  applyPlans,
  buildPlans,
  main,
  parseArgs,
  readJsonOrJsonl,
  previewRollback,
  restoreTags,
  rollbackBatch,
  usage,
};
