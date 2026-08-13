const crypto = require("node:crypto");
const {
  candidateKeyFor,
  normalizeCandidateName,
  normalizedActiveCuisineTypes,
} = require("./cuisine-candidate-review.cjs");
const {
  fingerprintForInput,
  parseSourceRefs,
  taxonomy,
} = require("./deterministic-cuisine-classifier.cjs");

const CUISINE_APPLY_VERSION = "cuisine-apply-v1";
const MANUAL_TAG_FIELDS = new Set(["tag", "tags", "restaurantTag", "restaurantTags"]);
const MANUAL_CUISINE_FIELDS = new Set(["cuisine", "cuisineType", "cuisineTypeId", "foodType"]);

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
    const key = normalizeCandidateName(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function parseManualOverrideFields(value) {
  if (!value) return new Set();
  try {
    const parsed = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((field) => typeof field === "string") : []);
  } catch {
    return new Set();
  }
}

function isTagLocked(fields) {
  return [...fields].some((field) => MANUAL_TAG_FIELDS.has(field));
}

function isCuisineLocked(fields) {
  return [...fields].some((field) => MANUAL_CUISINE_FIELDS.has(field));
}

function tagFromRelation(relation) {
  return {
    tagId: Number(relation.tagId),
    name: cleanText(relation.tag?.name ?? relation.name),
    normalizedName: cleanText(relation.tag?.normalizedName ?? relation.normalizedName) || normalizeCandidateName(relation.tag?.name ?? relation.name),
    position: Number(relation.position ?? 0),
    owner: cleanText(relation.owner) || "source",
    sourceName: relation.sourceName == null ? null : cleanText(relation.sourceName),
    kind: cleanText(relation.kind) || "auxiliary",
    isPublic: relation.isPublic !== false,
    visibilityReason: relation.visibilityReason == null ? null : cleanText(relation.visibilityReason),
  };
}

function snapshotForRestaurant(restaurant) {
  const tags = (Array.isArray(restaurant.tags) ? restaurant.tags : [])
    .map(tagFromRelation)
    .filter((tag) => tag.name && tag.normalizedName)
    .sort((left, right) => left.position - right.position || left.tagId - right.tagId);
  return {
    cuisineTypeId: restaurant.cuisineTypeId == null ? null : Number(restaurant.cuisineTypeId),
    foodType: Number(restaurant.foodType ?? 0),
    tags,
  };
}

