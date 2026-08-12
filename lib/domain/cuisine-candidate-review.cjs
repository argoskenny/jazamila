const crypto = require("node:crypto");
const { taxonomy } = require("./deterministic-cuisine-classifier.cjs");

const CANDIDATE_REVIEW_VERSION = "cuisine-candidate-review-v1";
const CANDIDATE_DECISIONS = ["pending", "approve", "merge", "reject"];
const DEFAULT_REPRESENTATIVE_LIMIT = 5;
const DEFAULT_EVIDENCE_LIMIT = 20;
const DECISION_ALIASES = { approved: "approve", merged: "merge", rejected: "reject" };

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeCandidateName(value) {
  return cleanText(value)
    .toLocaleLowerCase("zh-TW")
    .replace(/[臺]/gu, "台")
    .replace(/[／/\\\s\-_.,，。:：;；、()（）【】「」『』]+/gu, "");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function candidateKeyFor(normalizedName) {
  const normalized = normalizeCandidateName(normalizedName);
  if (!normalized) throw new Error("candidate normalizedName is required");
  return `cuisine-candidate-v1:${sha256(normalized).slice(0, 24)}`;
}

function levenshtein(left, right) {
  const a = [...left];
  const b = [...right];
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      const substitution = diagonal + (a[row - 1] === b[column - 1] ? 0 : 1);
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, substitution);
      diagonal = above;
    }
  }
  return previous[b.length];
}

function similarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const length = Math.max([...left].length, [...right].length);
  return Math.max(0, 1 - levenshtein(left, right) / length);
}

