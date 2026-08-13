const crypto = require("node:crypto");
const taxonomy = require("./cuisine-taxonomy.v1.json");

const cuisineTypesByCode = new Map(taxonomy.cuisineTypes.map((cuisineType) => [cuisineType.code, cuisineType]));
const taxonomyRuleOrder = new Map(taxonomy.rules.map((rule, index) => [rule.id, index]));
const DEFAULT_EVIDENCE_PRIORITIES = {
  brand: 500,
  name: 400,
  sourceCuisineType: 300,
  note: 200,
  tag: 200,
  foodType: 100,
};
const evidencePriorities = { ...DEFAULT_EVIDENCE_PRIORITIES, ...(taxonomy.evidencePriorities ?? {}) };

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeDisplayTag(value) {
  return cleanText(value).replace(/[／]/gu, "/");
}

function matchText(value) {
  return cleanText(value).toLocaleLowerCase("en-US");
}

function matchKey(value) {
  return matchText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function containsTerm(value, term) {
  const haystack = matchText(value);
  const needle = matchText(term);
  return Boolean(needle) && haystack.includes(needle);
}

function uniqueDisplayValues(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const display = normalizeDisplayTag(value);
    const key = matchKey(display);
    if (!display || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(display);
  }
  return result;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeSourceRefs(sourceRefs) {
  if (!Array.isArray(sourceRefs)) return [];
  return sourceRefs
    .filter((ref) => ref && typeof ref === "object")
    .map((ref) => ({
      file: cleanText(ref.file),
      id: cleanText(ref.id),
      sourceId: cleanText(ref.sourceId),
    }))
    .filter((ref) => ref.file || ref.id || ref.sourceId)
    .sort((left, right) => `${left.file}|${left.id}|${left.sourceId}`.localeCompare(`${right.file}|${right.id}|${right.sourceId}`));
}

function parseSourceRefs(value) {
  if (!value) return [];
  try {
    return normalizeSourceRefs(JSON.parse(value));
  } catch {
    return [];
  }
}

function normalizeInput(input) {
  const originalTags = Array.isArray(input.originalTags)
    ? input.originalTags.map(normalizeDisplayTag).filter(Boolean)
    : Array.isArray(input.tags)
      ? input.tags.map(normalizeDisplayTag).filter(Boolean)
      : [];
  const sourceCuisineTypes = Array.isArray(input.sourceCuisineTypes)
    ? input.sourceCuisineTypes.map(normalizeDisplayTag).filter(Boolean)
    : [];
  const sourceRefs = normalizeSourceRefs(input.sourceRefs);
  return {
    restaurantId: Number(input.restaurantId ?? input.id),
    name: cleanText(input.name),
    note: cleanText(input.note),
    address: cleanText(input.address),
    phone: cleanText(input.phone),
    areaNum: cleanText(input.areaNum),
    telNum: cleanText(input.telNum),
    originalFoodType: Number.isInteger(input.originalFoodType)
      ? input.originalFoodType
      : Number.isInteger(input.foodType) ? input.foodType : 0,
    originalTags,
    sourceRefs,
    sourceCuisineTypes,
  };
}

function fingerprintForInput(input) {
  const normalized = normalizeInput(input);
  return sha256(stableStringify(normalized));
}

function valuesForRule(input, field) {
  if (field === "foodType") return [{ field, value: input.originalFoodType }];
  if (field === "brand") return input.name ? [{ field, value: input.name }] : [];
  if (field === "name") return [
    ...(input.name ? [{ field: "name", value: input.name }] : []),
    ...(input.note ? [{ field: "note", value: input.note }] : []),
  ];
  if (field === "tag") return input.originalTags.map((value) => ({ field, value }));
  if (field === "sourceCuisineType") return input.sourceCuisineTypes.map((value) => ({ field, value }));
  return [];
}

function evidencePriority(field, rule = null) {
  return Number(rule?.priority ?? evidencePriorities[field] ?? 0);
}

function collectRuleMatches(input) {
  const matches = [];
  for (const rule of taxonomy.rules) {
    const evidenceValues = valuesForRule(input, rule.field);
    for (const evidence of evidenceValues) {
      const value = evidence.value;
      if (rule.field === "foodType") {
        if (!rule.values.includes(value)) continue;
        matches.push({
          ruleId: rule.id,
          code: rule.code,
          field: evidence.field,
          matchedTerm: String(value),
          matchedValue: value,
          confidence: rule.confidence,
          evidencePriority: evidencePriority(evidence.field, rule),
        });
        continue;
      }
      if (rule.excludeTerms?.some((term) => containsTerm(value, term))) continue;
      const matchedTerm = rule.terms.find((term) => containsTerm(value, term));
      if (!matchedTerm) continue;
      matches.push({
        ruleId: rule.id,
        code: rule.code,
        field: evidence.field,
        matchedTerm,
        matchedValue: value,
        confidence: rule.confidence,
        evidencePriority: evidencePriority(evidence.field, rule),
      });
    }
  }

  const uniqueMatches = new Map();
  for (const match of matches) {
    const key = [match.ruleId, match.field, matchKey(match.matchedValue), matchKey(match.matchedTerm)].join("|");
    if (!uniqueMatches.has(key)) uniqueMatches.set(key, match);
  }
  return [...uniqueMatches.values()].sort((left, right) => {
    const ruleOrder = taxonomyRuleOrder.get(left.ruleId) - taxonomyRuleOrder.get(right.ruleId);
    if (ruleOrder !== 0) return ruleOrder;
    return `${left.field}|${left.matchedValue}|${left.matchedTerm}`.localeCompare(`${right.field}|${right.matchedValue}|${right.matchedTerm}`);
  });
}

function valuesForAmbiguousTerm(input, field) {
  if (field === "name") return [
    ...(input.name ? [{ field: "name", value: input.name }] : []),
    ...(input.note ? [{ field: "note", value: input.note }] : []),
  ];
  if (field === "tag") return input.originalTags.map((value) => ({ field, value }));
  if (field === "sourceCuisineType") return input.sourceCuisineTypes.map((value) => ({ field, value }));
  return [];
}

function collectAmbiguousMatches(input, ruleMatches) {
  const ambiguousMatches = [];
  for (const definition of taxonomy.ambiguousTerms) {
    for (const field of definition.fields) {
      const evidenceValues = valuesForAmbiguousTerm(input, field);
      for (const evidence of evidenceValues) {
        const value = evidence.value;
        const matchedTerm = definition.terms.find((term) => containsTerm(value, term));
        if (!matchedTerm) continue;
        const resolved = definition.resolvedByRuleIds.some((ruleId) => ruleMatches.some((ruleMatch) =>
          ruleMatch.ruleId === ruleId
        ));
        ambiguousMatches.push({
          id: definition.id,
          field: evidence.field,
          matchedTerm,
          matchedValue: value,
          resolved,
          reason: definition.reason,
          evidencePriority: evidencePriority(evidence.field),
        });
      }
    }
  }
  return ambiguousMatches;
}

function collectSignalMatches(input, definitions = []) {
  const matches = [];
  for (const definition of definitions) {
    for (const field of definition.fields ?? []) {
      const evidenceValues = valuesForAmbiguousTerm(input, field);
      for (const evidence of evidenceValues) {
        const matchedTerm = (definition.terms ?? []).find((term) => containsTerm(evidence.value, term));
        if (!matchedTerm) continue;
        matches.push({
          id: definition.id,
          category: definition.category ?? null,
          field: evidence.field,
          matchedTerm,
          matchedValue: evidence.value,
          reason: definition.reason,
          evidencePriority: evidencePriority(evidence.field),
        });
      }
    }
  }
  return matches;
}

function candidateEvidence(ruleMatches) {
  const candidates = new Map();
  for (const match of ruleMatches) {
    const current = candidates.get(match.code) ?? {
      code: match.code,
      evidencePriority: 0,
      confidence: 0,
      matches: [],
    };
    current.matches.push(match);
    if (match.evidencePriority > current.evidencePriority) {
      current.evidencePriority = match.evidencePriority;
      current.confidence = match.confidence;
    } else if (match.evidencePriority === current.evidencePriority) {
      current.confidence = Math.max(current.confidence, match.confidence);
    }
    candidates.set(match.code, current);
  }
  return [...candidates.values()].sort((left, right) =>
    right.evidencePriority - left.evidencePriority
    || right.confidence - left.confidence
    || left.code.localeCompare(right.code)
  );
}

function auxiliaryMatches(tag) {
  return taxonomy.auxiliaryTags.filter((definition) =>
    definition.aliases.some((alias) => containsTerm(tag, alias))
  );
}

function hasUnresolvedTagAmbiguity(tag, ambiguousMatches) {
  return ambiguousMatches.some((match) =>
    match.field === "tag" &&
    !match.resolved &&
    matchKey(match.matchedValue) === matchKey(tag)
  );
}

function buildTagProposal(input, ruleMatches, ambiguousMatches) {
  const keptAuxiliaryTags = [];
  const removedCuisineTags = [];
  for (const tag of input.originalTags) {
    const tagMatches = ruleMatches.filter((match) => match.field === "tag" && match.matchedValue === tag);
    const ambiguousTag = hasUnresolvedTagAmbiguity(tag, ambiguousMatches);
    if (tagMatches.length > 0 && !ambiguousTag) {
      removedCuisineTags.push(tag);
      for (const auxiliary of auxiliaryMatches(tag)) keptAuxiliaryTags.push(auxiliary.name);
    } else {
      keptAuxiliaryTags.push(tag);
    }
  }
  return {
    keptAuxiliaryTags: uniqueDisplayValues(keptAuxiliaryTags),
    removedCuisineTags: uniqueDisplayValues(removedCuisineTags),
    normalizedTags: uniqueDisplayValues(input.originalTags),
  };
}

function cuisineTypeForCode(code) {
  const cuisineType = cuisineTypesByCode.get(code);
  if (!cuisineType) return null;
  return {
    code: cuisineType.code,
    name: cuisineType.name,
    normalizedName: cuisineType.normalizedName,
    status: "active",
  };
}

function classifyRestaurant(rawInput) {
  const input = normalizeInput(rawInput);
  const ruleMatches = collectRuleMatches(input);
  const ambiguousMatches = collectAmbiguousMatches(input, ruleMatches);
  const unsupportedCategoryMatches = collectSignalMatches(input, taxonomy.unsupportedCategories);
  const entityRiskMatches = collectSignalMatches(input, taxonomy.entityRisks);
  const candidates = candidateEvidence(ruleMatches);
  const highestPriority = candidates[0]?.evidencePriority ?? 0;
  const highestPriorityCandidates = candidates.filter((candidate) => candidate.evidencePriority === highestPriority);
  const conflict = highestPriorityCandidates.length > 1;
  const topCandidate = highestPriorityCandidates.length === 1 ? highestPriorityCandidates[0] : null;
  const unresolvedAmbiguousMatches = ambiguousMatches.filter((match) =>
    !match.resolved && (!topCandidate || match.evidencePriority >= topCandidate.evidencePriority)
  );
  const proposedCode = topCandidate && !conflict && unresolvedAmbiguousMatches.length === 0 && entityRiskMatches.length === 0
    ? topCandidate.code
    : null;
  const proposedCuisineType = cuisineTypeForCode(proposedCode);
  const tagProposal = buildTagProposal(input, ruleMatches, ambiguousMatches);

  let decisionReason = "no-deterministic-evidence";
  if (entityRiskMatches.length > 0) decisionReason = "non-restaurant-entity-risk";
  else if (conflict) decisionReason = "conflicting-cuisine-evidence";
  else if (unresolvedAmbiguousMatches.length > 0) decisionReason = "ambiguous-term-without-context";
  else if (proposedCuisineType && candidates.length > 1) decisionReason = "higher-priority-cuisine-evidence";
  else if (proposedCuisineType) decisionReason = "single-cuisine-evidence";
  else if (unsupportedCategoryMatches.length > 0) decisionReason = "unsupported-cuisine-category";

  const confidence = proposedCuisineType ? topCandidate.confidence : 0;
  const classificationStatus = proposedCuisineType ? "classified" : "unresolved";

  return {
    restaurantId: input.restaurantId,
    inputFingerprint: fingerprintForInput(input),
    originalFoodType: input.originalFoodType,
    originalTags: input.originalTags,
    proposedCuisineType,
    keptAuxiliaryTags: tagProposal.keptAuxiliaryTags,
    removedCuisineTags: tagProposal.removedCuisineTags,
    normalizedTags: tagProposal.normalizedTags,
    confidence,
    decisionMethod: "deterministic",
    matchedRules: ruleMatches,
    candidateEvidence: candidates,
    ambiguousMatches,
    unsupportedCategoryMatches,
    entityRiskMatches,
    decisionReason,
    classificationStatus,
    needsAi: !proposedCuisineType && entityRiskMatches.length === 0,
    needsWebResearch: !proposedCuisineType,
  };
}

module.exports = {
  TAXONOMY_VERSION: taxonomy.version,
  taxonomy,
  classifyRestaurant,
  fingerprintForInput,
  normalizeInput,
  parseSourceRefs,
};
