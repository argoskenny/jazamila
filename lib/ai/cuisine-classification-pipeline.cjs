const fs = require("node:fs");
const path = require("node:path");
const {
  CLASSIFICATION_SCHEMA_VERSION,
  classificationJsonSchema,
  createSafeRefusalResult,
  validateClassificationResult,
} = require("./cuisine-classification-contract.cjs");
const { PROMPT_VERSION, buildPromptBundle } = require("./cuisine-classification-prompts.cjs");

const CUSTOM_ID_PREFIX = "jazamila-cuisine-ai-v1";

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function uniqueText(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value);
    const key = text.toLocaleLowerCase("en-US");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function customIdFor(restaurantId, inputFingerprint) {
  const id = Number(restaurantId);
  if (!Number.isInteger(id) || id < 1) throw new Error("restaurantId must be a positive integer");
  if (!/^[a-f0-9]{64}$/u.test(String(inputFingerprint))) throw new Error("inputFingerprint must be a SHA-256 hex string");
  return `${CUSTOM_ID_PREFIX}:r${id}:f${inputFingerprint}`;
}

function parseCustomId(customId) {
  const match = new RegExp(`^${CUSTOM_ID_PREFIX}:r([1-9]\\d*):f([a-f0-9]{64})$`, "u").exec(String(customId));
  if (!match) return null;
  return {
    restaurantId: Number(match[1]),
    inputFingerprint: match[2],
  };
}

function restaurantIdFromCustomId(customId) {
  return parseCustomId(customId)?.restaurantId ?? null;
}

function normalizeSuppliedCuisineTypes(rawTypes) {
  if (!Array.isArray(rawTypes)) throw new Error("cuisine type export must contain a cuisineTypes array");
  const active = rawTypes
    .filter((type) => type && type.status === "active")
    .map((type) => ({
      id: Number(type.id),
      code: cleanText(type.code),
      name: cleanText(type.name),
      normalizedName: cleanText(type.normalizedName),
      status: "active",
    }));
  if (active.some((type) => !Number.isInteger(type.id) || type.id < 1 || !type.name || !type.normalizedName)) {
    throw new Error("every active supplied CuisineType must have a positive id, name, and normalizedName");
  }
  if (new Set(active.map((type) => type.id)).size !== active.length) throw new Error("supplied CuisineType ids must be unique");
  if (new Set(active.map((type) => type.normalizedName)).size !== active.length) throw new Error("supplied CuisineType normalizedName values must be unique");
  if (active.length === 0) throw new Error("no active supplied CuisineType is available");
  return active.sort((left, right) => left.id - right.id);
}

function loadSuppliedCuisineTypes(filePath) {
  const absolutePath = path.resolve(filePath);
  const document = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const rawTypes = Array.isArray(document) ? document : document?.cuisineTypes;
  return normalizeSuppliedCuisineTypes(rawTypes);
}

function inputForStage3Result(result) {
  if (!result || !result.aiInput || typeof result.aiInput !== "object") {
    throw new Error("phase 3 report is missing aiInput; rerun the deterministic dry-run with the current report format");
  }
  const aiInput = result.aiInput;
  const currentTags = uniqueText(aiInput.currentTags ?? result.originalTags);
  const knownSourceReferences = Array.isArray(aiInput.knownSourceReferences)
    ? aiInput.knownSourceReferences
    : Array.isArray(result.sourceRefs) ? result.sourceRefs : [];
  return {
    name: cleanText(aiInput.name),
    address: cleanText(aiInput.address),
    phone: cleanText(aiInput.phone),
    currentFoodType: Number(aiInput.currentFoodType ?? result.originalFoodType ?? 0),
    currentTags,
    knownSourceReferences,
    savedSourceCuisineTypes: uniqueText(aiInput.savedSourceCuisineTypes ?? result.savedSourceCuisineTypes),
  };
}

function requestForStage3Result(result, suppliedCuisineTypes, modelVersion, snapshotHash = null) {
  const restaurantId = Number(result.restaurantId);
  const inputFingerprint = cleanText(result.inputFingerprint);
  const input = inputForStage3Result(result);
  const customId = customIdFor(restaurantId, inputFingerprint);
  const prompt = buildPromptBundle({
    restaurantId,
    ...input,
    suppliedCuisineTypes,
  });
  const requestBody = {
    model: modelVersion,
    user: customId,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "restaurant_cuisine_classification",
        strict: true,
        schema: classificationJsonSchema,
      },
    },
  };
  return {
    customId,
    restaurantId,
    inputFingerprint,
    snapshotHash,
    taxonomyVersion: cleanText(result.taxonomyVersion),
    classificationSchemaVersion: CLASSIFICATION_SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
    modelVersion,
    input,
    suppliedCuisineTypes,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    systemPromptFingerprint: prompt.systemPromptFingerprint,
    userPromptFingerprint: prompt.userPromptFingerprint,
    requestBody,
  };
}

