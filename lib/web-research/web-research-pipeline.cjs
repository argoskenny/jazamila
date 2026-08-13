const fs = require("node:fs");
const path = require("node:path");
const {
  loadSuppliedCuisineTypes,
} = require("../ai/cuisine-classification-pipeline.cjs");
const {
  WEB_RESEARCH_PROMPT_VERSION,
  buildWebResearchPromptBundle,
} = require("./web-research-prompts.cjs");
const {
  DEFAULT_CONFIDENCE_THRESHOLD,
  buildSearchQueries,
  classifyWebEligibility,
  identityInputForResult,
  identityRiskIndex,
} = require("./web-research-eligibility.cjs");
const {
  MIN_MATCH_CONFIDENCE,
  WEB_RESEARCH_SCHEMA_VERSION,
  createSafeUnresolvedResult,
  validateWebResearchResult,
} = require("./web-research-contract.cjs");

const WEB_CUSTOM_ID_PREFIX = "jazamila-cuisine-web-v1";

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function customIdFor(restaurantId, inputFingerprint) {
  const id = Number(restaurantId);
  if (!Number.isInteger(id) || id < 1) throw new Error("restaurantId must be a positive integer");
  if (!/^[a-f0-9]{64}$/u.test(String(inputFingerprint))) throw new Error("inputFingerprint must be a SHA-256 hex string");
  return `${WEB_CUSTOM_ID_PREFIX}:r${id}:f${inputFingerprint}`;
}

function parseCustomId(customId) {
  const match = new RegExp(`^${WEB_CUSTOM_ID_PREFIX}:r([1-9]\\d*):f([a-f0-9]{64})$`, "u").exec(String(customId));
  if (!match) return null;
  return { restaurantId: Number(match[1]), inputFingerprint: match[2] };
}

function restaurantIdFromCustomId(customId) {
  return parseCustomId(customId)?.restaurantId ?? null;
}

function aiResultIndex(records) {
  const index = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || !Number.isInteger(Number(record.restaurantId)) || !/^[a-f0-9]{64}$/u.test(String(record.inputFingerprint))) continue;
    if (record.customId) {
      const parsed = require("../ai/cuisine-classification-pipeline.cjs").parseCustomId(record.customId);
      if (!parsed || parsed.restaurantId !== Number(record.restaurantId) || parsed.inputFingerprint !== record.inputFingerprint) continue;
    }
    if (record.result && (record.status === "ok" || record.status === "unresolved" || record.status === "refusal" || record.status === "invalid" || record.status === "error")) {
      index.set(Number(record.restaurantId), { fingerprint: record.inputFingerprint, result: record.result, status: record.status });
    }
  }
  return index;
}

function requestForStage3Result({ stage3Result, aiResult = null, identityRiskReasons = [], suppliedCuisineTypes, confidenceThreshold, modelVersion, snapshotHash = null }) {
  const restaurantId = Number(stage3Result.restaurantId);
  const inputFingerprint = cleanText(stage3Result.inputFingerprint);
  const input = identityInputForResult(stage3Result);
  const eligibility = classifyWebEligibility({
    stage3Result,
    aiResult,
    identityRiskReasons,
    confidenceThreshold,
  });
  const searchQueries = buildSearchQueries(input);
  const prompt = buildWebResearchPromptBundle({
    name: input.name,
    address: input.address,
    phone: input.phone,
    currentTags: input.currentTags,
    candidateCuisineTypes: suppliedCuisineTypes,
  });
  return {
    customId: customIdFor(restaurantId, inputFingerprint),
    restaurantId,
    inputFingerprint,
    snapshotHash,
    schemaVersion: WEB_RESEARCH_SCHEMA_VERSION,
    promptVersion: WEB_RESEARCH_PROMPT_VERSION,
    modelVersion,
    eligibility,
    input,
    currentTags: input.currentTags,
    candidateCuisineTypes: suppliedCuisineTypes,
    searchQueries,
    knownSourceReferences: input.knownSourceReferences,
    savedSourceCuisineTypes: input.savedSourceCuisineTypes,
    deterministicResult: {
      decisionReason: stage3Result.decisionReason ?? null,
      confidence: stage3Result.confidence ?? null,
      needsAi: stage3Result.needsAi === true,
      needsWebResearch: stage3Result.needsWebResearch === true,
      originalTags: stage3Result.originalTags ?? input.currentTags,
      matchedRules: stage3Result.matchedRules ?? [],
    },
    aiResult,
    userPrompt: prompt.userPrompt,
    userPromptFingerprint: prompt.userPromptFingerprint,
    sourcePolicy: {
      searchSnippetIsNotEvidence: true,
      requireFetchedPageContent: true,
      minimumMatchConfidence: MIN_MATCH_CONFIDENCE,
      sourceTiers: {
        "1": "official website or official menu",
        "2": "official social page",
        "3": "address-identifiable shop page",
        "4": "reliable restaurant platform with name and address",
        "5": "general article; auxiliary only",
      },
    },
  };
}

