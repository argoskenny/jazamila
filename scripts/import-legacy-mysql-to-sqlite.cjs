#!/usr/bin/env node

/**
 * Import legacy Laravel/MySQL data into the Next.js Prisma SQLite database.
 *
 * Required env:
 * - LEGACY_DATABASE_URL=mysql://user:pass@host:3306/legacy_db
 * - DATABASE_URL=file:./production.db
 *
 * Usage:
 *   npm run db:import:legacy:dry
 *   npm run db:import:legacy
 */

const mysql = require("mysql2/promise");
const { PrismaClient } = require("@prisma/client");
const { runImport } = require("./legacy-import-runner.cjs");

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const batchSize = Number(process.env.MIGRATION_BATCH_SIZE || 500);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  requiredEnv("DATABASE_URL");
  const legacyUrl = requiredEnv("LEGACY_DATABASE_URL");
  const legacy = await mysql.createConnection(legacyUrl);

  try {
    await runImport({
      prisma,
      legacy,
      dryRun,
      batchSize,
      logger: console
    });
  } finally {
    await legacy.end();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
