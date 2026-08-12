#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_CONFIDENCE_THRESHOLD,
  buildRequestsFromStage3Report,
  loadSuppliedCuisineTypes,
  pendingResultForRequest,
  readJsonl,
  writeJsonl,
} = require("../lib/web-research/web-research-pipeline.cjs");
const { WEB_RESEARCH_PROMPT_VERSION } = require("../lib/web-research/web-research-prompts.cjs");

const ROOT = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/prepare-cuisine-web-research.cjs --input <phase3-report.json> --cuisine-types <active-types.json> [options]

This command is always a read-only dry-run. It prepares identity-bound web research JSONL only; it never writes SQLite.

Options:
  --dry-run                    Explicitly confirm dry-run mode (the default)
  --input <path>               Phase 3 deterministic dry-run report (required)
  --ai-results <path>          Optional phase 4 result JSONL for candidates and AI confidence
  --cuisine-types <path>       Read-only export with active CuisineType ids and names (required)
  --requests <path>            Request JSONL output (default: /private/tmp/jazamila-cuisine-web-requests.jsonl)
  --results <path>             Optional pending result JSONL output
  --confidence-threshold <n>   Web threshold from 0 to 1 (default: ${DEFAULT_CONFIDENCE_THRESHOLD})
  --model-version <value>      Model identifier recorded in every request (default: AI_WEB_MODEL_VERSION or unconfigured-web-model)
  --sample-size <n>            Number of request samples printed (default: 5)
  --limit <n>                  Prepare only the first n eligible rows
  --help                       Show this help
`;
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    inputPath: null,
    aiResultsPath: null,
    cuisineTypesPath: null,
    requestsPath: "/private/tmp/jazamila-cuisine-web-requests.jsonl",
    resultsPath: null,
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    modelVersion: process.env.CODEX_MODEL_VERSION || process.env.AI_WEB_MODEL_VERSION || "unconfigured-web-model",
    sampleSize: 5,
    limit: null,
    help: false,
  };
  const valueOptions = new Map([
    ["--input", "inputPath"],
    ["--ai-results", "aiResultsPath"],
    ["--cuisine-types", "cuisineTypesPath"],
    ["--requests", "requestsPath"],
    ["--results", "resultsPath"],
    ["--confidence-threshold", "confidenceThreshold"],
    ["--model-version", "modelVersion"],
    ["--sample-size", "sampleSize"],
    ["--limit", "limit"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
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
  if (options.help) return options;
  if (!options.inputPath) throw new Error("--input is required");
  if (!options.cuisineTypesPath) throw new Error("--cuisine-types is required");
  options.inputPath = path.resolve(ROOT, String(options.inputPath));
  options.aiResultsPath = options.aiResultsPath ? path.resolve(ROOT, String(options.aiResultsPath)) : null;
  options.cuisineTypesPath = path.resolve(ROOT, String(options.cuisineTypesPath));
  options.requestsPath = path.resolve(ROOT, String(options.requestsPath));
  options.resultsPath = options.resultsPath ? path.resolve(ROOT, String(options.resultsPath)) : null;
  options.confidenceThreshold = Number(options.confidenceThreshold);
  options.sampleSize = Number(options.sampleSize);
  options.limit = options.limit === null ? null : Number(options.limit);
  if (!Number.isFinite(options.confidenceThreshold) || options.confidenceThreshold < 0 || options.confidenceThreshold > 1) {
    throw new Error("--confidence-threshold must be between 0 and 1");
  }
  if (!Number.isInteger(options.sampleSize) || options.sampleSize < 0 || options.sampleSize > 100) {
    throw new Error("--sample-size must be an integer between 0 and 100");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  if (!String(options.modelVersion).trim()) throw new Error("--model-version cannot be empty");
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countReasons(requests) {
  const counts = {};
  for (const request of requests) {
    for (const reason of request.eligibility.reasons) counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  const report = readJson(options.inputPath);
  const aiResults = options.aiResultsPath ? readJsonl(options.aiResultsPath) : [];
  const suppliedCuisineTypes = loadSuppliedCuisineTypes(options.cuisineTypesPath);
  const stage3Results = Array.isArray(report.results) ? report.results : [];
  const eligibleRequests = buildRequestsFromStage3Report({
    report,
    aiResults,
    suppliedCuisineTypes,
    confidenceThreshold: options.confidenceThreshold,
    modelVersion: String(options.modelVersion).trim(),
    limit: null,
  });
  const requests = options.limit === null ? eligibleRequests : eligibleRequests.slice(0, options.limit);
  const requestPath = writeJsonl(options.requestsPath, requests);
  let resultPath = null;
  if (options.resultsPath) resultPath = writeJsonl(options.resultsPath, requests.map(pendingResultForRequest));
  const summary = {
    mode: "dry-run",
    readOnly: true,
    callsWebSearch: false,
    fetchesPages: false,
    callsModel: false,
    writesDatabase: false,
    promptVersion: WEB_RESEARCH_PROMPT_VERSION,
    modelVersion: String(options.modelVersion).trim(),
    confidenceThreshold: options.confidenceThreshold,
    phase3Results: stage3Results.length,
    eligibleBeforeLimit: eligibleRequests.length,
    requestsPrepared: requests.length,
    suppliedActiveCuisineTypes: suppliedCuisineTypes.length,
    byEligibilityReason: countReasons(eligibleRequests),
    requestPath,
    resultPath,
    samples: requests.slice(0, options.sampleSize).map((request) => ({
      customId: request.customId,
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      name: request.input.name,
      address: request.input.address,
      phone: request.input.phone,
      city: request.input.city,
      district: request.input.district,
      branchName: request.input.branchName,
      searchQueries: request.searchQueries,
      eligibility: request.eligibility,
    })),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parseArgs,
  usage,
};
