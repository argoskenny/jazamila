#!/usr/bin/env node

const path = require("node:path");
const {
  OpenAIChatCompletionsProviderAdapter,
} = require("../lib/ai/cuisine-classification-provider.cjs");
const {
  pendingResultForRequest,
  readJsonl,
  runProviderRequests,
  writeJsonl,
} = require("../lib/ai/cuisine-classification-pipeline.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RESULTS = "/private/tmp/jazamila-cuisine-ai-results.jsonl";

function usage() {
  return `Usage: node scripts/run-cuisine-ai-classification.cjs --requests <requests.jsonl> [options]

The default is an offline dry-run that writes pending JSONL only. External AI
calls require explicit --run and never write SQLite.

Options:
  --requests <path>       Prepared AI request JSONL (required)
  --results <path>        Result JSONL (default: ${DEFAULT_RESULTS})
  --dry-run               Do not call a provider (default)
  --run                   Explicitly call the configured structured provider
  --endpoint <url>        Provider endpoint (default: OPENAI_API_ENDPOINT)
  --api-key <value>       Provider key (default: OPENAI_API_KEY)
  --model-version <name>  Must match the prepared request model version
  --limit <n>              Process only the first n requests
  --help                  Show this help
`;
}

function parseArgs(argv) {
  const options = {
    requests: null,
    results: DEFAULT_RESULTS,
    run: false,
    endpoint: process.env.OPENAI_API_ENDPOINT,
    apiKey: process.env.OPENAI_API_KEY,
    modelVersion: null,
    limit: null,
    help: false,
  };
  const valueOptions = new Map([
    ["--requests", "requests"],
    ["--results", "results"],
    ["--endpoint", "endpoint"],
    ["--api-key", "apiKey"],
    ["--model-version", "modelVersion"],
    ["--limit", "limit"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") options.run = true;
    else if (argument === "--dry-run") options.run = false;
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
  if (!options.requests) throw new Error("--requests is required");
  options.requests = path.resolve(ROOT, String(options.requests));
  options.results = path.resolve(ROOT, String(options.results));
  options.limit = options.limit == null ? null : Number(options.limit);
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  return options;
}

function validateRequests(requests) {
  if (!Array.isArray(requests)) throw new Error("request JSONL must contain an array of records");
  const snapshotHashes = new Set();
  const modelVersions = new Set();
  for (const request of requests) {
    if (!request || typeof request !== "object") throw new Error("request record must be an object");
    if (!Number.isInteger(Number(request.restaurantId)) || !/^[a-f0-9]{64}$/u.test(String(request.inputFingerprint))) {
      throw new Error("every request must have a restaurantId and SHA-256 inputFingerprint");
    }
    if (!String(request.customId || "").startsWith("jazamila-cuisine-ai-v1:")) {
      throw new Error(`invalid AI customId for restaurant ${request.restaurantId}`);
    }
    if (request.snapshotHash) snapshotHashes.add(String(request.snapshotHash));
    modelVersions.add(String(request.modelVersion || ""));
  }
  if (snapshotHashes.size > 1) throw new Error("AI requests contain more than one snapshotHash");
  if (modelVersions.size > 1) throw new Error("AI requests contain more than one modelVersion");
  return { snapshotHash: [...snapshotHashes][0] ?? null, modelVersion: [...modelVersions][0] ?? null };
}

function countStatuses(records) {
  return records.reduce((counts, record) => {
    const status = String(record?.status || "unknown");
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  const allRequests = readJsonl(options.requests);
  const requestMeta = validateRequests(allRequests);
  const requests = options.limit === null ? allRequests : allRequests.slice(0, options.limit);
  const modelVersion = String(options.modelVersion || requestMeta.modelVersion || "").trim();
  if (!modelVersion || modelVersion === "unconfigured-model" || modelVersion === "pending-ai-model-v1") {
    if (options.run) throw new Error("--run requires a configured --model-version and a prepared request with that same version");
  }
  if (options.modelVersion && requestMeta.modelVersion && String(options.modelVersion) !== requestMeta.modelVersion) {
    throw new Error("--model-version must match the modelVersion recorded in the request JSONL");
  }

  let results;
  if (!options.run) {
    results = requests.map(pendingResultForRequest);
  } else {
    if (!options.apiKey) throw new Error("--run requires OPENAI_API_KEY or --api-key");
    if (!options.endpoint) throw new Error("--run requires OPENAI_API_ENDPOINT or --endpoint");
    const provider = new OpenAIChatCompletionsProviderAdapter({
      apiKey: options.apiKey,
      endpoint: options.endpoint,
      modelVersion,
    });
    results = await runProviderRequests({ requests, provider });
  }
  const output = writeJsonl(options.results, results);
  const summary = {
    mode: options.run ? "provider-run" : "dry-run",
    readOnly: true,
    callsProvider: options.run,
    writesDatabase: false,
    requestsRead: allRequests.length,
    requestsProcessed: requests.length,
    snapshotHash: requestMeta.snapshotHash,
    modelVersion: modelVersion || null,
    resultPath: output,
    statuses: countStatuses(results),
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

module.exports = { countStatuses, main, parseArgs, usage, validateRequests };
