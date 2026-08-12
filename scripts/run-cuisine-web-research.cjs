#!/usr/bin/env node

const path = require("node:path");
const {
  OpenAIChatCompletionsProviderAdapter,
} = require("../lib/ai/cuisine-classification-provider.cjs");
const {
  pendingResultForRequest,
  readJsonl,
  runWebResearchRequests,
  writeJsonl,
} = require("../lib/web-research/web-research-pipeline.cjs");
const { WebResearchProviderAdapter } = require("../lib/web-research/web-research-provider.cjs");
const {
  createHttpPageFetcher,
  createHttpSearchImpl,
} = require("../lib/web-research/http-web-provider.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RESULTS = "/private/tmp/jazamila-cuisine-web-results.jsonl";

function usage() {
  return `Usage: node scripts/run-cuisine-web-research.cjs --requests <requests.jsonl> [options]

The default is an offline dry-run that writes pending JSONL only. Search, page
fetch, and model calls require explicit --run and never write SQLite.

Options:
  --requests <path>       Prepared Web request JSONL (required)
  --results <path>        Result JSONL (default: ${DEFAULT_RESULTS})
  --dry-run               Do not call search, pages, or model (default)
  --run                   Explicitly call configured search/page/model providers
  --search-endpoint <url> Search endpoint (default: WEB_SEARCH_ENDPOINT)
  --search-api-key <key>  Search API key (default: WEB_SEARCH_API_KEY)
  --model-endpoint <url>  Model endpoint (default: OPENAI_API_ENDPOINT)
  --model-api-key <key>   Model key (default: OPENAI_API_KEY)
  --model-version <name>  Must match the prepared request model version
  --limit <n>              Process only the first n requests
  --max-results <n>       Max fetched hits per query (default: 5)
  --help                  Show this help
`;
}

function parseArgs(argv) {
  const options = {
    requests: null,
    results: DEFAULT_RESULTS,
    run: false,
    searchEndpoint: process.env.WEB_SEARCH_ENDPOINT,
    searchApiKey: process.env.WEB_SEARCH_API_KEY,
    modelEndpoint: process.env.OPENAI_API_ENDPOINT,
    modelApiKey: process.env.OPENAI_API_KEY,
    modelVersion: null,
    limit: null,
    maxResults: 5,
    help: false,
  };
  const valueOptions = new Map([
    ["--requests", "requests"],
    ["--results", "results"],
    ["--search-endpoint", "searchEndpoint"],
    ["--search-api-key", "searchApiKey"],
    ["--model-endpoint", "modelEndpoint"],
    ["--model-api-key", "modelApiKey"],
    ["--model-version", "modelVersion"],
    ["--limit", "limit"],
    ["--max-results", "maxResults"],
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
  options.maxResults = Number(options.maxResults);
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error("--limit must be a positive integer");
  if (!Number.isInteger(options.maxResults) || options.maxResults < 1 || options.maxResults > 20) throw new Error("--max-results must be between 1 and 20");
  return options;
}

function validateRequests(requests) {
  const snapshotHashes = new Set();
  const modelVersions = new Set();
  for (const request of requests) {
    if (!request || typeof request !== "object") throw new Error("request record must be an object");
    if (!Number.isInteger(Number(request.restaurantId)) || !/^[a-f0-9]{64}$/u.test(String(request.inputFingerprint))) throw new Error("every request must have restaurantId and inputFingerprint");
    if (!String(request.customId || "").startsWith("jazamila-cuisine-web-v1:")) throw new Error(`invalid Web customId for restaurant ${request.restaurantId}`);
    if (request.snapshotHash) snapshotHashes.add(String(request.snapshotHash));
    modelVersions.add(String(request.modelVersion || ""));
  }
  if (snapshotHashes.size > 1) throw new Error("Web requests contain more than one snapshotHash");
  if (modelVersions.size > 1) throw new Error("Web requests contain more than one modelVersion");
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
  if (options.modelVersion && requestMeta.modelVersion && String(options.modelVersion) !== requestMeta.modelVersion) throw new Error("--model-version must match the modelVersion recorded in the request JSONL");
  if (options.run && (!modelVersion || modelVersion === "unconfigured-web-model" || modelVersion === "pending-web-model-v1")) throw new Error("--run requires a configured --model-version and prepared request with that same version");

  let results;
  if (!options.run) {
    results = requests.map(pendingResultForRequest);
  } else {
    if (!options.searchEndpoint) throw new Error("--run requires WEB_SEARCH_ENDPOINT or --search-endpoint");
    if (!options.modelApiKey) throw new Error("--run requires OPENAI_API_KEY or --model-api-key");
    if (!options.modelEndpoint) throw new Error("--run requires OPENAI_API_ENDPOINT or --model-endpoint");
    const modelAdapter = new OpenAIChatCompletionsProviderAdapter({
      apiKey: options.modelApiKey,
      endpoint: options.modelEndpoint,
      modelVersion,
    });
    const provider = new WebResearchProviderAdapter({
      searchImpl: createHttpSearchImpl({ endpoint: options.searchEndpoint, apiKey: options.searchApiKey }),
      fetchImpl: createHttpPageFetcher(),
      modelAdapter,
      maxResultsPerQuery: options.maxResults,
    });
    results = await runWebResearchRequests({ requests, provider });
  }
  const output = writeJsonl(options.results, results);
  const summary = {
    mode: options.run ? "provider-run" : "dry-run",
    readOnly: true,
    callsWebSearch: options.run,
    fetchesPages: options.run,
    callsModel: options.run,
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
