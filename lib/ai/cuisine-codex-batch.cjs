const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  readJsonl,
  parseCustomId: parseAiCustomId,
  writeJsonl,
} = require("./cuisine-classification-pipeline.cjs");
const { parseCustomId: parseWebCustomId } = require("../web-research/web-research-pipeline.cjs");
const {
  CODEX_AGENT_PROMPT_VERSION,
  buildCodexAgentPrompt,
} = require("./cuisine-codex-agent-prompts.cjs");

const CODEX_BATCH_SCHEMA_VERSION = "cuisine-codex-batch-v1";
const AI_CUSTOM_ID_PREFIX = "jazamila-cuisine-ai-v1:";
const WEB_CUSTOM_ID_PREFIX = "jazamila-cuisine-web-v1:";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(path.resolve(filePath)));
}

function cleanText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function requestKey(request) {
  return `${Number(request?.restaurantId)}:${cleanText(request?.inputFingerprint)}`;
}

function validateRequestShape(stage, request, index) {
  if (!request || typeof request !== "object") throw new Error(`request ${index + 1} must be an object`);
  if (!Number.isInteger(Number(request.restaurantId)) || Number(request.restaurantId) < 1) {
    throw new Error(`request ${index + 1} must have a positive restaurantId`);
  }
  if (!/^[a-f0-9]{64}$/u.test(String(request.inputFingerprint))) {
    throw new Error(`request ${index + 1} must have a SHA-256 inputFingerprint`);
  }
  const prefix = stage === "ai" ? AI_CUSTOM_ID_PREFIX : WEB_CUSTOM_ID_PREFIX;
  if (!String(request.customId || "").startsWith(prefix)) {
    throw new Error(`request ${index + 1} has an invalid ${stage} customId`);
  }
  const parsedCustomId = stage === "ai"
    ? parseAiCustomId(request.customId)
    : parseWebCustomId(request.customId);
  if (!parsedCustomId
    || parsedCustomId.restaurantId !== Number(request.restaurantId)
    || parsedCustomId.inputFingerprint !== String(request.inputFingerprint)) {
    throw new Error(`request ${index + 1} customId does not map to restaurantId and inputFingerprint`);
  }
  if (!cleanText(request.promptVersion) || !cleanText(request.modelVersion)) {
    throw new Error(`request ${index + 1} must include promptVersion and modelVersion`);
  }
  if (stage === "ai") {
    if (!cleanText(request.systemPrompt) || !cleanText(request.userPrompt)) {
      throw new Error(`AI request ${index + 1} must include systemPrompt and userPrompt`);
    }
    if (!Array.isArray(request.suppliedCuisineTypes) || request.suppliedCuisineTypes.length === 0) {
      throw new Error(`AI request ${index + 1} must include suppliedCuisineTypes`);
    }
  } else {
    if (!Array.isArray(request.searchQueries) || request.searchQueries.length === 0) {
      throw new Error(`Web request ${index + 1} must include searchQueries`);
    }
    if (!request.eligibility?.eligible) {
      throw new Error(`Web request ${index + 1} is not eligible for web research`);
    }
  }
}

function validateRequestSet(stage, requests) {
  if (stage !== "ai" && stage !== "web") throw new Error("stage must be ai or web");
  if (!Array.isArray(requests) || requests.length === 0) throw new Error("request JSONL must contain at least one request");
  const keys = new Set();
  const snapshots = new Set();
  const promptVersions = new Set();
  const modelVersions = new Set();
  requests.forEach((request, index) => {
    validateRequestShape(stage, request, index);
    const key = requestKey(request);
    if (keys.has(key)) throw new Error(`duplicate request for restaurant ${request.restaurantId}`);
    keys.add(key);
    if (request.snapshotHash) snapshots.add(String(request.snapshotHash));
    promptVersions.add(String(request.promptVersion));
    modelVersions.add(String(request.modelVersion));
  });
  if (snapshots.size > 1) throw new Error("requests contain more than one snapshotHash");
  if (promptVersions.size > 1) throw new Error("requests contain more than one promptVersion");
  if (modelVersions.size > 1) throw new Error("requests contain more than one modelVersion");
  return {
    snapshotHash: [...snapshots][0] ?? null,
    promptVersion: [...promptVersions][0],
    modelVersion: [...modelVersions][0],
    requestKeys: keys,
  };
}