function fingerprintForRestaurant(restaurant, savedSourceCuisineTypes = []) {
  const snapshot = snapshotForRestaurant(restaurant);
  return fingerprintForInput({
    restaurantId: Number(restaurant.id),
    name: restaurant.name,
    note: restaurant.note,
    address: restaurant.address,
    phone: restaurant.phone ?? restaurant.telNum,
    areaNum: restaurant.areaNum,
    telNum: restaurant.telNum,
    originalFoodType: Number(restaurant.foodType ?? 0),
    originalTags: snapshot.tags.map((tag) => tag.name),
    sourceRefs: parseSourceRefs(restaurant.sourceRefsJson),
    sourceCuisineTypes: uniqueText(savedSourceCuisineTypes),
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function snapshotsEqual(left, right) {
  return stableJson(left) === stableJson(right);
}

function resultPayload(record) {
  if (!record || typeof record !== "object") return null;
  if (record.result && typeof record.result === "object") return record.status === "ok" ? record.result : null;
  return record;
}

function resultSource(record, explicitSource = null) {
  if (explicitSource) return explicitSource;
  return record?.requestType === "cuisine-web-research" || record?.customId?.includes("cuisine-web-v1") ? "web" : "ai";
}

function activeTypeById(types) {
  return new Map(normalizedActiveCuisineTypes(types).map((type) => [type.id, type]));
}

function activeTypeByName(types) {
  return new Map(normalizedActiveCuisineTypes(types).flatMap((type) => [
    [normalizeCandidateName(type.name), type],
    [normalizeCandidateName(type.normalizedName), type],
    [normalizeCandidateName(type.code), type],
  ]));
}

function normalizeClassificationRecord(record, explicitSource, activeCuisineTypes) {
  const payload = resultPayload(record);
  if (!payload) return null;
  const restaurantId = Number(payload.restaurantId ?? record.restaurantId);
  const inputFingerprint = cleanText(payload.inputFingerprint ?? record.inputFingerprint);
  if (!Number.isInteger(restaurantId) || restaurantId < 1 || !/^[a-f0-9]{64}$/u.test(inputFingerprint)) return null;
  const source = resultSource(record, explicitSource);
  const activeById = activeTypeById(activeCuisineTypes);
  const activeByName = activeTypeByName(activeCuisineTypes);
  let selected = null;
  let candidate = null;
  if (source === "deterministic") {
    const proposed = payload.proposedCuisineType;
    selected = proposed
      ? activeByName.get(normalizeCandidateName(proposed.code))
        ?? activeByName.get(normalizeCandidateName(proposed.normalizedName))
        ?? activeByName.get(normalizeCandidateName(proposed.name))
      : null;
  } else {
    const selectedId = payload.selectedCuisineTypeId ?? payload.selectedCuisineType?.id;
    const selectedName = payload.selectedCuisineTypeName ?? payload.selectedCuisineType?.name;
    if (selectedId != null) selected = activeById.get(Number(selectedId)) ?? null;
    if (!selected && selectedName) selected = activeByName.get(normalizeCandidateName(selectedName)) ?? null;
    candidate = payload.proposedNewCuisineType ? {
      name: cleanText(payload.proposedNewCuisineType.name),
      normalizedName: normalizeCandidateName(payload.proposedNewCuisineType.normalizedName || payload.proposedNewCuisineType.name),
      reason: cleanText(payload.proposedNewCuisineType.reason),
    } : null;
  }
  if (selected && candidate) return null;
  return {
    restaurantId,
    inputFingerprint,
    savedSourceCuisineTypes: uniqueText(
      payload.savedSourceCuisineTypes
      ?? record.savedSourceCuisineTypes
      ?? record.input?.savedSourceCuisineTypes
    ),
    sourceReferences: payload.sourceReferences
      ?? record.sourceReferences
      ?? record.input?.knownSourceReferences
      ?? [],
    source,
    selectedCuisineType: selected ? {
      id: selected.id,
      code: selected.code,
      name: selected.name,
      normalizedName: selected.normalizedName,
    } : null,
    candidate,
    keptTags: uniqueText(payload.keptTags ?? payload.keptAuxiliaryTags),
    removedTags: uniqueText(payload.removedTags ?? payload.removedCuisineTags),
    addedTags: uniqueText(payload.addedTags),
    confidence: Number(payload.confidence ?? 0),
    reasonCodes: uniqueText(payload.reasonCodes),
    shortReason: cleanText(payload.shortReason ?? payload.decisionReason),
    promptVersion: cleanText(record.promptVersion),
    modelVersion: cleanText(record.modelVersion),
    evidenceUrls: uniqueText(payload.evidenceUrls),
    evidenceTitles: uniqueText(payload.evidenceTitles),
    raw: payload,
  };
}

function indexClassificationResults({ deterministicRecords = [], aiRecords = [], webRecords = [], activeCuisineTypes }) {
  const byRestaurant = new Map();
  const ordered = [
    ...deterministicRecords.map((record) => ({ record, source: "deterministic", priority: 1 })),
    ...aiRecords.map((record) => ({ record, source: "ai", priority: 2 })),
    ...webRecords.map((record) => ({ record, source: "web", priority: 3 })),
  ];
  for (const item of ordered) {
    const normalized = normalizeClassificationRecord(item.record, item.source, activeCuisineTypes);
    if (!normalized) continue;
    const existing = byRestaurant.get(normalized.restaurantId);
    if (!existing || item.priority > existing.priority) byRestaurant.set(normalized.restaurantId, { ...normalized, priority: item.priority });
  }
  return byRestaurant;
}

function reviewCandidateMap(review) {
  return new Map((review?.candidates ?? []).map((candidate) => [candidate.candidateKey, candidate]));
}

function candidateDecisionFor(classification, review) {
  if (!classification.candidate) return { status: "selected", cuisineTypeId: classification.selectedCuisineType?.id ?? null, candidate: null };
  const key = candidateKeyFor(classification.candidate.normalizedName);
  const candidate = reviewCandidateMap(review).get(key);
  if (!candidate) return { status: "candidate-review-missing", cuisineTypeId: null, candidateKey: key, candidate: null };
  if (["merge", "merged"].includes(candidate.decision)) return {
    status: "selected",
    cuisineTypeId: Number(candidate.mergeToCuisineTypeId),
    candidateKey: key,
    candidate,
  };
  if (["approve", "approved"].includes(candidate.decision)) return {
    status: "create-candidate",
    cuisineTypeId: null,
    candidateKey: key,
    candidate,
  };
  return {
    status: ["reject", "rejected"].includes(candidate.decision) ? "candidate-rejected" : "candidate-pending",
    cuisineTypeId: null,
    candidateKey: key,
    candidate,
  };
}

function tagMatches(tag, value) {
  return normalizeCandidateName(tag.normalizedName || tag.name) === normalizeCandidateName(value);
}

function nextPosition(tags) {
  return tags.reduce((maximum, tag) => Math.max(maximum, Number(tag.position) || 0), -1) + 1;
}

function auxiliaryTagDefinition(value) {
  const key = normalizeCandidateName(value);
  return taxonomy.auxiliaryTags.find((definition) => [definition.name, ...(definition.aliases ?? [])]
    .some((alias) => normalizeCandidateName(alias) === key)) ?? null;
}

function planTags(before, classification, fields) {
  const tags = before.tags.map((tag) => ({ ...tag }));
  const protectedTags = [];
  const removed = [];
  const added = [];
  const locked = isTagLocked(fields);
  for (const tagName of classification.removedTags) {
    if (auxiliaryTagDefinition(tagName)) return { error: `auxiliary tag cannot be removed: ${tagName}` };
    const tag = tags.find((candidate) => tagMatches(candidate, tagName));
    if (!tag) return { error: `removed tag is not present: ${tagName}` };
    if (locked || tag.owner === "manual") {
      protectedTags.push(tagName);
      continue;
    }
    tag.owner = "ai";
    tag.sourceName = tag.sourceName || tag.name;
    tag.kind = "legacy_cuisine";
    tag.isPublic = false;
    tag.visibilityReason = "canonical-cuisine-duplicate";
    removed.push(tagName);
  }
  for (const tagName of classification.addedTags) {
    if (!auxiliaryTagDefinition(tagName)) return { error: `added tag is not an approved auxiliary tag: ${tagName}` };
    const existing = tags.find((candidate) => tagMatches(candidate, tagName));
    if (existing) {
      if (locked || existing.owner === "manual") {
        protectedTags.push(tagName);
        continue;
      }
      existing.isPublic = true;
      existing.owner = "ai";
      added.push(tagName);
      continue;
    }
    if (locked) {
      protectedTags.push(tagName);
      continue;
    }
    const name = cleanText(tagName);
    tags.push({
      tagId: null,
      name,
      normalizedName: normalizeCandidateName(name),
      position: nextPosition(tags),
      owner: "ai",
      sourceName: null,
      kind: "auxiliary",
      isPublic: true,
      visibilityReason: null,
    });
    added.push(tagName);
  }
  tags.sort((left, right) => left.position - right.position || (left.tagId ?? 0) - (right.tagId ?? 0));
  return { tags, protectedTags, removed, added };
}

function planRestaurantChange({ restaurant, classification, review, activeCuisineTypes }) {
  const before = snapshotForRestaurant(restaurant);
  const currentFingerprint = fingerprintForRestaurant(restaurant, classification.savedSourceCuisineTypes);
  if (currentFingerprint !== classification.inputFingerprint) {
    return {
      status: "fingerprint-mismatch",
      restaurantId: restaurant.id,
      expectedFingerprint: classification.inputFingerprint,
      currentFingerprint,
      before,
      after: before,
      protectedFields: [],
      reason: "current restaurant identity/tag input changed after the dry-run",
    };
  }
  const fields = parseManualOverrideFields(restaurant.manualOverrideFields);
  const cuisineDecision = candidateDecisionFor(classification, review);
  if (["candidate-review-missing", "candidate-pending", "candidate-rejected"].includes(cuisineDecision.status)) {
    return {
      status: cuisineDecision.status,
      restaurantId: restaurant.id,
      before,
      after: before,
      protectedFields: [],
      candidateKey: cuisineDecision.candidateKey,
      reason: cuisineDecision.status,
    };
  }
  if (!cuisineDecision.cuisineTypeId && cuisineDecision.status !== "create-candidate") {
    return {
      status: "unresolved",
      restaurantId: restaurant.id,
      before,
      after: before,
      protectedFields: [],
      reason: "classification did not select a cuisine type",
    };
  }
  if (cuisineDecision.cuisineTypeId && !activeTypeById(activeCuisineTypes).has(cuisineDecision.cuisineTypeId)) {
    return {
      status: "invalid-cuisine-target",
      restaurantId: restaurant.id,
      before,
      after: before,
      protectedFields: [],
      reason: `CuisineType ${cuisineDecision.cuisineTypeId} is not active`,
    };
  }
  const tagPlan = planTags(before, classification, fields);
  if (tagPlan.error) {
    return {
      status: "invalid-tags",
      restaurantId: restaurant.id,
      before,
      after: before,
      protectedFields: [],
      reason: tagPlan.error,
    };
  }
  const protectedFields = [];
  const after = {
    cuisineTypeId: isCuisineLocked(fields) ? before.cuisineTypeId : cuisineDecision.cuisineTypeId,
    foodType: before.foodType,
    tags: isTagLocked(fields) ? before.tags : tagPlan.tags,
  };
  if (isCuisineLocked(fields)) protectedFields.push("cuisineTypeId");
  if (isTagLocked(fields)) protectedFields.push("tags");
  if (tagPlan.protectedTags.length > 0) protectedFields.push(...tagPlan.protectedTags.map((tag) => `tag:${tag}`));
  return {
    status: "ready",
    restaurantId: Number(restaurant.id),
    inputFingerprint: classification.inputFingerprint,
    currentFingerprint,
    before,
    after,
    protectedFields: [...new Set(protectedFields)],
    classification,
    candidateDecision: cuisineDecision,
    removedTags: tagPlan.removed,
    addedTags: tagPlan.added,
    protectedTags: tagPlan.protectedTags,
    requiresCuisineCreation: cuisineDecision.status === "create-candidate" && !isCuisineLocked(fields),
    reason: protectedFields.length > 0 ? "ready with manual protection" : "ready",
  };
}

function candidateCodeFor(normalizedName) {
  return `candidate-${crypto.createHash("sha256").update(normalizedName).digest("hex").slice(0, 16)}`;
}

function decisionAuditFor(plan) {
  return {
    applyVersion: CUISINE_APPLY_VERSION,
    source: plan.classification.source,
    inputFingerprint: plan.classification.inputFingerprint,
    sourceReferences: plan.classification.sourceReferences,
    confidence: plan.classification.confidence,
    promptVersion: plan.classification.promptVersion || null,
    modelVersion: plan.classification.modelVersion || null,
    reasonCodes: plan.classification.reasonCodes,
    shortReason: plan.classification.shortReason || null,
    selectedCuisineType: plan.classification.selectedCuisineType,
    candidate: plan.classification.candidate,
    candidateDecision: plan.candidateDecision,
    removedTags: plan.removedTags,
    addedTags: plan.addedTags,
    protectedFields: plan.protectedFields,
    evidenceUrls: plan.classification.evidenceUrls,
    evidenceTitles: plan.classification.evidenceTitles,
  };
}

module.exports = {
  CUISINE_APPLY_VERSION,
  MANUAL_CUISINE_FIELDS,
  MANUAL_TAG_FIELDS,
  activeTypeById,
  candidateCodeFor,
  candidateDecisionFor,
  decisionAuditFor,
  fingerprintForRestaurant,
  indexClassificationResults,
  normalizeClassificationRecord,
  parseManualOverrideFields,
  planRestaurantChange,
  snapshotForRestaurant,
  snapshotsEqual,
  stableJson,
};
