#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { once } = require("node:events");
const { finished } = require("node:stream/promises");
const {
  TAXONOMY_VERSION,
  classifyRestaurant,
} = require("../lib/domain/deterministic-cuisine-classifier.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "data_tmp", "cuisine-unverified-other-20260812", "records.jsonl");

function usage() {
  return `Usage: node scripts/classify-cuisine-unverified-backup.cjs --output-dir <path> [options]

Read an exported unverified cuisine JSONL backup and write deterministic dry-run artifacts.
This command never uses the network and never reads or writes SQLite.

Options:
  --input <path>        Backup records JSONL (default: data_tmp/cuisine-unverified-other-20260812/records.jsonl)
  --output-dir <path>   New artifact directory (required; must not already contain output files)
  --sample-size <n>     Samples per decision reason in summary.json (default: 5)
  --help                Show this help
`;
}

function parseArgs(argv) {
  const options = {
    inputPath: DEFAULT_INPUT,
    outputDir: null,
    sampleSize: 5,
    help: false,
  };
  const valueOptions = new Map([
    ["--input", "inputPath"],
    ["--output-dir", "outputDir"],
    ["--sample-size", "sampleSize"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else {
      const [name, inlineValue] = argument.split("=", 2);
      const key = valueOptions.get(name);
      if (!key) throw new Error(`Unknown option: ${argument}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      options[key] = value;
    }
  }
  if (options.help) return options;
  if (!options.outputDir) throw new Error("--output-dir is required");
  options.inputPath = path.resolve(ROOT, String(options.inputPath));
  options.outputDir = path.resolve(ROOT, String(options.outputDir));
  options.sampleSize = Number(options.sampleSize);
  if (!Number.isInteger(options.sampleSize) || options.sampleSize < 0 || options.sampleSize > 100) {
    throw new Error("--sample-size must be an integer between 0 and 100");
  }
  return options;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function increment(counts, key) {
  const normalizedKey = String(key || "(none)");
  counts[normalizedKey] = (counts[normalizedKey] ?? 0) + 1;
}

function inputForRecord(record) {
  const input = record?.input ?? {};
  const database = record?.currentDatabase ?? {};
  return {
    restaurantId: Number(record.restaurantId),
    name: input.name,
    note: input.note,
    address: input.address,
    phone: input.phone,
    areaNum: database.areaNum,
    telNum: database.telNum,
    originalFoodType: input.currentFoodType,
    originalTags: input.currentTags,
    sourceRefs: input.knownSourceReferences,
    sourceCuisineTypes: input.savedSourceCuisineTypes,
  };
}

function compactResult(record, result) {
  return {
    mode: "dry-run",
    readOnly: true,
    callsNetwork: false,
    writesDatabase: false,
    taxonomyVersion: TAXONOMY_VERSION,
    restaurantId: result.restaurantId,
    sourceInputFingerprint: record?.source?.inputFingerprint ?? null,
    inputFingerprint: result.inputFingerprint,
    fingerprintMatchesSource: result.inputFingerprint === record?.source?.inputFingerprint,
    name: record?.input?.name ?? "",
    address: record?.input?.address ?? "",
    previousFallbackCuisineType: record?.priorDecision?.selectedCuisineTypeName ?? null,
    classificationStatus: result.classificationStatus,
    proposedCuisineType: result.proposedCuisineType,
    confidence: result.confidence,
    decisionReason: result.decisionReason,
    needsAi: result.needsAi,
    needsWebResearch: result.needsWebResearch,
    keptAuxiliaryTags: result.keptAuxiliaryTags,
    removedCuisineTags: result.removedCuisineTags,
    matchedRules: result.matchedRules,
    candidateEvidence: result.candidateEvidence.map((candidate) => ({
      code: candidate.code,
      evidencePriority: candidate.evidencePriority,
      confidence: candidate.confidence,
      matchedRuleIds: [...new Set(candidate.matches.map((match) => match.ruleId))],
    })),
    ambiguousMatches: result.ambiguousMatches,
    unsupportedCategoryMatches: result.unsupportedCategoryMatches,
    entityRiskMatches: result.entityRiskMatches,
  };
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`, "utf8")) await once(stream, "drain");
}

function addSample(samples, result, sampleSize) {
  if (sampleSize === 0) return;
  const bucket = samples[result.decisionReason] ?? [];
  if (bucket.length >= sampleSize) return;
  bucket.push({
    restaurantId: result.restaurantId,
    name: result.name,
    proposedCuisineType: result.proposedCuisineType?.name ?? null,
    confidence: result.confidence,
    needsWebResearch: result.needsWebResearch,
    candidateEvidence: result.candidateEvidence,
    unsupportedCategories: [...new Set(result.unsupportedCategoryMatches.map((match) => match.category))],
    entityRisks: [...new Set(result.entityRiskMatches.map((match) => match.id))],
  });
  samples[result.decisionReason] = bucket;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  if (!fs.existsSync(options.inputPath)) throw new Error(`input JSONL does not exist: ${options.inputPath}`);
  fs.mkdirSync(options.outputDir, { recursive: true });
  const outputPaths = {
    classified: path.join(options.outputDir, "classified-results.jsonl"),
    unresolved: path.join(options.outputDir, "unresolved-results.jsonl"),
    summary: path.join(options.outputDir, "summary.json"),
    manifest: path.join(options.outputDir, "sha256-manifest.json"),
  };
  for (const outputPath of Object.values(outputPaths)) {
    if (fs.existsSync(outputPath)) throw new Error(`refusing to overwrite existing artifact: ${outputPath}`);
  }

  const classifiedStream = fs.createWriteStream(outputPaths.classified, { encoding: "utf8", flags: "wx" });
  const unresolvedStream = fs.createWriteStream(outputPaths.unresolved, { encoding: "utf8", flags: "wx" });
  const summary = {
    mode: "dry-run",
    readOnly: true,
    callsNetwork: false,
    readsDatabase: false,
    writesDatabase: false,
    taxonomyVersion: TAXONOMY_VERSION,
    sourcePath: options.inputPath,
    total: 0,
    classified: 0,
    unresolved: 0,
    needsAi: 0,
    needsWebResearch: 0,
    fingerprintMismatches: 0,
    byCuisineType: {},
    byDecisionReason: {},
    byUnsupportedCategory: {},
    byEntityRisk: {},
    samples: {},
  };

  const lines = readline.createInterface({ input: fs.createReadStream(options.inputPath), crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!line.trim()) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at line ${lineNumber}: ${error instanceof Error ? error.message : error}`, { cause: error });
      }
      const result = compactResult(record, classifyRestaurant(inputForRecord(record)));
      summary.total += 1;
      increment(summary.byDecisionReason, result.decisionReason);
      if (result.needsAi) summary.needsAi += 1;
      if (result.needsWebResearch) summary.needsWebResearch += 1;
      if (!result.fingerprintMatchesSource) summary.fingerprintMismatches += 1;
      for (const category of new Set(result.unsupportedCategoryMatches.map((match) => match.category))) {
        increment(summary.byUnsupportedCategory, category);
      }
      for (const risk of new Set(result.entityRiskMatches.map((match) => match.id))) increment(summary.byEntityRisk, risk);
      addSample(summary.samples, result, options.sampleSize);
      if (result.classificationStatus === "classified") {
        summary.classified += 1;
        increment(summary.byCuisineType, result.proposedCuisineType.code);
        await writeLine(classifiedStream, result);
      } else {
        summary.unresolved += 1;
        await writeLine(unresolvedStream, result);
      }
    }
  } finally {
    classifiedStream.end();
    unresolvedStream.end();
    await Promise.all([finished(classifiedStream), finished(unresolvedStream)]);
  }

  summary.classifiedRate = summary.total === 0 ? 0 : Number((summary.classified / summary.total).toFixed(6));
  summary.createdAt = new Date().toISOString();
  fs.writeFileSync(outputPaths.summary, `${JSON.stringify(summary, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  const files = await Promise.all([outputPaths.classified, outputPaths.unresolved, outputPaths.summary].map(async (filePath) => ({
    path: path.basename(filePath),
    bytes: fs.statSync(filePath).size,
    sha256: await sha256File(filePath),
  })));
  const manifest = {
    manifestVersion: "jazamila-cuisine-unverified-deterministic-v1",
    createdAt: new Date().toISOString(),
    taxonomyVersion: TAXONOMY_VERSION,
    source: {
      path: options.inputPath,
      bytes: fs.statSync(options.inputPath).size,
      sha256: await sha256File(options.inputPath),
    },
    files,
  };
  fs.writeFileSync(outputPaths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${JSON.stringify({ outputDir: options.outputDir, ...summary }, null, 2)}\n`);
  return { summary, manifest, outputPaths };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_INPUT,
  compactResult,
  inputForRecord,
  main,
  parseArgs,
  usage,
};