function selectBatch(requests, { offset = 0, limit = null } = {}) {
  const start = Number(offset);
  if (!Number.isInteger(start) || start < 0) throw new Error("offset must be a non-negative integer");
  const count = limit === null || limit === undefined ? null : Number(limit);
  if (count !== null && (!Number.isInteger(count) || count < 1)) throw new Error("limit must be a positive integer");
  const selected = requests.slice(start, count === null ? undefined : start + count);
  if (selected.length === 0) throw new Error("selected batch contains no requests");
  return selected;
}

function outputPaths(outputDir, stage) {
  const directory = path.resolve(outputDir);
  return {
    directory,
    requestPath: path.join(directory, "requests.jsonl"),
    rawResultPath: path.join(directory, "raw-results.jsonl"),
    validatedResultPath: path.join(directory, "validated-results.jsonl"),
    evidencePath: stage === "web" ? path.join(directory, "evidence.jsonl") : null,
    manifestPath: path.join(directory, "manifest.json"),
    promptPath: path.join(directory, "codex-prompt.md"),
    schemaPath: path.join(directory, stage === "ai" ? "result-schema.json" : "web-result-schema.json"),
    evidenceSchemaPath: stage === "web" ? path.join(directory, "evidence-schema.json") : null,
    validationSummaryPath: path.join(directory, "validation-summary.json"),
  };
}

function buildManifest({ stage, batchId, paths, requests, requestSha256, schemaSha256, evidenceSchemaSha256 = null, codexCliVersion = null }) {
  const meta = validateRequestSet(stage, requests);
  return {
    schemaVersion: CODEX_BATCH_SCHEMA_VERSION,
    agentPromptVersion: CODEX_AGENT_PROMPT_VERSION,
    stage,
    batchId: cleanText(batchId),
    createdAt: new Date().toISOString(),
    readOnly: true,
    writesDatabase: false,
    callsProjectApi: false,
    networkPolicy: stage === "ai" ? "disabled" : "explicit-web-only",
    codexCliVersion: codexCliVersion ? cleanText(codexCliVersion) : null,
    requestCount: requests.length,
    restaurantIds: requests.map((request) => Number(request.restaurantId)),
    snapshotHash: meta.snapshotHash,
    promptVersion: meta.promptVersion,
    modelVersion: meta.modelVersion,
    requestSha256,
    schemaSha256,
    evidenceSchemaSha256,
    requestPath: paths.requestPath,
    rawResultPath: paths.rawResultPath,
    validatedResultPath: paths.validatedResultPath,
    evidencePath: paths.evidencePath,
    manifestPath: paths.manifestPath,
    promptPath: paths.promptPath,
    schemaPath: paths.schemaPath,
    evidenceSchemaPath: paths.evidenceSchemaPath,
    validationSummaryPath: paths.validationSummaryPath,
  };
}

function writeManifest(manifestPath, manifest) {
  const absolutePath = path.resolve(manifestPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return absolutePath;
}

function buildPromptForManifest(manifest) {
  return buildCodexAgentPrompt({
    stage: manifest.stage,
    manifestPath: manifest.manifestPath,
    manifest,
    schemaPath: manifest.schemaPath,
    evidenceSchemaPath: manifest.evidenceSchemaPath,
  });
}

function readManifest(manifestPath) {
  const absolutePath = path.resolve(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  if (!manifest || typeof manifest !== "object") throw new Error("manifest must be an object");
  if (manifest.readOnly !== true || manifest.writesDatabase !== false) {
    throw new Error("Codex manifest is not read-only");
  }
  if (!manifest.manifestPath) manifest.manifestPath = absolutePath;
  return manifest;
}

module.exports = {
  AI_CUSTOM_ID_PREFIX,
  CODEX_BATCH_SCHEMA_VERSION,
  CODEX_AGENT_PROMPT_VERSION,
  WEB_CUSTOM_ID_PREFIX,
  buildManifest,
  buildPromptForManifest,
  cleanText,
  outputPaths,
  readJsonl,
  readManifest,
  requestKey,
  selectBatch,
  sha256File,
  validateRequestShape,
  validateRequestSet,
  writeJsonl,
  writeManifest,
};
