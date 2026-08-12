#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");
const { cuisineTypes: catalog } = require("../lib/domain/cuisine-types.json");

function usage() {
  return `Usage: node scripts/seed-cuisine-types.cjs [--dry-run|--apply]

Idempotently plans or creates the controlled CuisineType catalog without
deleting restaurants, tags, or existing candidate/manual types.

Options:
  --dry-run   Inspect the current catalog only (default)
  --apply     Create only missing, non-conflicting seed types
  --help      Show this help
`;
}

function parseArgs(argv) {
  const options = { apply: false, help: false };
  for (const argument of argv) {
    if (argument === "--dry-run") options.apply = false;
    else if (argument === "--apply") options.apply = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

function catalogRecord(type) {
  return {
    code: String(type.code),
    name: String(type.name),
    normalizedName: String(type.normalizedName),
    status: String(type.status || "active"),
    createdBy: String(type.createdBy || "seed"),
    legacyFoodType: type.legacyFoodType == null ? null : Number(type.legacyFoodType),
  };
}

function buildSeedPlan(existingTypes, types = catalog) {
  const existingByCode = new Map(existingTypes.map((type) => [String(type.code), type]));
  const existingByNormalizedName = new Map(existingTypes.map((type) => [String(type.normalizedName), type]));
  const existingByLegacyFoodType = new Map(
    existingTypes
      .filter((type) => type.legacyFoodType != null)
      .map((type) => [Number(type.legacyFoodType), type])
  );
  const creates = [];
  const existing = [];
  const conflicts = [];

  for (const rawType of types) {
    const type = catalogRecord(rawType);
    const byCode = existingByCode.get(type.code);
    const byNormalizedName = existingByNormalizedName.get(type.normalizedName);
    const byLegacyFoodType = type.legacyFoodType == null
      ? null
      : existingByLegacyFoodType.get(type.legacyFoodType);

    if (byCode) {
      if (byCode.normalizedName !== type.normalizedName || (type.legacyFoodType != null && byCode.legacyFoodType !== type.legacyFoodType)) {
        conflicts.push({ type, reason: "code-conflicts-with-existing-definition", existing: byCode });
      } else {
        existing.push({ type, existing: byCode });
      }
      continue;
    }
    if (byNormalizedName) {
      conflicts.push({ type, reason: "normalized-name-already-used", existing: byNormalizedName });
      continue;
    }
    if (byLegacyFoodType) {
      conflicts.push({ type, reason: "legacy-foodtype-already-mapped", existing: byLegacyFoodType });
      continue;
    }
    creates.push(type);
  }

  return { creates, existing, conflicts };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }

  process.env.DATABASE_URL ||= "file:./dev.db";
  const prisma = new PrismaClient();
  try {
    const existingTypes = await prisma.cuisineType.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        normalizedName: true,
        status: true,
        createdBy: true,
        legacyFoodType: true,
      },
      orderBy: { id: "asc" },
    });
    const plan = buildSeedPlan(existingTypes);
    if (options.apply && plan.conflicts.length === 0 && plan.creates.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const type of plan.creates) {
          await tx.cuisineType.create({ data: type });
        }
      });
    }

    const result = {
      mode: options.apply ? "apply" : "dry-run",
      writesDatabase: options.apply && plan.conflicts.length === 0,
      catalogCount: catalog.length,
      existingCount: plan.existing.length,
      plannedCreates: plan.creates.length,
      created: options.apply && plan.conflicts.length === 0 ? plan.creates.length : 0,
      conflicts: plan.conflicts,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (plan.conflicts.length > 0) process.exitCode = 2;
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
  buildSeedPlan,
  catalog,
  catalogRecord,
  main,
  parseArgs,
  usage,
};
