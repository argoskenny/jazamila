#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  PROMPT_VERSION,
} = require("../lib/ai/cuisine-classification-prompts.cjs");
const {
  buildRequestsFromStage3Report,
  loadSuppliedCuisineTypes,
  pendingResultForRequest,
  writeJsonl,
} = require("../lib/ai/cuisine-classification-pipeline.cjs");

const ROOT = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/prepare-cuisine-ai-classification.cjs --input <phase3-report.json> --cuisine-types <active-types.json> [options]

This command is always a read-only dry-run. It prepares JSONL only and never calls an AI provider or writes SQLite.

Options:
  --dry-run                    Explicitly confirm dry-run mode (the default)
  --input <path>               Phase 3 deterministic dry-run report (required)
  --cuisine-types <path>       Read-only export with active CuisineType ids and names (required)
  --requests <path>            Request JSONL output (default: /private/tmp/jazamila-cuisine-ai-requests.jsonl)
  --results <path>             Optional pending result JSONL output
  --model-version <value>      Model identifier recorded in every request (default: AI_MODEL_VERSION or unconfigured-model)
  --sample-size <n>            Number of request samples printed (default: 5)
  --limit <n>                  Prepare only the first n needsAi rows for a narrow dry-run
  --help                       Show this help
`;
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    inputPath: null,
    cuisineTypesPath: null,
    requestsPath: "/private/tmp/jazamila-cuisine-ai-requests.jsonl",
    resultsPath: null,
    modelVersion: process.env.CODEX_MODEL_VERSION || process.env.AI_MODEL_VERSION || "unconfigured-model",
    sampleSize: 5,
    limit: null,
    help: false,
  };
  const valueOptions = new Map([
    ["--input", "inputPath"],
    ["--cuisine-types", "cuisineTypesPath"],
    ["--requests", "requestsPath"],
    ["--results", "resultsPath"],
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
  options.cuisineTypesPath = path.resolve(ROOT, String(options.cuisineTypesPath));
  options.requestsPath = path.resolve(ROOT, String(options.requestsPath));
  options.resultsPath = options.resultsPath ? path.resolve(ROOT, String(options.resultsPath)) : null;
  options.sampleSize = Number(options.sampleSize);
  options.limit = options.limit === null ? null : Number(options.limit);
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

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  const report = readJson(options.inputPath);
  const suppliedCuisineTypes = loadSuppliedCuisineTypes(options.cuisineTypesPath);
  const stage3Results = Array.isArray(report.results) ? report.results : [];
  const needsAiResults = stage3Results.filter((result) => result?.needsAi === true);
  const requests = buildRequestsFromStage3Report({
    report,
    suppliedCuisineTypes,
    modelVersion: String(options.modelVersion).trim(),
    limit: options.limit,
  });
  const requestPath = writeJsonl(options.requestsPath, requests);
  let resultPath = null;
  if (options.resultsPath) {
    resultPath = writeJsonl(options.resultsPath, requests.map(pendingResultForRequest));
  }

  const summary = {
    mode: "dry-run",
    readOnly: true,
    callsProvider: false,
    writesDatabase: false,
    promptVersion: PROMPT_VERSION,
    modelVersion: String(options.modelVersion).trim(),
    phase3Results: stage3Results.length,
    needsAiResults: needsAiResults.length,
    requestsPrepared: requests.length,
    skippedBecauseDeterministic: stage3Results.filter((result) => result?.needsAi !== true).length,
    suppliedActiveCuisineTypes: suppliedCuisineTypes.length,
    requestPath,
    resultPath,
    samples: requests.slice(0, options.sampleSize).map((request) => ({
      customId: request.customId,
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      promptVersion: request.promptVersion,
      modelVersion: request.modelVersion,
      currentFoodType: request.input.currentFoodType,
      currentTags: request.input.currentTags,
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