function buildRequestsFromStage3Report({
  report,
  aiResults = [],
  suppliedCuisineTypes,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
  modelVersion = "unconfigured-web-model",
  limit = null,
}) {
  if (!report || report.mode !== "dry-run" || report.readOnly !== true) throw new Error("phase 3 input must be a read-only dry-run report");
  const types = Array.isArray(suppliedCuisineTypes) ? suppliedCuisineTypes : [];
  if (types.length === 0) throw new Error("active supplied CuisineType export is required");
  const results = Array.isArray(report.results) ? report.results : [];
  const aiIndex = aiResultIndex(aiResults);
  const risks = identityRiskIndex(results);
  const candidates = results.map((stage3Result) => {
    const ai = aiIndex.get(Number(stage3Result.restaurantId));
    const fingerprintMatches = !ai || ai.fingerprint === stage3Result.inputFingerprint;
    if (!fingerprintMatches) throw new Error(`AI result fingerprint mismatch for restaurant ${stage3Result.restaurantId}`);
    const request = requestForStage3Result({
      stage3Result,
      aiResult: ai?.result ?? null,
      identityRiskReasons: [...(risks.get(Number(stage3Result.restaurantId)) ?? [])],
      suppliedCuisineTypes: types,
      confidenceThreshold,
      modelVersion,
      snapshotHash: report.snapshot?.inputHash ?? null,
    });
    return request;
  }).filter((request) => request.eligibility.eligible);
  return limit === null ? candidates : candidates.slice(0, limit);
}

function pendingResultForRequest(request) {
  return {
    mode: "dry-run",
    readOnly: true,
    requestType: "cuisine-web-research",
    customId: request.customId,
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    snapshotHash: request.snapshotHash ?? null,
    sourceReferences: request.knownSourceReferences ?? [],
    savedSourceCuisineTypes: request.savedSourceCuisineTypes ?? [],
    schemaVersion: request.schemaVersion,
    promptVersion: request.promptVersion,
    modelVersion: request.modelVersion,
    status: "pending",
    attempts: 0,
    providerRequestId: null,
    audit: null,
    result: null,
  };
}

function safeErrorMessage(value) {
  return cleanText(value).slice(0, 500);
}

function resultEnvelopeForProviderResult(request, providerResult) {
  const parsed = parseCustomId(providerResult?.customId ?? request.customId);
  const mappingMatches = parsed
    && parsed.restaurantId === request.restaurantId
    && parsed.inputFingerprint === request.inputFingerprint;
  const base = {
    mode: "dry-run",
    readOnly: true,
    requestType: "cuisine-web-research",
    customId: request.customId,
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    snapshotHash: request.snapshotHash ?? null,
    sourceReferences: request.knownSourceReferences ?? [],
    savedSourceCuisineTypes: request.savedSourceCuisineTypes ?? [],
    schemaVersion: request.schemaVersion,
    promptVersion: request.promptVersion,
    modelVersion: request.modelVersion,
    status: providerResult?.status ?? "error",
    attempts: Number(providerResult?.attempts ?? 0),
    providerRequestId: providerResult?.providerRequestId ?? null,
    audit: providerResult?.audit ?? null,
    result: null,
  };
  if (!mappingMatches) {
    return {
      ...base,
      status: "invalid",
      errorCode: "CUSTOM_ID_MISMATCH",
      errorMessage: "provider customId did not map to this restaurant and fingerprint",
      result: createSafeUnresolvedResult({ request, reason: "CUSTOM_ID_MISMATCH" }),
    };
  }
  if (providerResult?.status === "ok") {
    const validation = validateWebResearchResult(providerResult.result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      input: request.input,
      currentTags: request.currentTags,
      searchQueries: request.searchQueries,
      suppliedCuisineTypes: request.candidateCuisineTypes,
      fetchedSources: providerResult.fetchedSources ?? [],
      minMatchConfidence: MIN_MATCH_CONFIDENCE,
    });
    if (validation.success) return { ...base, result: validation.data };
    return {
      ...base,
      status: "invalid",
      errorCode: "WEB_SCHEMA_VALIDATION_FAILED",
      errorMessage: safeErrorMessage(validation.error.issues.map((issue) => issue.message).join("; ")),
      result: createSafeUnresolvedResult({ request, reason: "WEB_SCHEMA_VALIDATION_FAILED" }),
    };
  }
  return {
    ...base,
    status: providerResult?.status ?? "error",
    errorCode: providerResult?.errorCode ?? "WEB_PROVIDER_UNAVAILABLE",
    errorMessage: safeErrorMessage(providerResult?.errorMessage ?? providerResult?.refusal ?? "web research did not return a result"),
    result: createSafeUnresolvedResult({ request, reason: providerResult?.refusal ?? providerResult?.errorCode ?? "WEB_PROVIDER_UNAVAILABLE" }),
  };
}

async function runWebResearchRequests({ requests, provider, resultsPath = null }) {
  if (!provider || typeof provider.research !== "function") throw new Error("provider.research is required");
  const envelopes = [];
  for (const request of requests) {
    const providerResult = await provider.research(request);
    envelopes.push(resultEnvelopeForProviderResult(request, providerResult));
  }
  if (resultsPath) writeJsonl(resultsPath, envelopes);
  return envelopes;
}

function writeJsonl(filePath, records) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  fs.writeFileSync(absolutePath, body ? `${body}\n` : "", "utf8");
  return absolutePath;
}

function readJsonl(filePath) {
  return fs.readFileSync(path.resolve(filePath), "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at line ${index + 1}: ${error instanceof Error ? error.message : error}`, { cause: error });
      }
    });
}

module.exports = {
  DEFAULT_CONFIDENCE_THRESHOLD,
  WEB_CUSTOM_ID_PREFIX,
  WEB_RESEARCH_SCHEMA_VERSION,
  buildRequestsFromStage3Report,
  customIdFor,
  loadSuppliedCuisineTypes,
  parseCustomId,
  pendingResultForRequest,
  readJsonl,
  requestForStage3Result,
  restaurantIdFromCustomId,
  resultEnvelopeForProviderResult,
  runWebResearchRequests,
  writeJsonl,
};
