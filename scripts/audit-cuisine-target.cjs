#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { parseManualOverrideFields, snapshotForRestaurant, snapshotsEqual } = require("../lib/domain/cuisine-apply.cjs");

const EXPECTED_RESTAURANTS = 31_293;
const EXPECTED_ACTIVE_CUISINE_TYPES = 24;
const EXPECTED_BATCH_ID = "jazamila-cuisine-auto-20260812-001";
const EXPECTED_APPLY_CHANGES = 9_309;
const EXPECTED_BACKUP_DATABASE = "file:/private/tmp/jazamila-cuisine-staging.sqlite.before-auto-apply-20260812.bak";
const EXPECTED_CANDIDATES = [
  { normalizedName: "西班牙料理", count: 2 },
  { normalizedName: "客家料理", count: 1 },
];

function usage() {
  return `Usage: node scripts/audit-cuisine-target.cjs --database <file:path> [options]

Read-only post-apply audit. The database is never written.

Options:
  --database <url>   Explicit SQLite DATABASE_URL; required
  --before-database <url>
                     Read-only pre-apply backup used for protected/source trace comparison
  --batch-id <id>    Apply batch to reconcile; default ${EXPECTED_BATCH_ID}
  --expected-changes <count>
                     Expected change rows; default ${EXPECTED_APPLY_CHANGES}
  --candidate <name=count>
                     Expected candidate normalizedName and restaurant count; repeatable
  --output <path>    Write the read-only audit JSON
  --help             Show this help
`;
}

function parseNonNegativeInteger(value, label) {
  if (!/^\d+$/u.test(String(value))) throw new Error(`${label} must be a non-negative integer`);
  return Number(value);
}

function parseCandidateSpec(value) {
  const [normalizedName, count, ...extra] = String(value).split("=");
  const trimmedName = normalizedName.trim();
  if (!trimmedName || extra.length > 0 || count === undefined) {
    throw new Error(`--candidate must use <normalizedName>=<count>: ${value}`);
  }
  return { normalizedName: trimmedName, count: parseNonNegativeInteger(count, `candidate ${trimmedName} count`) };
}

function parseArgs(argv) {
  const options = {
    database: null,
    beforeDatabase: EXPECTED_BACKUP_DATABASE,
    batchId: EXPECTED_BATCH_ID,
    expectedChanges: EXPECTED_APPLY_CHANGES,
    candidates: EXPECTED_CANDIDATES.map((candidate) => ({ ...candidate })),
    output: null,
    help: false,
  };
  let candidatesProvided = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--database" || argument.startsWith("--database=")) options.database = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    else if (argument === "--before-database" || argument.startsWith("--before-database=")) options.beforeDatabase = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    else if (argument === "--batch-id" || argument.startsWith("--batch-id=")) options.batchId = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    else if (argument === "--expected-changes" || argument.startsWith("--expected-changes=")) {
      const value = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
      options.expectedChanges = parseNonNegativeInteger(value, "--expected-changes");
    } else if (argument === "--candidate" || argument.startsWith("--candidate=")) {
      const value = argument.includes("=") ? argument.slice(argument.indexOf("=") + 1) : argv[++index];
      if (!candidatesProvided) {
        options.candidates = [];
        candidatesProvided = true;
      }
      options.candidates.push(parseCandidateSpec(value));
    }
    else if (argument === "--output" || argument.startsWith("--output=")) options.output = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.help) return options;
  if (!options.database) throw new Error("--database is required");
  if (!String(options.database).startsWith("file:")) throw new Error("target audit only supports an explicit file: SQLite URL");
  if (String(options.database).includes("prisma/dev.db") || String(options.database).endsWith("/dev.db")) throw new Error("prisma/dev.db is not an allowed target");
  if (!String(options.beforeDatabase).startsWith("file:")) throw new Error("before-database must be an explicit file: SQLite URL");
  if (String(options.beforeDatabase).includes("prisma/dev.db") || String(options.beforeDatabase).endsWith("/dev.db")) throw new Error("prisma/dev.db is not an allowed baseline");
  return options;
}

function sqlitePathFromUrl(databaseUrl) {
  const rawPath = String(databaseUrl).slice("file:".length);
  if (!rawPath || rawPath.startsWith(":memory:")) return null;
  return path.resolve(decodeURIComponent(rawPath));
}

