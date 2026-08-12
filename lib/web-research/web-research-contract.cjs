const { z } = require("zod");
const Ajv = require("ajv");
const webResearchJsonSchema = require("./web-research-schema.json");
const { taxonomy } = require("../domain/deterministic-cuisine-classifier.cjs");
const {
  normalizeSuppliedCuisineTypes,
} = require("../ai/cuisine-classification-pipeline.cjs");
const {
  cleanText,
  normalizeKey,
  normalizePhone,
  uniqueText,
} = require("./web-research-eligibility.cjs");
const { normalizeUrl, sha256 } = require("./web-research-sources.cjs");

const WEB_RESEARCH_SCHEMA_VERSION = "cuisine-web-research-schema-v1";
const MIN_MATCH_CONFIDENCE = 0.8;

const selectedCuisineTypeSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(80),
  normalizedName: z.string().min(1).max(80),
  status: z.literal("active"),
}).strict();

const proposedCuisineTypeSchema = z.object({
  name: z.string().min(1).max(80),
  normalizedName: z.string().min(1).max(80),
  reason: z.string().min(1).max(280),
}).strict();

const evidenceSchema = z.object({
  url: z.string().regex(/^https?:\/\/[^\s]+$/u).max(2000),
  title: z.string().min(1).max(300),
  sourceTier: z.number().int().refine((tier) => tier >= 1 && tier <= 5),
  sourceKind: z.string().min(1).max(80),
  matchedName: z.union([z.string().min(1).max(200), z.null()]),
  matchedAddress: z.union([z.string().min(1).max(300), z.null()]),
  matchedPhone: z.union([z.string().min(1).max(80), z.null()]),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  supportedTags: z.array(z.string().min(1).max(80)).refine((tags) => new Set(tags).size === tags.length),
  cuisineSignals: z.array(z.string().min(1).max(200)).refine((signals) => new Set(signals).size === signals.length),
}).strict();

const webResearchZodSchema = z.object({
  restaurantId: z.number().int().positive(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  searchQueries: z.array(z.string().min(1).max(500)).refine((queries) => new Set(queries).size === queries.length),
  matchedName: z.union([z.string().min(1).max(200), z.null()]),
  matchedAddress: z.union([z.string().min(1).max(300), z.null()]),
  matchedPhone: z.union([z.string().min(1).max(80), z.null()]),
  selectedCuisineType: z.union([selectedCuisineTypeSchema, z.null()]),
  proposedNewCuisineType: z.union([proposedCuisineTypeSchema, z.null()]),
  keptTags: z.array(z.string().min(1).max(80)).refine((tags) => new Set(tags).size === tags.length),
  removedTags: z.array(z.string().min(1).max(80)).refine((tags) => new Set(tags).size === tags.length),
  addedTags: z.array(z.string().min(1).max(80)).refine((tags) => new Set(tags).size === tags.length),
  confidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().regex(/^https?:\/\/[^\s]+$/u).max(2000)).refine((urls) => new Set(urls).size === urls.length),
  evidenceTitles: z.array(z.string().min(1).max(300)).refine((titles) => new Set(titles).size === titles.length),
  checkedAt: z.string().datetime({ offset: true }),
  matchConfidence: z.number().min(0).max(1),
  unresolvedReason: z.union([z.string().min(1).max(500), z.null()]),
  evidence: z.array(evidenceSchema).refine((sources) => new Set(sources.map((source) => source.url)).size === sources.length),
}).strict();

const jsonSchemaValidator = new Ajv({ allErrors: true, jsonPointers: true }).compile(webResearchJsonSchema);

function issuesFromZod(error) {
  return error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
}

function invalidResult(issues) {
  return {
    success: false,
    error: { name: "WebResearchValidationError", issues },
  };
}

function validResult(data) {
  return { success: true, data };
}

function validateSchemaOnly(value) {
  const parsed = webResearchZodSchema.safeParse(value);
  if (!parsed.success) return invalidResult(issuesFromZod(parsed.error));
  if (!jsonSchemaValidator(parsed.data)) {
    return invalidResult((jsonSchemaValidator.errors ?? []).map((issue) => ({
      path: issue.dataPath ? [issue.dataPath] : [],
      message: issue.message || "JSON Schema validation failed",
    })));
  }
  return validResult(parsed.data);
}

