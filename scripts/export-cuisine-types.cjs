#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = "/private/tmp/jazamila-active-cuisine-types.json";

function usage() {
  return `Usage: node scripts/export-cuisine-types.cjs [options]

Read active CuisineType rows without changing SQLite. The output is suitable
for the AI/Web request preparation CLIs.

Options:
  --output <path>  JSON output path (default: ${DEFAULT_OUTPUT})
  --help           Show this help
`;
}

function parseArgs(argv) {
  const options = { output: DEFAULT_OUTPUT, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--output" || argument.startsWith("--output=")) {
      const value = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
      if (!value) throw new Error("--output requires a path");
      options.output = value;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  options.output = path.resolve(ROOT, String(options.output));
  return options;
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
    const cuisineTypes = await prisma.cuisineType.findMany({
      where: { status: "active" },
      select: {
        id: true,
        code: true,
        name: true,
        normalizedName: true,
        status: true,
      },
      orderBy: { id: "asc" },
    });
    const document = {
      schemaVersion: "cuisine-types-export-v1",
      readOnly: true,
      cuisineTypes,
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    const result = {
      mode: "read-only",
      writesDatabase: false,
      output: options.output,
      activeCuisineTypes: cuisineTypes.length,
      ids: cuisineTypes.map((type) => type.id),
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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

module.exports = { main, parseArgs, usage };
