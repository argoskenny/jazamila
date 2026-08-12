const { z } = require("zod");
const Ajv = require("ajv");
const classificationJsonSchema = require("./cuisine-classification-schema.json");
const { taxonomy } = require("../domain/deterministic-cuisine-classifier.cjs");

const CLASSIFICATION_SCHEMA_VERSION = "cuisine-classification-schema-v1";

const REASON_CODES = [
  "EXPLICIT_CUISINE_TAG",
  "RESTAURANT_NAME_SUPPORTS_TYPE",
  "SOURCE_SUPPORTS_TYPE",
  "LEGACY_FOODTYPE_SUPPORTS_TYPE",
  "AUXILIARY_TAG_ONLY",
  "CONFLICTING_EVIDENCE",
  "INSUFFICIENT_EVIDENCE",
  "CANDIDATE_TYPE_REQUIRED",
  "WEB_RESEARCH_REQUIRED",
  "BRANCH_IDENTITY_UNCERTAIN",
  "TAG_CLEANUP_SUPPORTED",
  "TAG_SYNONYM_NORMALIZED",
  "NO_NEW_MARKETING_TAG",
  "AI_REFUSAL",
  "PROVIDER_OUTPUT_INVALID",
];

const candidateZodSchema = z.object({
  name: z.string().min(1).max(80),
  normalizedName: z.string().min(1).max(80),
  reason: z.string().min(1).max(280),
}).strict();

const classificationZodSchema = z.object({
  restaurantId: z.number().int().positive(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  selectedCuisineTypeId: z.union([z.number().int().positive(), z.null()]),
  selectedCuisineTypeName: z.union([z.string().min(1).max(80), z.null()]),
  proposedNewCuisineType: z.union([candidateZodSchema, z.null()]),
  keptTags: z.array(z.string().min(1).max(80)).max(200).refine((tags) => new Set(tags).size === tags.length, "keptTags must be unique"),
  removedTags: z.array(z.string().min(1).max(80)).max(200).refine((tags) => new Set(tags).size === tags.length, "removedTags must be unique"),
  addedTags: z.array(z.string().min(1).max(80)).max(200).refine((tags) => new Set(tags).size === tags.length, "addedTags must be unique"),
  confidence: z.number().min(0).max(1),
  needsWebResearch: z.boolean(),
  reasonCodes: z.array(z.enum(REASON_CODES)).min(1).max(REASON_CODES.length)
    .refine((codes) => new Set(codes).size === codes.length, "reasonCodes must be unique"),
  shortReason: z.string().min(1).max(280),
}).strict();

const jsonSchemaValidator = new Ajv({ allErrors: true, jsonPointers: true }).compile(classificationJsonSchema);

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[／/\s\-_]+/gu, "");
}

function containsTerm(value, term) {
  const haystack = normalizeKey(value);
  const needle = normalizeKey(term);
  return Boolean(needle) && haystack.includes(needle);
}

function normalizeCuisineName(value) {
  return normalizeKey(value);
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanText).filter(Boolean))];
}

function activeSuppliedCuisineTypes(types) {
  return (Array.isArray(types) ? types : [])
    .filter((type) => type && type.status === "active")
    .map((type) => ({
      id: Number(type.id),
      code: cleanText(type.code),
      name: cleanText(type.name),
      normalizedName: cleanText(type.normalizedName),
      status: "active",
    }))
    .filter((type) => Number.isInteger(type.id) && type.id > 0 && type.name && type.normalizedName)
    .sort((left, right) => left.id - right.id);
}

function auxiliaryDefinitionFor(value) {
  return taxonomy.auxiliaryTags.find((definition) =>
    definition.aliases.some((alias) => containsTerm(value, alias))
  ) ?? null;
}

function canonicalAuxiliaryFor(value) {
  return auxiliaryDefinitionFor(value)?.name ?? null;
}

function cuisineRuleMatchesTag(value) {
  return taxonomy.rules.some((rule) => {
    if (rule.field !== "tag") return false;
    if (rule.excludeTerms?.some((term) => containsTerm(value, term))) return false;
    return rule.terms?.some((term) => containsTerm(value, term));
  });
}

function isCuisineLikeTag(value) {
  const key = normalizeKey(value);
  if (!key) return false;
  if (taxonomy.cuisineTypes.some((type) => normalizeKey(type.name) === key)) return true;
  if (cuisineRuleMatchesTag(value)) return true;
  return taxonomy.ambiguousTerms.some((definition) =>
    definition.terms.some((term) => containsTerm(value, term))
  );
}

function isPureAuxiliaryTag(value) {
  const auxiliary = auxiliaryDefinitionFor(value);
  return Boolean(auxiliary && normalizeKey(auxiliary.name) === normalizeKey(value));
}

