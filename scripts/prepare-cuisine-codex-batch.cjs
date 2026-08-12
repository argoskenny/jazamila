#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  buildManifest,
  buildPromptForManifest,
  outputPaths,
  readJsonl,
  selectBatch,
  sha256File,
  validateRequestSet,
  writeJsonl,
  writeManifest,
} = require("../lib/ai/cuisine-codex-batch.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_DIR = "/private/tmp/jazamila-codex-batch";
const AI_SCHEMA = path.join(ROOT, "lib", "ai", "cuisine-classification-schema.json");
const WEB_SCHEMA = path.join(ROOT, "lib", "web-research", "web-research-schema.json");
const WEB_EVIDENCE_SCHEMA = path.join(ROOT, "lib", "web-research", "cuisine-codex-evidence-schema.json");

function usage() {
  return `Usage: node scripts/prepare-cuisine-codex-batch.cjs --stage <ai|web> --requests <requests.jsonl> --batch-id <id> [options]

This command only creates a bounded Codex handoff bundle under the selected output directory.
It never starts Codex, calls an API, searches the Web, or writes SQLite.

Options:
  --stage <ai|web>          Handoff stage (required)
  --requests <path>         Existing prepared AI or Web request JSONL (required)
  --batch-id <id>           Stable operator batch identifier (required)
  --output-dir <path>       Generated bundle directory (default: ${DEFAULT_OUTPUT_DIR})
  --offset <n>              Zero-based request offset (default: 0)
  --limit <n>               Number of requests in this batch (default: all remaining)
  --codex-cli-version <v>   CLI version recorded in manifest (default: CODEX_CLI_VERSION or null)
  --help                    Show this help
`;
}

function parseArgs(argv) {
  const options = {
    stage: null,
    requestsPath: null,
    batchId: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    offset: 0,
    limit: null,
    codexCliVersion: process.env.CODEX_CLI_VERSION || null,
    help: false,
  };
  const valueOptions = new Map([
    ["--stage", "stage"],
    ["--requests", "requestsPath"],
    ["--batch-id", "batchId"],
    ["--output-dir", "outputDir"],
    ["--offset", "offset"],
    ["--limit", "limit"],
    ["--codex-cli-version", "codexCliVersion"],
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
  if (options.stage !== "ai" && options.stage !== "web") throw new Error("--stage must be ai or web");
  if (!options.requestsPath) throw new Error("--requests is required");
  if (!String(options.batchId || "").trim()) throw new Error("--batch-id is required");
  options.requestsPath = path.resolve(ROOT, String(options.requestsPath));
  options.outputDir = path.resolve(ROOT, String(options.outputDir));
  options.offset = Number(options.offset);
  options.limit = options.limit === null ? null : Number(options.limit);
  if (!Number.isInteger(options.offset) || options.offset < 0) throw new Error("--offset must be a non-negative integer");
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error("--limit must be a positive integer");
  return options;
}

function configuredModelVersion(value) {
  const model = String(value || "").trim();
  if (!model || /(?:unconfigured|pending|to[-_]?confirm|placeholder)/iu.test(model)) {
    throw new Error("request modelVersion is not configured; prepare the request JSONL with --model-version CODEX_MODEL_VERSION");
  }
  return model;
}

function copySchema(sourcePath, destinationPath) {
  fs.copyFileSync(sourcePath, destinationPath);
  return sha256File(destinationPath);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }

  const allRequests = readJsonl(options.requestsPath);
  const allMeta = validateRequestSet(options.stage, allRequests);
  configuredModelVersion(allMeta.modelVersion);
  const requests = selectBatch(allRequests, { offset: options.offset, limit: options.limit });
  const batchMeta = validateRequestSet(options.stage, requests);
  const paths = outputPaths(options.outputDir, options.stage);
  fs.mkdirSync(paths.directory, { recursive: true });

  writeJsonl(paths.requestPath, requests);
  writeJsonl(paths.rawResultPath, []);
  writeJsonl(paths.validatedResultPath, []);
  if (paths.evidencePath) writeJsonl(paths.evidencePath, []);

  const schemaSource = options.stage === "ai" ? AI_SCHEMA : WEB_SCHEMA;
  const schemaSha256 = copySchema(schemaSource, paths.schemaPath);
  let evidenceSchemaSha256 = null;
  if (options.stage === "web") evidenceSchemaSha256 = copySchema(WEB_EVIDENCE_SCHEMA, paths.evidenceSchemaPath);

  const manifest = buildManifest({
    stage: options.stage,
    batchId: options.batchId,
    paths,
    requests,
    requestSha256: sha256File(paths.requestPath),
    schemaSha256,
    evidenceSchemaSha256,
    codexCliVersion: options.codexCliVersion,
  });
  manifest.sourceRequestPath = options.requestsPath;
  manifest.sourceRequestSha256 = sha256File(options.requestsPath);
  manifest.sourceRequestCount = allRequests.length;
  manifest.sourceOffset = options.offset;
  manifest.sourceLimit = options.limit;
  manifest.sourceSnapshotHash = allMeta.snapshotHash;
  manifest.promptVersion = batchMeta.promptVersion;
  manifest.modelVersion = batchMeta.modelVersion;
  writeManifest(paths.manifestPath, manifest);
  fs.writeFileSync(paths.promptPath, `${buildPromptForManifest(manifest)}\n`, "utf8");

  const summary = {
    mode: "codex-handoff-prepared",
    readOnly: true,
    startsCodex: false,
    callsApi: false,
    writesDatabase: false,
    stage: options.stage,
    batchId: options.batchId,
    requestCount: requests.length,
    sourceRequestCount: allRequests.length,
    sourceOffset: options.offset,
    promptVersion: manifest.agentPromptVersion,
    classificationPromptVersion: manifest.promptVersion,
    modelVersion: manifest.modelVersion,
    snapshotHash: manifest.snapshotHash,
    manifestPath: paths.manifestPath,
    promptPath: paths.promptPath,
    requestPath: paths.requestPath,
    rawResultPath: paths.rawResultPath,
    evidencePath: paths.evidencePath,
    validatedResultPath: paths.validatedResultPath,
    schemaPath: paths.schemaPath,
    evidenceSchemaPath: paths.evidenceSchemaPath,
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
  configuredModelVersion,
  main,
  parseArgs,
  usage,
};