function buildRequestsFromStage3Report({ report, suppliedCuisineTypes, modelVersion = "unconfigured-model", limit = null }) {
  if (!report || report.mode !== "dry-run" || report.readOnly !== true) {
    throw new Error("phase 3 input must be a read-only dry-run report");
  }
  const types = normalizeSuppliedCuisineTypes(suppliedCuisineTypes);
  const results = Array.isArray(report.results) ? report.results : [];
  const aiResults = results.filter((result) => result?.needsAi === true);
  const selected = limit === null ? aiResults : aiResults.slice(0, limit);
  const snapshotHash = report.snapshot?.inputHash ?? null;
  return selected.map((result) => requestForStage3Result(result, types, modelVersion, snapshotHash));
}

function pendingResultForRequest(request) {
  return {
    mode: "dry-run",
    readOnly: true,
    customId: request.customId,
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    snapshotHash: request.snapshotHash ?? null,
    sourceReferences: request.input.knownSourceReferences ?? [],
    savedSourceCuisineTypes: request.input.savedSourceCuisineTypes ?? [],
    promptVersion: request.promptVersion,
    modelVersion: request.modelVersion,
    status: "pending",
    attempts: 0,
    providerRequestId: null,
    result: null,
  };
}

function safeErrorMessage(value) {
  return cleanText(value).slice(0, 280);
}

function resultEnvelopeForProviderResult(request, providerResult, deterministicResult = null) {
  const parsedCustomId = parseCustomId(providerResult?.customId ?? request.customId);
  const mappingMatches = parsedCustomId
    && parsedCustomId.restaurantId === request.restaurantId
    && parsedCustomId.inputFingerprint === request.inputFingerprint;
  const base = {
    mode: "dry-run",
    readOnly: true,
    customId: request.customId,
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    snapshotHash: request.snapshotHash ?? null,
    sourceReferences: request.input.knownSourceReferences ?? [],
    savedSourceCuisineTypes: request.input.savedSourceCuisineTypes ?? [],
    promptVersion: request.promptVersion,
    modelVersion: request.modelVersion,
    status: providerResult?.status ?? "error",
    attempts: Number(providerResult?.attempts ?? 0),
    providerRequestId: providerResult?.providerRequestId ?? null,
    result: null,
  };

  if (!mappingMatches) {
    return {
      ...base,
      status: "invalid",
      errorCode: "CUSTOM_ID_MISMATCH",
      errorMessage: "provider customId did not map back to the requested restaurant",
      result: createSafeRefusalResult({
        restaurantId: request.restaurantId,
        inputFingerprint: request.inputFingerprint,
        deterministicResult,
        reasonCode: "PROVIDER_OUTPUT_INVALID",
      }),
    };
  }

  if (providerResult?.status === "ok") {
    const validation = validateClassificationResult(providerResult.result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      suppliedCuisineTypes: request.suppliedCuisineTypes,
      currentTags: request.input.currentTags,
    });
    if (validation.success) return { ...base, status: "ok", result: validation.data };
    return {
      ...base,
      status: "invalid",
      errorCode: "SCHEMA_VALIDATION_FAILED",
      errorMessage: safeErrorMessage(validation.error.issues.map((issue) => issue.message).join("; ")),
      result: createSafeRefusalResult({
        restaurantId: request.restaurantId,
        inputFingerprint: request.inputFingerprint,
        deterministicResult,
        reasonCode: "PROVIDER_OUTPUT_INVALID",
      }),
    };
  }

  const reasonCode = providerResult?.status === "refusal" ? "AI_REFUSAL" : "PROVIDER_OUTPUT_INVALID";
  return {
    ...base,
    status: providerResult?.status ?? "error",
    errorCode: providerResult?.errorCode ?? (providerResult?.status === "refusal" ? "MODEL_REFUSAL" : "PROVIDER_ERROR"),
    errorMessage: safeErrorMessage(providerResult?.errorMessage ?? providerResult?.refusal ?? "provider did not return a usable result"),
    result: createSafeRefusalResult({
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      deterministicResult,
      reasonCode,
      shortReason: providerResult?.refusal || undefined,
    }),
  };
}

async function runProviderRequests({ requests, provider, deterministicResultsByRestaurantId = new Map(), resultsPath = null }) {
  if (!provider || typeof provider.classify !== "function") throw new Error("provider.classify is required");
  const envelopes = [];
  for (const request of requests) {
    const providerResult = await provider.classify({
      customId: request.customId,
      promptVersion: request.promptVersion,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      responseSchema: classificationJsonSchema,
      validationContext: {
        restaurantId: request.restaurantId,
        inputFingerprint: request.inputFingerprint,
        suppliedCuisineTypes: request.suppliedCuisineTypes,
        currentTags: request.input.currentTags,
      },
      validateResult: validateClassificationResult,
    });
    envelopes.push(resultEnvelopeForProviderResult(
      request,
      providerResult,
      deterministicResultsByRestaurantId.get(request.restaurantId) ?? null,
    ));
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
  CLASSIFICATION_SCHEMA_VERSION,
  CUSTOM_ID_PREFIX,
  buildRequestsFromStage3Report,
  customIdFor,
  inputForStage3Result,
  loadSuppliedCuisineTypes,
  normalizeSuppliedCuisineTypes,
  parseCustomId,
  pendingResultForRequest,
  requestForStage3Result,
  restaurantIdFromCustomId,
  resultEnvelopeForProviderResult,
  runProviderRequests,
  readJsonl,
  writeJsonl,
};