function issuesFromZod(error) {
  return error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}

function invalidResult(issues) {
  return {
    success: false,
    error: {
      name: "CuisineClassificationValidationError",
      issues,
    },
  };
}

function validResult(data) {
  return { success: true, data };
}

function validateSchemaOnly(value) {
  const parsed = classificationZodSchema.safeParse(value);
  if (!parsed.success) return invalidResult(issuesFromZod(parsed.error));
  if (!jsonSchemaValidator(parsed.data)) {
    return invalidResult((jsonSchemaValidator.errors ?? []).map((issue) => ({
      path: issue.dataPath ? [issue.dataPath] : [],
      message: issue.message || "JSON Schema validation failed",
    })));
  }
  return validResult(parsed.data);
}

function validateClassificationResult(value, context = {}) {
  const parsed = validateSchemaOnly(value);
  if (!parsed.success) return parsed;
  const result = parsed.data;
  const issues = [];
  const restaurantId = Number(context.restaurantId);
  const inputFingerprint = cleanText(context.inputFingerprint);
  const supplied = activeSuppliedCuisineTypes(context.suppliedCuisineTypes);
  const currentTags = uniqueStrings(context.currentTags);
  const currentTagKeys = new Set(currentTags.map(normalizeKey));
  const addedTagKeys = new Set(result.addedTags.map(normalizeKey));
  const keptTagKeys = new Set(result.keptTags.map(normalizeKey));
  const removedTagKeys = new Set(result.removedTags.map(normalizeKey));

  if (Number.isInteger(restaurantId) && restaurantId > 0 && result.restaurantId !== restaurantId) {
    issues.push({ path: ["restaurantId"], message: "restaurantId does not match the request" });
  }
  if (inputFingerprint && result.inputFingerprint !== inputFingerprint) {
    issues.push({ path: ["inputFingerprint"], message: "inputFingerprint does not match the request" });
  }

  if (result.selectedCuisineTypeId === null && result.selectedCuisineTypeName !== null) {
    issues.push({ path: ["selectedCuisineTypeName"], message: "name must be null when no supplied type is selected" });
  }
  if (result.selectedCuisineTypeId !== null && result.proposedNewCuisineType !== null) {
    issues.push({ path: ["selectedCuisineTypeId", "proposedNewCuisineType"], message: "selected type and candidate type are mutually exclusive" });
  }
  if (result.selectedCuisineTypeId !== null) {
    const selected = supplied.find((type) => type.id === result.selectedCuisineTypeId);
    if (!selected) {
      issues.push({ path: ["selectedCuisineTypeId"], message: "selected type is not an active supplied CuisineType" });
    } else if (normalizeCuisineName(selected.name) !== normalizeCuisineName(result.selectedCuisineTypeName)) {
      issues.push({ path: ["selectedCuisineTypeName"], message: "selected type name does not match the supplied CuisineType" });
    }
  }

  if (result.proposedNewCuisineType) {
    const candidate = result.proposedNewCuisineType;
    const normalizedName = normalizeCuisineName(candidate.name);
    if (normalizedName !== normalizeCuisineName(candidate.normalizedName)) {
      issues.push({ path: ["proposedNewCuisineType", "normalizedName"], message: "normalizedName does not normalize name" });
    }
    if (supplied.some((type) => normalizeCuisineName(type.name) === normalizedName || normalizeCuisineName(type.normalizedName) === normalizedName)) {
      issues.push({ path: ["proposedNewCuisineType"], message: "candidate duplicates an existing CuisineType" });
    }
    if (isPureAuxiliaryTag(candidate.name) || isCuisineLikeTag(candidate.name)) {
      issues.push({ path: ["proposedNewCuisineType", "name"], message: "candidate is a cuisine item, existing cuisine term, or auxiliary tag rather than a new stable type" });
    }
    if (!result.reasonCodes.includes("CANDIDATE_TYPE_REQUIRED")) {
      issues.push({ path: ["reasonCodes"], message: "candidate requires CANDIDATE_TYPE_REQUIRED" });
    }
  }

  if (result.needsWebResearch && !result.reasonCodes.includes("WEB_RESEARCH_REQUIRED")) {
    issues.push({ path: ["reasonCodes"], message: "needsWebResearch requires WEB_RESEARCH_REQUIRED" });
  }
  if (!result.needsWebResearch && result.reasonCodes.includes("WEB_RESEARCH_REQUIRED")) {
    issues.push({ path: ["reasonCodes"], message: "WEB_RESEARCH_REQUIRED requires needsWebResearch=true" });
  }
  if (result.selectedCuisineTypeId === null && result.proposedNewCuisineType === null && !result.needsWebResearch) {
    issues.push({ path: ["needsWebResearch"], message: "an unresolved restaurant must request web research rather than silently remain undecided" });
  }

  for (const tag of result.keptTags) {
    const key = normalizeKey(tag);
    if (isCuisineLikeTag(tag)) {
      issues.push({ path: ["keptTags", tag], message: "cuisine or cuisine-item text cannot remain as an auxiliary tag" });
    }
    if (!currentTagKeys.has(key)) {
      const canonical = canonicalAuxiliaryFor(tag);
      const hasEvidence = canonical !== null && currentTags.some((currentTag) => canonicalAuxiliaryFor(currentTag) === canonical);
      if (!hasEvidence || !addedTagKeys.has(key)) {
        issues.push({ path: ["keptTags", tag], message: "kept tag is not present in the input or explicitly evidenced as a normalized tag" });
      }
    }
  }

  for (const tag of result.removedTags) {
    const key = normalizeKey(tag);
    if (!currentTagKeys.has(key)) {
      issues.push({ path: ["removedTags", tag], message: "removed tag was not present in the input" });
    }
    if (isPureAuxiliaryTag(tag)) {
      issues.push({ path: ["removedTags", tag], message: "pure auxiliary tag cannot be removed as cuisine" });
    }
  }

  for (const tag of result.addedTags) {
    const key = normalizeKey(tag);
    if (currentTagKeys.has(key) || !keptTagKeys.has(key)) {
      issues.push({ path: ["addedTags", tag], message: "added tag must be new and present in keptTags" });
    }
    const canonical = canonicalAuxiliaryFor(tag);
    const hasEvidence = canonical !== null && currentTags.some((currentTag) => canonicalAuxiliaryFor(currentTag) === canonical);
    if (!hasEvidence) {
      issues.push({ path: ["addedTags", tag], message: "added tag has no explicit input tag evidence" });
    }
    if (isCuisineLikeTag(tag)) {
      issues.push({ path: ["addedTags", tag], message: "cuisine or cuisine-item text cannot be added as an auxiliary tag" });
    }
  }

  if (keptTagKeys.size && removedTagKeys.size) {
    for (const key of keptTagKeys) {
      if (removedTagKeys.has(key)) {
        issues.push({ path: ["keptTags"], message: "a tag cannot be both kept and removed" });
        break;
      }
    }
  }

  for (const currentTag of currentTags) {
    const key = normalizeKey(currentTag);
    if (!keptTagKeys.has(key) && !removedTagKeys.has(key)) {
      issues.push({ path: ["keptTags", "removedTags"], message: `input tag is neither kept nor removed: ${currentTag}` });
    }
  }

  if (result.addedTags.length > 0 && !result.reasonCodes.includes("TAG_SYNONYM_NORMALIZED")) {
    issues.push({ path: ["reasonCodes"], message: "added normalized tags require TAG_SYNONYM_NORMALIZED" });
  }
  if (result.removedTags.length > 0 && !result.reasonCodes.includes("TAG_CLEANUP_SUPPORTED")) {
    issues.push({ path: ["reasonCodes"], message: "removed tags require TAG_CLEANUP_SUPPORTED" });
  }

  return issues.length > 0 ? invalidResult(issues) : validResult(result);
}

