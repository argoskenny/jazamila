#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_PRICE_TWD,
  applyImport,
  loadDocuments,
  prepareImport,
} = require("./res-data-importer.cjs");

const ROOT = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/import-res-data-to-sqlite.cjs [options]

Options:
  --dry-run              Validate, resolve locations, and deduplicate without writing SQLite
  --replace              Delete all existing restaurants before importing (explicitly destructive)
  --prune                Delete stale rows previously owned by this res-data importer
  --data-dir <path>      JSON directory (default: docs/res_data)
  --dedupe-decisions <path> Verified name decisions for address+phone duplicates
  --report <path>        Write the complete JSON report, including isolated issues
  --max-price <number>   Reject per-person price maxima above this TWD value (default: 10000)
  --batch-size <number>  Prisma create/update batch size (default: 100)
  --help                  Show this help
`;
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    replace: false,
    prune: false,
    dataDir: path.join(ROOT, "docs", "res_data"),
    dedupeDecisionsPath: path.join(ROOT, "docs", "res-data-dedupe-decisions.json"),
    reportPath: null,
    maxPriceTwd: DEFAULT_MAX_PRICE_TWD,
    batchSize: DEFAULT_BATCH_SIZE,
    help: false,
  };
  const valueOptions = new Map([
    ["--data-dir", "dataDir"],
    ["--dedupe-decisions", "dedupeDecisionsPath"],
    ["--report", "reportPath"],
    ["--max-price", "maxPriceTwd"],
    ["--batch-size", "batchSize"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--replace") options.replace = true;
    else if (argument === "--prune") options.prune = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else {
      const [name, inlineValue] = argument.split("=", 2);
      const key = valueOptions.get(name);
      if (!key) throw new Error(`Unknown option: ${argument}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      options[key] = value;
    }
  }

  options.dataDir = path.resolve(ROOT, String(options.dataDir));
  options.dedupeDecisionsPath = path.resolve(ROOT, String(options.dedupeDecisionsPath));
  options.reportPath = options.reportPath ? path.resolve(ROOT, String(options.reportPath)) : null;
  options.maxPriceTwd = Number(options.maxPriceTwd);
  options.batchSize = Number(options.batchSize);
  if (!Number.isInteger(options.maxPriceTwd) || options.maxPriceTwd <= 0) {
    throw new Error("--max-price must be a positive integer");
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error("--batch-size must be an integer between 1 and 500");
  }
  return options;
}

function readLookupData() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "domain", "lookup-data.json"), "utf8"));
}

function readDedupeDecisions(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed.entries)) throw new Error("Dedupe decisions file must contain an entries array");
  return parsed.entries;
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  if (!fs.existsSync(options.dataDir)) throw new Error(`Data directory does not exist: ${options.dataDir}`);

  const loaded = loadDocuments(options.dataDir);
  if (loaded.fileErrors.length > 0) {
    throw new Error(`Cannot import because ${loaded.fileErrors.length} JSON file(s) are invalid: ${JSON.stringify(loaded.fileErrors)}`);
  }
  const prepared = prepareImport({
    documents: loaded.documents,
    existingLookup: readLookupData(),
    maxPriceTwd: options.maxPriceTwd,
    dedupeDecisions: readDedupeDecisions(options.dedupeDecisionsPath),
  });

  let writes = null;
  if (!options.dryRun) {
    process.env.DATABASE_URL ||= "file:./dev.db";
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    try {
      writes = await applyImport({
        prisma,
        prepared,
        replace: options.replace,
        prune: options.prune,
        batchSize: options.batchSize,
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? "dry-run" : "apply",
    source: path.relative(ROOT, options.dataDir) || ".",
    config: {
      maxPriceTwd: options.maxPriceTwd,
      batchSize: options.batchSize,
      replace: options.replace,
      prune: options.prune,
      dedupeDecisions: path.relative(ROOT, options.dedupeDecisionsPath),
    },
    summary: prepared.summary,
    writes,
    issues: prepared.issues,
  };
  if (options.reportPath) writeReport(options.reportPath, report);

  const output = {
    ...report,
    reportPath: options.reportPath,
    issues: undefined,
    issueSamples: prepared.issues.slice(0, 12).map((issue) => Object.fromEntries(
      Object.entries(issue).filter(([key]) => key !== "payloadJson")
    )),
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs, usage };