function assertExistingSqlite(databaseUrl, label) {
  const sqlitePath = sqlitePathFromUrl(databaseUrl);
  if (!sqlitePath || !fs.existsSync(sqlitePath)) {
    throw new Error(`${label} SQLite file is missing; refusing to create it: ${databaseUrl}`);
  }
  return sqlitePath;
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = String(row[key] ?? "null");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseJsonArray(value) {
  if (!nonEmpty(value)) return { present: false, valid: true };
  try {
    const parsed = JSON.parse(value);
    return { present: true, valid: Array.isArray(parsed) };
  } catch {
    return { present: true, valid: false };
  }
}

function candidateChecksFor({ cuisineTypes, restaurants, candidates }) {
  return candidates.map((candidate) => {
    const matches = cuisineTypes.filter((type) => type.normalizedName === candidate.normalizedName);
    const cuisineType = matches.length === 1 ? matches[0] : null;
    const count = cuisineType
      ? restaurants.filter((restaurant) => restaurant.cuisineTypeId === cuisineType.id).length
      : 0;
    return {
      normalizedName: candidate.normalizedName,
      expectedCount: candidate.count,
      matchingCuisineTypeCount: matches.length,
      cuisineTypeId: cuisineType?.id ?? null,
      actualCount: count,
      pass: matches.length === 1 && count === candidate.count,
    };
  });
}

async function compareProtectedTrace({ beforeDatabase, currentRows }) {
  const beforePrisma = new PrismaClient({ datasources: { db: { url: beforeDatabase } } });
  try {
    const beforeRows = await beforePrisma.restaurant.findMany({
      select: { id: true, manualOverrideFields: true, sourceFile: true, sourceId: true, sourceRefsJson: true },
    });
    const beforeById = new Map(beforeRows.map((row) => [row.id, row]));
    const changed = [];
    const missing = [];
    for (const current of currentRows) {
      const before = beforeById.get(current.id);
      if (!before) {
        missing.push(current.id);
        continue;
      }
      if (before.manualOverrideFields !== current.manualOverrideFields
        || before.sourceFile !== current.sourceFile
        || before.sourceId !== current.sourceId
        || before.sourceRefsJson !== current.sourceRefsJson) {
        changed.push(current.id);
      }
    }
    return {
      status: "compared",
      pass: beforeRows.length === currentRows.length && missing.length === 0 && changed.length === 0,
      beforeRows: beforeRows.length,
      currentRows: currentRows.length,
      missingRestaurantIds: missing,
      changedRestaurantIds: changed,
    };
  } finally {
    await beforePrisma.$disconnect();
  }
}

async function auditTarget({
  prisma,
  batchId,
  beforeDatabase,
  expectedChanges = EXPECTED_APPLY_CHANGES,
  candidates = EXPECTED_CANDIDATES,
}) {
  const errors = [];
  const integrityRows = await prisma.$queryRawUnsafe("PRAGMA integrity_check");
  const integrityCheck = integrityRows?.[0]?.integrity_check ?? integrityRows?.[0]?.integrityCheck ?? null;
  if (integrityCheck !== "ok") errors.push(`integrity_check=${integrityCheck}`);

  const [restaurants, cuisineTypes, tags, restaurantTags, sourceTraceRows, batches, foreignKeyRows, tableRows] = await Promise.all([
    prisma.restaurant.findMany({
      orderBy: { id: "asc" },
      include: {
        cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
        tags: { orderBy: { position: "asc" }, include: { tag: { select: { id: true, name: true, normalizedName: true } } } },
      },
    }),
    prisma.cuisineType.findMany({ orderBy: { id: "asc" } }),
    prisma.tag.findMany({ select: { id: true, name: true, normalizedName: true } }),
    prisma.restaurantTag.findMany({ select: { restaurantId: true, tagId: true } }),
    prisma.restaurant.findMany({ select: { id: true, sourceFile: true, sourceId: true, sourceRefsJson: true, manualOverrideFields: true } }),
    prisma.cuisineApplyBatch.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, status: true, source: true, rolledBackAt: true } }),
    prisma.$queryRawUnsafe("PRAGMA foreign_key_check"),
    prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table'"),
  ]);

  const activeCuisineTypes = cuisineTypes.filter((type) => type.status === "active");
  const normalizedCounts = countBy(cuisineTypes, "normalizedName");
  const duplicateNormalizedNames = Object.entries(normalizedCounts).filter(([, count]) => count > 1).map(([name, count]) => ({ name, count }));
  if (restaurants.length !== EXPECTED_RESTAURANTS) errors.push(`restaurantCount=${restaurants.length}`);
  if (activeCuisineTypes.length !== EXPECTED_ACTIVE_CUISINE_TYPES) errors.push(`activeCuisineTypeCount=${activeCuisineTypes.length}`);
  if (duplicateNormalizedNames.length > 0) errors.push("duplicate CuisineType normalizedName");

  const foreignKeyErrors = foreignKeyRows.length;
  if (foreignKeyErrors > 0) errors.push(`foreign_key_check=${foreignKeyErrors}`);
  const tableNames = new Set(tableRows.map((row) => row.name));
  const unexpectedCuisineRelationTables = [...tableNames].filter((name) => /cuisine.*restaurant|restaurant.*cuisine/u.test(name) && name !== "r_cuisine_type");
  if (unexpectedCuisineRelationTables.length > 0) errors.push(`unexpected many-to-many cuisine tables=${unexpectedCuisineRelationTables.join(",")}`);

  const invalidCuisineTypeIds = restaurants.filter((restaurant) => restaurant.cuisineTypeId != null && !restaurant.cuisineType).map((restaurant) => restaurant.id);
  if (invalidCuisineTypeIds.length > 0) errors.push(`invalid cuisineTypeId rows=${invalidCuisineTypeIds.length}`);
  const orphanRestaurantTags = restaurantTags.filter((relation) => !restaurants.some((restaurant) => restaurant.id === relation.restaurantId) || !tags.some((tag) => tag.id === relation.tagId));
  if (orphanRestaurantTags.length > 0) errors.push(`orphan RestaurantTag rows=${orphanRestaurantTags.length}`);
  const nestedRestaurantTagKeys = new Set(restaurants.flatMap((restaurant) => restaurant.tags.map((relation) => `${restaurant.id}:${relation.tagId}`)));
  const storedRestaurantTagKeys = new Set(restaurantTags.map((relation) => `${relation.restaurantId}:${relation.tagId}`));
  const missingNestedRestaurantTags = [...storedRestaurantTagKeys].filter((key) => !nestedRestaurantTagKeys.has(key));
  const extraNestedRestaurantTags = [...nestedRestaurantTagKeys].filter((key) => !storedRestaurantTagKeys.has(key));
  if (missingNestedRestaurantTags.length > 0 || extraNestedRestaurantTags.length > 0) errors.push("RestaurantTag nested relation mismatch");
  const allTagRelations = restaurants.flatMap((restaurant) => restaurant.tags);
  const tagOwnership = countBy(allTagRelations.map((relation) => ({ owner: ["source", "ai", "manual"].includes(relation.owner) ? relation.owner : "unknown" })), "owner");
  const tagVisibility = countBy(allTagRelations.map((relation) => ({ visibility: relation.isPublic ? "public" : "hidden" })), "visibility");

  const cuisineDistribution = {};
  for (const restaurant of restaurants) {
    const key = restaurant.cuisineType?.name ?? "未分類";
    cuisineDistribution[key] = (cuisineDistribution[key] ?? 0) + 1;
  }
  const candidateChecks = candidateChecksFor({ cuisineTypes, restaurants, candidates });
  for (const candidate of candidateChecks.filter((candidateCheck) => !candidateCheck.pass)) {
    errors.push(`${candidate.normalizedName} expected count=${candidate.expectedCount},matchingTypes=${candidate.matchingCuisineTypeCount},actualCount=${candidate.actualCount}`);
  }

  const manualLockCounts = {};
  let manualLockedRows = 0;
  for (const row of sourceTraceRows) {
    const fields = parseManualOverrideFields(row.manualOverrideFields);
    if (fields.size > 0) manualLockedRows += 1;
    for (const field of fields) manualLockCounts[field] = (manualLockCounts[field] ?? 0) + 1;
  }

  const invalidSourceRefsRows = sourceTraceRows.filter((row) => !parseJsonArray(row.sourceRefsJson).valid).map((row) => row.id);
  const invalidManualOverrideRows = sourceTraceRows.filter((row) => !parseJsonArray(row.manualOverrideFields).valid).map((row) => row.id);
  if (invalidSourceRefsRows.length > 0) errors.push(`invalid source_refs_json rows=${invalidSourceRefsRows.length}`);
  if (invalidManualOverrideRows.length > 0) errors.push(`invalid manualOverrideFields rows=${invalidManualOverrideRows.length}`);

  const protectedTrace = await compareProtectedTrace({ beforeDatabase, currentRows: sourceTraceRows });
  if (!protectedTrace.pass) errors.push("protected/source trace differs from pre-apply baseline");

  const batch = await prisma.cuisineApplyBatch.findUnique({
    where: { id: batchId },
    include: { changes: { orderBy: { id: "asc" } } },
  });
  if (!batch) errors.push(`apply batch ${batchId} missing`);
  const batchAudit = {
    id: batchId,
    found: Boolean(batch),
    status: batch?.status ?? null,
    source: batch?.source ?? null,
    createdBy: batch?.createdBy ?? null,
    createdAt: batch?.createdAt ?? null,
    updatedAt: batch?.updatedAt ?? null,
    rolledBackAt: batch?.rolledBackAt ?? null,
    changeCount: batch?.changes.length ?? 0,
    actionStatus: countBy(batch?.changes ?? [], "actionStatus"),
    validInputFingerprints: 0,
    parsedBeforeAfter: 0,
    validDecisionRecords: 0,
    currentSnapshotsMatchAfter: 0,
    beforeAfterErrors: [],
  };
  if (batch) {
    const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
    for (const change of batch.changes) {
      if (/^[a-f0-9]{64}$/u.test(change.inputFingerprint)) batchAudit.validInputFingerprints += 1;
      try {
        const before = JSON.parse(change.beforeJson);
        const after = JSON.parse(change.afterJson);
        JSON.parse(change.decisionJson);
        batchAudit.parsedBeforeAfter += 1;
        batchAudit.validDecisionRecords += 1;
        const current = restaurantById.get(change.restaurantId);
        if (!current || !snapshotsEqual(snapshotForRestaurant(current), after)) batchAudit.beforeAfterErrors.push(change.restaurantId);
        else batchAudit.currentSnapshotsMatchAfter += 1;
        if (before.cuisineTypeId === undefined || after.cuisineTypeId === undefined) batchAudit.beforeAfterErrors.push(change.restaurantId);
      } catch {
        batchAudit.beforeAfterErrors.push(change.restaurantId);
      }
    }
  }
  if (batchAudit.status !== "applied") errors.push(`applyBatch.status=${batchAudit.status}`);
  if (batchAudit.changeCount !== expectedChanges) errors.push(`applyBatch.changeCount=${batchAudit.changeCount},expected=${expectedChanges}`);
  if (batchAudit.validInputFingerprints !== batchAudit.changeCount) errors.push("applyBatch inputFingerprint count mismatch");
  if (batchAudit.parsedBeforeAfter !== batchAudit.changeCount) errors.push("applyBatch before/after count mismatch");
  if (batchAudit.validDecisionRecords !== batchAudit.changeCount) errors.push("applyBatch decision audit count mismatch");
  if (batchAudit.beforeAfterErrors.length > 0) errors.push(`before/after audit errors=${batchAudit.beforeAfterErrors.length}`);

  return {
    auditVersion: "cuisine-target-post-apply-audit-v1",
    mode: "read-only",
    readOnly: true,
    writesDatabase: false,
    targetDatabase: process.env.DATABASE_URL,
    preApplyDatabase: beforeDatabase,
    batchId,
    pass: errors.length === 0,
    errors,
    integrityCheck,
    counts: {
      restaurants: restaurants.length,
      activeCuisineTypes: activeCuisineTypes.length,
      cuisineTypes: cuisineTypes.length,
      tags: tags.length,
      restaurantTags: restaurantTags.length,
      unclassified: restaurants.filter((restaurant) => restaurant.cuisineTypeId == null).length,
      manualLockedRows,
      maxCuisineTypeIdsPerRestaurant: 1,
    },
    cuisineDistribution,
    cuisineTypeChecks: {
      duplicateNormalizedNames,
      invalidCuisineTypeIds,
      candidates: candidateChecks,
      cardinality: { field: "Restaurant.cuisineTypeId", maxPerRestaurant: 1, manyToManyRelationTables: unexpectedCuisineRelationTables },
    },
    relationshipChecks: {
      orphanRestaurantTags: orphanRestaurantTags.length,
      nestedRestaurantTagRows: nestedRestaurantTagKeys.size,
      missingNestedRestaurantTags: missingNestedRestaurantTags.length,
      extraNestedRestaurantTags: extraNestedRestaurantTags.length,
      restaurantTagRows: restaurantTags.length,
      sourceTraceRows: sourceTraceRows.length,
      sourceFilePresent: sourceTraceRows.filter((row) => nonEmpty(row.sourceFile)).length,
      sourceIdPresent: sourceTraceRows.filter((row) => nonEmpty(row.sourceId)).length,
      sourceRefsPresent: sourceTraceRows.filter((row) => nonEmpty(row.sourceRefsJson)).length,
      invalidSourceRefsRows,
      invalidManualOverrideRows,
      manualLockCounts,
      tagOwnership,
      tagVisibility,
      protectedTrace,
    },
    foreignKeyErrors,
    applyBatchAudit: batchAudit,
    batches,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  assertExistingSqlite(options.database, "target");
  assertExistingSqlite(options.beforeDatabase, "pre-apply backup");
  process.env.DATABASE_URL = String(options.database);
  const prisma = new PrismaClient();
  try {
    const result = await auditTarget({
      prisma,
      batchId: options.batchId,
      beforeDatabase: options.beforeDatabase,
      expectedChanges: options.expectedChanges,
      candidates: options.candidates,
    });
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      result.output = outputPath;
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.pass) process.exitCode = 2;
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

module.exports = { auditTarget, candidateChecksFor, main, parseArgs, parseCandidateSpec, usage };