function createSafeRefusalResult({
  restaurantId,
  inputFingerprint,
  deterministicResult = null,
  reasonCode = "AI_REFUSAL",
  shortReason = "AI 無法產生可驗證的分類結果，保留人工或網路查核。",
}) {
  const keptTags = uniqueStrings(deterministicResult?.keptAuxiliaryTags);
  const removedTags = uniqueStrings(deterministicResult?.removedCuisineTags);
  const reasonCodes = [
    reasonCode,
    "AI_REFUSAL",
    "WEB_RESEARCH_REQUIRED",
    ...(removedTags.length > 0 ? ["TAG_CLEANUP_SUPPORTED"] : []),
  ]
    .filter((code, index, codes) => REASON_CODES.includes(code) && codes.indexOf(code) === index);
  return {
    restaurantId: Number(restaurantId),
    inputFingerprint: cleanText(inputFingerprint),
    selectedCuisineTypeId: null,
    selectedCuisineTypeName: null,
    proposedNewCuisineType: null,
    keptTags,
    removedTags,
    addedTags: [],
    confidence: 0,
    needsWebResearch: true,
    reasonCodes,
    shortReason: cleanText(shortReason).slice(0, 280) || "AI 無法產生可驗證的分類結果。",
  };
}

module.exports = {
  CLASSIFICATION_SCHEMA_VERSION,
  REASON_CODES,
  classificationJsonSchema,
  classificationZodSchema,
  createSafeRefusalResult,
  normalizeCuisineName,
  validateClassificationResult,
  validateSchemaOnly,
};