function containsTerm(value, term) {
  const haystack = normalizeKey(value);
  const needle = normalizeKey(term);
  return Boolean(needle) && haystack.includes(needle);
}

function auxiliaryDefinitionFor(value) {
  return taxonomy.auxiliaryTags.find((definition) =>
    definition.aliases.some((alias) => containsTerm(value, alias))
  ) ?? null;
}

function isPureAuxiliary(value) {
  const definition = auxiliaryDefinitionFor(value);
  return Boolean(definition && normalizeKey(definition.name) === normalizeKey(value));
}

function isCuisineLike(value) {
  const key = normalizeKey(value);
  if (!key) return false;
  if (taxonomy.cuisineTypes.some((type) => normalizeKey(type.name) === key)) return true;
  if (taxonomy.rules.some((rule) => rule.field === "tag"
    && !rule.excludeTerms?.some((term) => containsTerm(value, term))
    && rule.terms?.some((term) => containsTerm(value, term)))) return true;
  return taxonomy.ambiguousTerms.some((definition) => definition.terms.some((term) => containsTerm(value, term)));
}

function validateTags(result, context, resolved, selectedEvidence) {
  const issues = [];
  const currentTags = uniqueText(context.currentTags);
  const currentKeys = new Set(currentTags.map(normalizeKey));
  const keptKeys = new Set(result.keptTags.map(normalizeKey));
  const removedKeys = new Set(result.removedTags.map(normalizeKey));
  const addedKeys = new Set(result.addedTags.map(normalizeKey));

  for (const tag of result.keptTags) {
    if (resolved && isCuisineLike(tag)) {
      issues.push({ path: ["keptTags", tag], message: "resolved result cannot keep cuisine or cuisine-item text as an auxiliary tag" });
    }
    if (!currentKeys.has(normalizeKey(tag)) && !addedKeys.has(normalizeKey(tag))) {
      issues.push({ path: ["keptTags", tag], message: "kept tag is neither an original tag nor an evidenced added tag" });
    }
  }
  for (const tag of result.removedTags) {
    if (!currentKeys.has(normalizeKey(tag))) issues.push({ path: ["removedTags", tag], message: "removed tag was not in the original tags" });
    if (isPureAuxiliary(tag)) issues.push({ path: ["removedTags", tag], message: "pure auxiliary tags cannot be removed" });
  }
  const supportedTags = new Set(selectedEvidence.flatMap((source) => source.supportedTags ?? []).map(normalizeKey));
  for (const tag of result.addedTags) {
    const key = normalizeKey(tag);
    if (currentKeys.has(key) || !keptKeys.has(key)) issues.push({ path: ["addedTags", tag], message: "added tag must be new and present in keptTags" });
    const definition = auxiliaryDefinitionFor(tag);
    if (!definition || !supportedTags.has(normalizeKey(definition.name))) {
      issues.push({ path: ["addedTags", tag], message: "added tag is not an allowed auxiliary tag explicitly supported by evidence" });
    }
    if (isCuisineLike(tag)) issues.push({ path: ["addedTags", tag], message: "cuisine or cuisine-item text cannot be added as a tag" });
  }
  for (const tag of currentTags) {
    const key = normalizeKey(tag);
    if (!keptKeys.has(key) && !removedKeys.has(key)) {
      issues.push({ path: ["keptTags", "removedTags"], message: `original tag is neither kept nor removed: ${tag}` });
    }
  }
  for (const key of keptKeys) {
    if (removedKeys.has(key)) {
      issues.push({ path: ["keptTags", "removedTags"], message: "a tag cannot be both kept and removed" });
      break;
    }
  }
  return issues;
}

function validateIdentity(result, context, selectedSources) {
  const issues = [];
  const input = context.input ?? {};
  const inputName = cleanText(input.name);
  const inputAddress = cleanText(input.address);
  const inputPhone = normalizePhone(input.phone);
  const nameMatches = normalizeKey(result.matchedName) === normalizeKey(inputName);
  const addressMatches = normalizeKey(result.matchedAddress) === normalizeKey(inputAddress);
  const phoneMatches = inputPhone
    ? normalizePhone(result.matchedPhone) === inputPhone
    : result.matchedPhone === null;
  if (!result.matchedName || !nameMatches) issues.push({ path: ["matchedName"], message: "matchedName must equal the requested restaurant identity" });
  if (!result.matchedAddress || !addressMatches) issues.push({ path: ["matchedAddress"], message: "matchedAddress must equal the requested address" });
  if (!phoneMatches) issues.push({ path: ["matchedPhone"], message: "matchedPhone does not match the requested phone" });
  const sourceConfirmsIdentity = selectedSources.some((source) => {
    const identity = source.identityMatch ?? {};
    return identity.name && identity.address && (!inputPhone || identity.phone);
  });
  if (!sourceConfirmsIdentity) issues.push({ path: ["evidence"], message: "no fetched source confirms the same name and address" });
  if (result.matchConfidence < Number(context.minMatchConfidence ?? MIN_MATCH_CONFIDENCE)) {
    issues.push({ path: ["matchConfidence"], message: "identity match confidence is below the required threshold" });
  }
  return issues;
}

