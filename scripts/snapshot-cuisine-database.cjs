#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

function filePathFromUrl(url) {
  const value = String(url);
  if (!value.startsWith("file:")) throw new Error("only file: SQLite URLs are supported");
  const raw = decodeURIComponent(value.slice(5));
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), "prisma", raw);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function main(argv = process.argv.slice(2)) {
  const databaseIndex = argv.indexOf("--database");
  const outputIndex = argv.indexOf("--output");
  const database = databaseIndex >= 0 ? argv[databaseIndex + 1] : null;
  const output = outputIndex >= 0 ? path.resolve(argv[outputIndex + 1]) : null;
  if (!database || !output) throw new Error("--database and --output are required");
  process.env.DATABASE_URL = database;
  const prisma = new PrismaClient();
  try {
    const databasePath = filePathFromUrl(database);
    const relationColumns = await prisma.$queryRawUnsafe("PRAGMA table_info('r_restaurant_tag')");
    const hasKind = relationColumns.some((column) => column.name === "kind");
    const [restaurants, nullCuisine, cuisineTypes, activeCuisineTypes, tags, restaurantTags, batches, changes, migrations, integrity, foreignKeys, distributions] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { cuisineTypeId: null } }),
      prisma.cuisineType.count(),
      prisma.cuisineType.count({ where: { status: "active" } }),
      prisma.tag.count(),
      prisma.restaurantTag.count(),
      prisma.cuisineApplyBatch.count(),
      prisma.cuisineApplyChange.count(),
      prisma.$queryRawUnsafe("SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name"),
      prisma.$queryRawUnsafe("PRAGMA integrity_check"),
      prisma.$queryRawUnsafe("PRAGMA foreign_key_check"),
      prisma.$queryRawUnsafe("SELECT COALESCE(ct.code, 'unclassified') AS code, COALESCE(ct.name, '未分類') AS name, COUNT(*) AS count FROM r_restaurant r LEFT JOIN r_cuisine_type ct ON ct.id=r.cuisine_type_id GROUP BY ct.id ORDER BY count DESC, code ASC"),
    ]);
    const publicAuxiliary = hasKind ? await prisma.restaurantTag.count({ where: { kind: "auxiliary", isPublic: true } }) : null;
    const hiddenLegacyCuisine = hasKind ? await prisma.restaurantTag.count({ where: { kind: "legacy_cuisine", isPublic: false } }) : null;
    const snapshot = {
      snapshotVersion: "cuisine-database-snapshot-v1",
      capturedAt: new Date().toISOString(),
      databaseUrl: database,
      databasePath,
      sha256: sha256(databasePath),
      counts: { restaurants, nullCuisine, cuisineTypes, activeCuisineTypes, tags, restaurantTags, publicAuxiliary, hiddenLegacyCuisine, batches, changes },
      migrations,
      cuisineDistribution: distributions.map((row) => ({ ...row, count: Number(row.count) })),
      integrityCheck: integrity,
      foreignKeyCheck: foreignKeys,
      pass: integrity.every((row) => Object.values(row).includes("ok")) && foreignKeys.length === 0,
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