function normalizedActiveCuisineTypes(cuisineTypes) {
  return (Array.isArray(cuisineTypes) ? cuisineTypes : [])
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

function aliasesForCuisineType(type) {
  const aliases = new Set([type.name, type.normalizedName, type.code]);
  for (const rule of taxonomy.rules) {
    if (rule.code !== type.code) continue;
    for (const term of rule.terms ?? []) aliases.add(term);
  }
  return [...aliases].map(normalizeCandidateName).filter(Boolean);
}

function compareCandidateToCuisineTypes(candidateName, cuisineTypes) {
  const candidate = normalizeCandidateName(candidateName);
  const scored = [];
  for (const type of normalizedActiveCuisineTypes(cuisineTypes)) {
    const typeKey = normalizeCandidateName(type.normalizedName || type.name);
    if (candidate === typeKey) {
      scored.push({ type, score: 1, method: "exact" });
      continue;
    }
    const aliases = aliasesForCuisineType(type);
    const synonymAlias = aliases.find((alias) => alias === candidate);
    if (synonymAlias) {
      scored.push({ type, score: 0.98, method: "synonym" });
      continue;
    }
    const bestSimilarity = Math.max(...aliases.map((alias) => similarity(candidate, alias)), 0);
    if (bestSimilarity >= 0.78) scored.push({ type, score: Number(bestSimilarity.toFixed(4)), method: "approximate" });
  }
  return scored.sort((left, right) => right.score - left.score || left.type.id - right.type.id);
}

function suggestedMergeFor(candidateName, cuisineTypes) {
  const matches = compareCandidateToCuisineTypes(candidateName, cuisineTypes);
  if (matches.length === 0) return { suggested: null, matches: [] };
  const [best, second] = matches;
  const unambiguous = !second || best.score - second.score >= 0.03;
  return {
    suggested: unambiguous ? {
      id: best.type.id,
      code: best.type.code,
      name: best.type.name,
      normalizedName: best.type.normalizedName,
      matchScore: best.score,
      matchMethod: best.method,
    } : null,
    matches: matches.slice(0, 5).map((match) => ({
      id: match.type.id,
      code: match.type.code,
      name: match.type.name,
      normalizedName: match.type.normalizedName,
      matchScore: match.score,
      matchMethod: match.method,
    })),
  };
}

function isPureAuxiliary(value) {
  const key = normalizeCandidateName(value);
  return taxonomy.auxiliaryTags.some((definition) => normalizeCandidateName(definition.name) === key);
}

function resultPayload(record) {
  if (!record || typeof record !== "object") return null;
  if (record.result && typeof record.result === "object") {
    if (record.status !== "ok") return null;
    return record.result;
  }
  return record;
}

function requestForRecord(record, requestIndex) {
  const customId = cleanText(record?.customId);
  const fromCustom = customId ? requestIndex.get(customId) : null;
  return fromCustom ?? record?.request ?? record ?? null;
}

function sourceReferencesFor(record, request) {
  const input = request?.input ?? {};
  const references = request?.knownSourceReferences
    ?? input.knownSourceReferences
    ?? request?.sourceRefs
    ?? record?.sourceRefs
    ?? [];
  return (Array.isArray(references) ? references : [])
    .filter((reference) => reference && typeof reference === "object")
    .flatMap((reference) => {
      const base = {
        sourceType: "saved-source-ref",
        file: cleanText(reference.file) || null,
        id: cleanText(reference.id) || null,
        sourceId: cleanText(reference.sourceId) || null,
        title: null,
      };
      const urls = [...new Set([
        reference.url,
        ...(Array.isArray(reference.urls) ? reference.urls : []),
        ...(Array.isArray(reference.sourceUrls) ? reference.sourceUrls : []),
      ].map((url) => cleanText(url)).filter(Boolean))];
      if (urls.length === 0) return [{ ...base, url: null }];
      return urls.map((url) => ({ ...base, url }));
    })
    .filter((reference) => reference.file || reference.id || reference.sourceId || reference.url);
}

function webEvidenceFor(record, payload) {
  return (Array.isArray(payload?.evidence) ? payload.evidence : [])
    .map((evidence) => ({
      sourceType: "web-evidence",
      url: cleanText(evidence.url),
      title: cleanText(evidence.title),
      sourceTier: Number(evidence.sourceTier),
      sourceKind: cleanText(evidence.sourceKind),
      contentHash: cleanText(evidence.contentHash),
    }))
    .filter((evidence) => evidence.url && evidence.title && /^[a-f0-9]{64}$/u.test(evidence.contentHash));
}

function representativeFor(payload, record, request) {
  const input = request?.input ?? record?.input ?? {};
  return {
    restaurantId: Number(payload.restaurantId ?? record.restaurantId),
    name: cleanText(input.name) || null,
    address: cleanText(input.address) || null,
    phone: cleanText(input.phone) || null,
    inputFingerprint: cleanText(payload.inputFingerprint ?? record.inputFingerprint),
  };
}

function observationFor(record, request) {
  const payload = resultPayload(record);
  const candidate = payload?.proposedNewCuisineType;
  if (!candidate || !cleanText(candidate.name)) return null;
  const normalizedName = normalizeCandidateName(candidate.normalizedName || candidate.name);
  if (!normalizedName) return null;
  return {
    candidateName: cleanText(candidate.name),
    normalizedName,
    restaurantId: Number(payload.restaurantId ?? record.restaurantId),
    inputFingerprint: cleanText(payload.inputFingerprint ?? record.inputFingerprint),
    confidence: Number(payload.confidence ?? 0),
    reason: cleanText(candidate.reason ?? payload.shortReason),
    representative: representativeFor(payload, record, request),
    evidenceSources: [
      ...sourceReferencesFor(record, request),
      ...webEvidenceFor(record, payload),
    ],
  };
}

function uniqueEvidence(sources, limit = DEFAULT_EVIDENCE_LIMIT) {
  const result = [];
  const seen = new Set();
  for (const source of sources) {
    const key = source.url || `${source.file ?? ""}|${source.id ?? ""}|${source.sourceId ?? ""}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(source);
    if (result.length >= limit) break;
  }
  return result;
}

function buildCandidateReview({
  resultRecords = [],
  requestRecords = [],
  cuisineTypes = [],
  representativeLimit = DEFAULT_REPRESENTATIVE_LIMIT,
  evidenceLimit = DEFAULT_EVIDENCE_LIMIT,
  generatedAt = new Date().toISOString(),
}) {
  const activeCuisineTypes = normalizedActiveCuisineTypes(cuisineTypes);
  const requestIndex = new Map((Array.isArray(requestRecords) ? requestRecords : [])
    .filter((request) => request?.customId)
    .map((request) => [request.customId, request]));
  const observations = [];
  for (const record of Array.isArray(resultRecords) ? resultRecords : []) {
    const observation = observationFor(record, requestForRecord(record, requestIndex));
    if (observation && Number.isInteger(observation.restaurantId) && observation.restaurantId > 0) observations.push(observation);
  }
  const grouped = new Map();
  for (const observation of observations) {
    const group = grouped.get(observation.normalizedName) ?? [];
    group.push(observation);
    grouped.set(observation.normalizedName, group);
  }
  const candidates = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([normalizedName, group]) => {
    const [first] = group;
    const merge = suggestedMergeFor(first.candidateName, activeCuisineTypes);
    const confidenceValues = group.map((item) => item.confidence).filter(Number.isFinite);
    const representatives = [...new Map(group.map((item) => [item.restaurantId, item.representative])).values()]
      .sort((left, right) => left.restaurantId - right.restaurantId)
      .slice(0, representativeLimit);
    const evidenceSources = uniqueEvidence(group.flatMap((item) => item.evidenceSources), evidenceLimit);
    const validationWarnings = [];
    if (isPureAuxiliary(first.candidateName)) validationWarnings.push("AUXILIARY_NAME");
    if (merge.suggested?.matchMethod === "exact" || merge.suggested?.matchMethod === "synonym") {
      validationWarnings.push("EXISTING_TYPE_ALIAS");
    }
    return {
      candidateKey: candidateKeyFor(normalizedName),
      name: first.candidateName,
      normalizedName,
      suggestedMergeCuisineType: merge.suggested,
      possibleMatches: merge.matches,
      affectedRestaurantCount: new Set(group.map((item) => item.restaurantId)).size,
      representativeRestaurants: representatives,
      evidenceSources,
      averageConfidence: confidenceValues.length > 0
        ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(4))
        : 0,
      minimumConfidence: confidenceValues.length > 0 ? Number(Math.min(...confidenceValues).toFixed(4)) : 0,
      sourceRecordCount: group.length,
      inputFingerprints: [...new Set(group.map((item) => item.inputFingerprint).filter(Boolean))].sort(),
      reasons: [...new Set(group.map((item) => item.reason).filter(Boolean))].slice(0, 10),
      validationWarnings,
      decision: "pending",
      mergeToCuisineTypeId: null,
      approvedName: null,
      decisionReason: null,
      decisionBy: null,
      decisionAt: null,
    };
  });
  return {
    reviewVersion: CANDIDATE_REVIEW_VERSION,
    mode: "dry-run",
    readOnly: true,
    generatedAt,
    taxonomyVersion: taxonomy.version,
    candidates,
    summary: {
      candidates: candidates.length,
      affectedRestaurants: new Set(observations.map((item) => item.restaurantId)).size,
      pending: candidates.length,
      approve: 0,
      merge: 0,
      reject: 0,
    },
  };
}

function validateDecision(decision, candidate, activeCuisineTypes) {
  const value = decision ?? {};
  const rawAction = cleanText(value.decision).toLocaleLowerCase("en-US");
  const action = DECISION_ALIASES[rawAction] ?? rawAction;
  if (!CANDIDATE_DECISIONS.includes(action) || action === "pending") {
    throw new Error(`candidate ${candidate.candidateKey} decision must be approve, merge, or reject`);
  }
  const active = normalizedActiveCuisineTypes(activeCuisineTypes);
  const targetId = value.mergeToCuisineTypeId == null ? null : Number(value.mergeToCuisineTypeId);
  if (action === "merge") {
    const target = active.find((type) => type.id === targetId);
    if (!target) throw new Error(`candidate ${candidate.candidateKey} merge target must be an active CuisineType`);
  } else if (targetId !== null) {
    throw new Error(`candidate ${candidate.candidateKey} only merge may set mergeToCuisineTypeId`);
  }
  if (action === "approve" && candidate.suggestedMergeCuisineType
    && ["exact", "synonym"].includes(candidate.suggestedMergeCuisineType.matchMethod)) {
    throw new Error(`candidate ${candidate.candidateKey} matches an existing synonym; use merge instead of approve`);
  }
  const approvedName = action === "approve" ? cleanText(value.approvedName || candidate.name) : null;
  if (action === "approve") {
    const normalizedApproved = normalizeCandidateName(approvedName);
    if (!normalizedApproved) throw new Error(`candidate ${candidate.candidateKey} approvedName is required`);
    if (isPureAuxiliary(approvedName)) throw new Error(`candidate ${candidate.candidateKey} cannot create an auxiliary type`);
    if (compareCandidateToCuisineTypes(approvedName, active).some((match) => match.method !== "approximate")) {
      throw new Error(`candidate ${candidate.candidateKey} duplicates an existing type or synonym`);
    }
  }
  return {
    decision: action,
    mergeToCuisineTypeId: action === "merge" ? targetId : null,
    approvedName,
    decisionReason: cleanText(value.decisionReason) || null,
    decisionBy: cleanText(value.decisionBy) || "manual",
    decisionAt: cleanText(value.decisionAt) || new Date().toISOString(),
  };
}

function applyCandidateDecisions(review, decisions, cuisineTypes) {
  if (!review || review.reviewVersion !== CANDIDATE_REVIEW_VERSION || review.readOnly !== true) {
    throw new Error("candidate review must be a versioned read-only review artifact");
  }
  const decisionMap = new Map((Array.isArray(decisions) ? decisions : [])
    .map((decision) => [cleanText(decision?.candidateKey), decision]));
  const activeCuisineTypes = normalizedActiveCuisineTypes(cuisineTypes);
  const candidates = review.candidates.map((candidate) => {
    const decision = decisionMap.get(candidate.candidateKey);
    if (!decision) return candidate;
    return { ...candidate, ...validateDecision(decision, candidate, activeCuisineTypes) };
  });
  const knownKeys = new Set(review.candidates.map((candidate) => candidate.candidateKey));
  for (const decision of Array.isArray(decisions) ? decisions : []) {
    if (!knownKeys.has(cleanText(decision?.candidateKey))) throw new Error(`unknown candidateKey: ${decision?.candidateKey}`);
  }
  const summary = Object.fromEntries(CANDIDATE_DECISIONS.map((decision) => [decision, candidates.filter((candidate) => candidate.decision === decision).length]));
  return {
    ...review,
    candidates,
    summary: {
      ...review.summary,
      candidates: candidates.length,
      affectedRestaurants: new Set(candidates.flatMap((candidate) => candidate.representativeRestaurants.map((restaurant) => restaurant.restaurantId))).size,
      ...summary,
    },
  };
}

module.exports = {
  CANDIDATE_DECISIONS,
  CANDIDATE_REVIEW_VERSION,
  applyCandidateDecisions,
  buildCandidateReview,
  candidateKeyFor,
  compareCandidateToCuisineTypes,
  normalizeCandidateName,
  normalizedActiveCuisineTypes,
  suggestedMergeFor,
};