function validateEvidence(result, context) {
  const issues = [];
  const fetched = new Map((Array.isArray(context.fetchedSources) ? context.fetchedSources : [])
    .map((source) => [normalizeUrl(source.url), source]));
  if (result.evidenceUrls.length !== result.evidenceTitles.length || result.evidenceUrls.length !== result.evidence.length) {
    issues.push({ path: ["evidence"], message: "evidenceUrls, evidenceTitles, and evidence must be aligned" });
  }
  const selectedSources = [];
  for (let index = 0; index < result.evidence.length; index += 1) {
    const outputEvidence = result.evidence[index];
    const url = normalizeUrl(outputEvidence.url);
    const source = fetched.get(url);
    if (!source || source.fetched !== true || !source.contentHash || !cleanText(source.content)) {
      issues.push({ path: ["evidence", index], message: "evidence must refer to a successfully fetched page, not a search snippet" });
      continue;
    }
    if (source.content && sha256(source.content) !== source.contentHash) {
      issues.push({ path: ["evidence", index], message: "fetched source contentHash is not self-consistent" });
    }
    selectedSources.push(source);
    if (url !== normalizeUrl(result.evidenceUrls[index])) issues.push({ path: ["evidenceUrls", index], message: "evidence URL does not match evidence object" });
    if (outputEvidence.title !== result.evidenceTitles[index] || outputEvidence.title !== source.title) {
      issues.push({ path: ["evidenceTitles", index], message: "evidence title does not match the fetched source" });
    }
    if (outputEvidence.sourceTier !== source.sourceTier || outputEvidence.sourceKind !== source.sourceKind) {
      issues.push({ path: ["evidence", index], message: "source tier or source kind does not match the fetched source" });
    }
    if (normalizeKey(outputEvidence.matchedName) !== normalizeKey(source.matchedName)
      || normalizeKey(outputEvidence.matchedAddress) !== normalizeKey(source.matchedAddress)
      || normalizePhone(outputEvidence.matchedPhone) !== normalizePhone(source.matchedPhone)) {
      issues.push({ path: ["evidence", index], message: "evidence identity fields do not match the fetched source" });
    }
    if (outputEvidence.contentHash !== source.contentHash) issues.push({ path: ["evidence", index], message: "contentHash does not match the fetched page" });
    if (!outputEvidence.supportedTags.every((tag) => (source.supportedTags ?? []).map(normalizeKey).includes(normalizeKey(tag)))) {
      issues.push({ path: ["evidence", index, "supportedTags"], message: "supported tag is not present in fetched source metadata" });
    }
    if (!outputEvidence.cuisineSignals.every((signal) => (source.cuisineSignals ?? []).includes(signal))) {
      issues.push({ path: ["evidence", index, "cuisineSignals"], message: "cuisine signal is not present in fetched source metadata" });
    }
  }
  const authoritative = (Array.isArray(context.fetchedSources) ? context.fetchedSources : [])
    .filter((source) => source.sourceTier <= 2 && source.identityMatch?.name && source.identityMatch?.address && source.cuisineSignals?.length > 0);
  if (authoritative.length > 0 && !selectedSources.some((source) => source.sourceTier <= 2)) {
    issues.push({ path: ["evidence"], message: "a lower-tier source cannot override available official cuisine evidence" });
  }
  return { issues, selectedSources };
}

