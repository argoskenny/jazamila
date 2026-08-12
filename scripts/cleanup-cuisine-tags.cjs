#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const {
  fingerprintForRestaurant,
  parseManualOverrideFields,
  snapshotForRestaurant,
  snapshotsEqual,
} = require("../lib/domain/cuisine-apply.cjs");
const { normalizeCandidateName } = require("../lib/domain/cuisine-candidate-review.cjs");
const { previewRollback, rollbackBatch } = require("./apply-cuisine-classification.cjs");

const TAG_LOCK_FIELDS = new Set(["tag", "tags", "restaurantTag", "restaurantTags"]);
const CLEANUP_SOURCE = "cuisine-tag-cleanup";
const CLEANUP_VERSION = "cuisine-tag-cleanup-v1";

function usage() {
  return `Usage: node scripts/cleanup-cuisine-tags.cjs --database <file:path> [options]

The default is a read-only dry-run. SQLite writes require --apply.

Options:
  --database <url>   Explicit SQLite DATABASE_URL; required
  --batch-id <id>    Stable batch id; required with --apply or --rollback
  --apply            Apply the cleanup in one transaction
  --rollback         Preview or roll back an existing cleanup batch
  --help             Show this help
`;
}

function parseArgs(argv) {
  const options = { database: null, batchId: null, apply: false, rollback: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--rollback") options.rollback = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--database" || argument.startsWith("--database=")) {
      options.database = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    } else if (argument === "--batch-id" || argument.startsWith("--batch-id=")) {
      options.batchId = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (options.help) return options;
  if (!options.database) throw new Error("--database is required; cleanup never defaults to prisma/dev.db");
  if (!String(options.database).startsWith("file:")) throw new Error("cleanup only supports an explicit file: SQLite URL");
  if (String(options.database).includes("prisma/dev.db") || String(options.database).endsWith("/dev.db")) {
    throw new Error("prisma/dev.db is not an allowed cleanup target");
  }
  if ((options.apply || options.rollback) && !options.batchId) throw new Error("--batch-id is required with --apply or --rollback");
  return options;
}

function tagIsCuisineType(relation, cuisineType) {
  const tagName = relation.tag?.normalizedName ?? relation.tag?.name ?? relation.sourceName;
  const cuisineName = cuisineType.normalizedName ?? cuisineType.name;
  return normalizeCandidateName(tagName) === normalizeCandidateName(cuisineName);
}

function tagFieldsLocked(fields) {
  return [...fields].some((field) => TAG_LOCK_FIELDS.has(field));
}

function sqlitePathFromUrl(databaseUrl) {
  return path.resolve(decodeURIComponent(String(databaseUrl).slice("file:".length)));
}

function assertExistingSqlite(databaseUrl) {
  const sqlitePath = sqlitePathFromUrl(databaseUrl);
  if (!fs.existsSync(sqlitePath)) throw new Error(`cleanup target SQLite file is missing; refusing to create it: ${databaseUrl}`);
  return sqlitePath;
}

function loadRows(prisma) {
  return prisma.restaurant.findMany({
    orderBy: { id: "asc" },
    include: {
      cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
      tags: {
        orderBy: { position: "asc" },
        include: { tag: { select: { id: true, name: true, normalizedName: true } } },
      },
    },
  });
}

function buildCleanupPlans(rows) {
  const plans = [];
  const audit = {
    restaurantCount: rows.length,
    unclassifiedCount: 0,
    unclassifiedRestaurantIds: [],
    nonActiveCuisineCount: 0,
    nonActiveCuisineRestaurantIds: [],
    matchingPublicCuisineTagCount: 0,
    readyRestaurantCount: 0,
    protectedRestaurantCount: 0,
    unknownOwnerCount: 0,
    tagOwnership: { source: 0, ai: 0, manual: 0, unknown: 0 },
    publicTagCount: 0,
    hiddenTagCount: 0,
  };

  for (const restaurant of rows) {
    for (const relation of restaurant.tags) {
      const owner = ["source", "ai", "manual"].includes(relation.owner) ? relation.owner : "unknown";
      audit.tagOwnership[owner] += 1;
      if (relation.isPublic) audit.publicTagCount += 1;
      else audit.hiddenTagCount += 1;
    }
    if (restaurant.cuisineTypeId == null || !restaurant.cuisineType) {
      audit.unclassifiedCount += 1;
      audit.unclassifiedRestaurantIds.push(restaurant.id);
      continue;
    }
    if (restaurant.cuisineType.status !== "active") {
      audit.nonActiveCuisineCount += 1;
      audit.nonActiveCuisineRestaurantIds.push(restaurant.id);
      continue;
    }
    const matches = restaurant.tags.filter((relation) => relation.isPublic && tagIsCuisineType(relation, restaurant.cuisineType));
    if (matches.length === 0) continue;
    audit.matchingPublicCuisineTagCount += matches.length;
    const manualFields = parseManualOverrideFields(restaurant.manualOverrideFields);
    const protectedMatches = matches.filter((relation) => relation.owner === "manual" || tagFieldsLocked(manualFields));
    const unknownMatches = matches.filter((relation) => !["source", "ai", "manual"].includes(relation.owner));
    const protectedFields = [];
    if (protectedMatches.length > 0) protectedFields.push("tags");
    if (unknownMatches.length > 0) {
      protectedFields.push(...unknownMatches.map((relation) => `unknown-owner:${relation.tagId}`));
      audit.unknownOwnerCount += unknownMatches.length;
    }
    const protectedIds = new Set([...protectedMatches, ...unknownMatches].map((relation) => relation.tagId));
    const before = snapshotForRestaurant(restaurant);
    const after = {
      ...before,
      tags: before.tags.map((tag) => matches.some((relation) => relation.tagId === tag.tagId) && !protectedIds.has(tag.tagId)
        ? { ...tag, isPublic: false }
        : tag),
    };
    const changed = !snapshotsEqual(before, after);
    const plan = {
      status: changed ? "ready" : "protected",
      restaurantId: restaurant.id,
      cuisineTypeId: restaurant.cuisineTypeId,
      cuisineTypeCode: restaurant.cuisineType.code,
      cuisineTypeName: restaurant.cuisineType.name,
      matchingTagIds: matches.map((relation) => relation.tagId),
      protectedFields: [...new Set(protectedFields)],
      inputFingerprint: fingerprintForRestaurant(restaurant),
      before,
      after,
      reason: changed ? "hide public cuisine-name auxiliary tags" : "manual-or-unknown ownership protected",
    };
    plans.push(plan);
    if (changed) audit.readyRestaurantCount += 1;
    else audit.protectedRestaurantCount += 1;
  }

  return { plans, audit };
}

function planOutput(plan) {
  return {
    restaurantId: plan.restaurantId,
    status: plan.status,
    cuisineTypeId: plan.cuisineTypeId,
    cuisineTypeCode: plan.cuisineTypeCode,
    matchingTagIds: plan.matchingTagIds,
    protectedFields: plan.protectedFields,
    currentFingerprint: plan.inputFingerprint,
    expectedFingerprint: plan.inputFingerprint,
    before: plan.before,
    after: plan.after,
    reason: plan.reason,
  };
}

async function applyCleanupPlans({ prisma, plans, batchId }) {
  const selected = plans.filter((plan) => plan.status === "ready" || plan.status === "protected");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cuisineApplyBatch.findUnique({ where: { id: batchId } });
    if (existing?.status === "applied" || existing?.status === "rolled_back") {
      return { batchId, status: "idempotent", applied: 0, protected: 0, skipped: 0 };
    }
    if (existing) throw new Error(`batch ${batchId} already exists with status ${existing.status}`);
    await tx.cuisineApplyBatch.create({ data: { id: batchId, status: "applying", source: CLEANUP_SOURCE, createdBy: "automatic-post-apply" } });
    let applied = 0;
    let protectedCount = 0;
    for (const plan of selected) {
      const restaurant = await tx.restaurant.findUnique({
        where: { id: plan.restaurantId },
        include: {
          cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
          tags: { orderBy: { position: "asc" }, include: { tag: { select: { id: true, name: true, normalizedName: true } } } },
        },
      });
      if (!restaurant) throw new Error(`restaurant ${plan.restaurantId} disappeared during cleanup`);
      const current = snapshotForRestaurant(restaurant);
      if (!snapshotsEqual(current, plan.before)) throw new Error(`restaurant ${plan.restaurantId} changed after cleanup dry-run`);
      if (fingerprintForRestaurant(restaurant) !== plan.inputFingerprint) throw new Error(`restaurant ${plan.restaurantId} fingerprint changed after cleanup dry-run`);
      for (const tag of plan.after.tags) {
        const beforeTag = plan.before.tags.find((candidate) => candidate.tagId === tag.tagId);
        if (beforeTag && beforeTag.isPublic !== tag.isPublic) {
          await tx.restaurantTag.update({
            where: { restaurantId_tagId: { restaurantId: restaurant.id, tagId: tag.tagId } },
            data: { isPublic: tag.isPublic },
          });
        }
      }
      const afterRestaurant = await tx.restaurant.findUnique({
        where: { id: restaurant.id },
        include: {
          tags: { orderBy: { position: "asc" }, include: { tag: { select: { id: true, name: true, normalizedName: true } } } },
        },
      });
      if (!afterRestaurant) throw new Error(`restaurant ${plan.restaurantId} disappeared after cleanup update`);
      const after = snapshotForRestaurant(afterRestaurant);
      await tx.cuisineApplyChange.create({
        data: {
          batchId,
          restaurantId: restaurant.id,
          inputFingerprint: plan.inputFingerprint,
          beforeJson: JSON.stringify(plan.before),
          afterJson: JSON.stringify(after),
          decisionJson: JSON.stringify({
            cleanupVersion: CLEANUP_VERSION,
            source: CLEANUP_SOURCE,
            cuisineTypeId: plan.cuisineTypeId,
            cuisineTypeCode: plan.cuisineTypeCode,
            matchingTagIds: plan.matchingTagIds,
            protectedFields: plan.protectedFields,
          }),
          actionStatus: snapshotsEqual(plan.before, after) ? "protected" : "applied",
          protectedFieldsJson: plan.protectedFields.length > 0 ? JSON.stringify(plan.protectedFields) : null,
        },
      });
      if (snapshotsEqual(plan.before, after)) protectedCount += 1;
      else applied += 1;
    }
    await tx.cuisineApplyBatch.update({ where: { id: batchId }, data: { status: "applied" } });
    return { batchId, status: "applied", applied, protected: protectedCount, skipped: plans.length - selected.length };
  }, { maxWait: 30_000, timeout: 180_000 });
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  assertExistingSqlite(options.database);
  process.env.DATABASE_URL = String(options.database);
  const prisma = new PrismaClient();
  try {
    if (options.rollback) {
      const result = options.apply
        ? await rollbackBatch({ prisma, batchId: options.batchId })
        : await previewRollback({ prisma, batchId: options.batchId });
      process.stdout.write(`${JSON.stringify({ mode: options.apply ? "apply" : "dry-run", readOnly: !options.apply, writesDatabase: options.apply, ...result }, null, 2)}\n`);
      return result;
    }
    const { plans, audit } = buildCleanupPlans(await loadRows(prisma));
    if (!options.apply) {
      const result = {
        mode: "dry-run",
        readOnly: true,
        writesDatabase: false,
        cleanupVersion: CLEANUP_VERSION,
        batchId: options.batchId || null,
        audit,
        summary: plans.reduce((counts, plan) => ({ ...counts, [plan.status]: (counts[plan.status] ?? 0) + 1 }), {}),
        plans: plans.map(planOutput),
      };
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result;
    }
    if (!options.batchId) throw new Error("--apply requires an explicit --batch-id");
    const result = await applyCleanupPlans({ prisma, plans, batchId: options.batchId });
    process.stdout.write(`${JSON.stringify({ mode: "apply", readOnly: false, writesDatabase: true, cleanupVersion: CLEANUP_VERSION, audit, ...result }, null, 2)}\n`);
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
  CLEANUP_SOURCE,
  CLEANUP_VERSION,
  applyCleanupPlans,
  buildCleanupPlans,
  main,
  parseArgs,
  planOutput,
  tagFieldsLocked,
  usage,
};