function validateCuisineSelection(result, context) {
  const issues = [];
  const supplied = normalizeSuppliedCuisineTypes(context.suppliedCuisineTypes);
  if (result.selectedCuisineType) {
    const selected = supplied.find((type) => type.id === result.selectedCuisineType.id);
    if (!selected) issues.push({ path: ["selectedCuisineType"], message: "selected cuisine is not an active supplied type" });
    else if (normalizeKey(selected.name) !== normalizeKey(result.selectedCuisineType.name)
      || normalizeKey(selected.normalizedName) !== normalizeKey(result.selectedCuisineType.normalizedName)) {
      issues.push({ path: ["selectedCuisineType"], message: "selected cuisine name does not match supplied type" });
    }
  }
  if (result.proposedNewCuisineType) {
    const candidate = result.proposedNewCuisineType;
    if (normalizeKey(candidate.name) !== normalizeKey(candidate.normalizedName)) {
      issues.push({ path: ["proposedNewCuisineType"], message: "candidate normalizedName does not normalize name" });
    }
    if (supplied.some((type) => normalizeKey(type.name) === normalizeKey(candidate.name) || normalizeKey(type.normalizedName) === normalizeKey(candidate.normalizedName))) {
      issues.push({ path: ["proposedNewCuisineType"], message: "candidate duplicates an existing type" });
    }
    if (isCuisineLike(candidate.name) || isPureAuxiliary(candidate.name)) {
      issues.push({ path: ["proposedNewCuisineType"], message: "candidate is a cuisine item, existing cuisine term, or auxiliary tag" });
    }
  }
  return issues;
}

function validateWebResearchResult(value, context = {}) {
  const parsed = validateSchemaOnly(value);
  if (!parsed.success) return parsed;
  const result = parsed.data;
  const issues = [];
  if (Number(result.restaurantId) !== Number(context.restaurantId)) issues.push({ path: ["restaurantId"], message: "restaurantId does not match request" });
  if (context.inputFingerprint && result.inputFingerprint !== context.inputFingerprint) issues.push({ path: ["inputFingerprint"], message: "inputFingerprint does not match request" });
  if (Array.isArray(context.searchQueries) && JSON.stringify(result.searchQueries) !== JSON.stringify(context.searchQueries)) {
    issues.push({ path: ["searchQueries"], message: "searchQueries must be the identity-bound queries issued by the workflow" });
  }

  const evidenceResult = validateEvidence(result, context);
  issues.push(...evidenceResult.issues);
  const resolved = Boolean(result.selectedCuisineType || result.proposedNewCuisineType);
  if (!resolved) {
    if (result.matchedName !== null || result.matchedAddress !== null || result.matchedPhone !== null) {
      issues.push({ path: ["matchedName", "matchedAddress", "matchedPhone"], message: "unresolved results cannot claim an identity match" });
    }
    if (result.confidence !== 0 || result.matchConfidence !== 0) issues.push({ path: ["confidence", "matchConfidence"], message: "unresolved results must have zero confidence" });
    if (!result.unresolvedReason) issues.push({ path: ["unresolvedReason"], message: "unresolved results require a reason" });
  } else {
    if (result.unresolvedReason !== null) issues.push({ path: ["unresolvedReason"], message: "resolved results cannot contain unresolvedReason" });
    if (result.evidenceUrls.length === 0) issues.push({ path: ["evidenceUrls"], message: "resolved results require traceable evidence" });
    issues.push(...validateIdentity(result, context, evidenceResult.selectedSources));
  }
  issues.push(...validateCuisineSelection(result, context));
  issues.push(...validateTags(result, context, resolved, evidenceResult.selectedSources));
  return issues.length > 0 ? invalidResult(issues) : validResult(result);
}

function createSafeUnresolvedResult({ request, checkedAt = new Date().toISOString(), reason = "NO_CONFIRMED_SOURCE" }) {
  return {
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    searchQueries: request.searchQueries,
    matchedName: null,
    matchedAddress: null,
    matchedPhone: null,
    selectedCuisineType: null,
    proposedNewCuisineType: null,
    keptTags: uniqueText(request.input.currentTags),
    removedTags: [],
    addedTags: [],
    confidence: 0,
    evidenceUrls: [],
    evidenceTitles: [],
    checkedAt,
    matchConfidence: 0,
    unresolvedReason: cleanText(reason),
    evidence: [],
  };
}

module.exports = {
  MIN_MATCH_CONFIDENCE,
  WEB_RESEARCH_SCHEMA_VERSION,
  createSafeUnresolvedResult,
  validateSchemaOnly,
  validateWebResearchResult,
  webResearchJsonSchema,
  webResearchZodSchema,
};
