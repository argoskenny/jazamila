const crypto = require("node:crypto");
const taxonomy = require("./cuisine-taxonomy.v1.json");

const cuisineTypesByCode = new Map(taxonomy.cuisineTypes.map((cuisineType) => [cuisineType.code, cuisineType]));
const taxonomyRuleOrder = new Map(taxonomy.rules.map((rule, index) => [rule.id, index]));

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
  if (field === "foodType") return [input.originalFoodType];
  if (field === "name") return input.name ? [input.name] : [];
  if (field === "tag") return input.originalTags;
  if (field === "sourceCuisineType") return input.sourceCuisineTypes;
  return [];
}

function collectRuleMatches(input) {
  const matches = [];
  for (const rule of taxonomy.rules) {
    const values = valuesForRule(input, rule.field);
    for (const value of values) {
      if (rule.field === "foodType") {
        if (!rule.values.includes(value)) continue;
        matches.push({
          ruleId: rule.id,
          code: rule.code,
          field: rule.field,
          matchedTerm: String(value),
          matchedValue: value,
          confidence: rule.confidence,
        });
        continue;
      }
      if (rule.excludeTerms?.some((term) => containsTerm(value, term))) continue;
      const matchedTerm = rule.terms.find((term) => containsTerm(value, term));
      if (!matchedTerm) continue;
      matches.push({
        ruleId: rule.id,
        code: rule.code,
        field: rule.field,
        matchedTerm,
        matchedValue: value,
        confidence: rule.confidence,
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
  if (field === "name") return input.name ? [input.name] : [];
  if (field === "tag") return input.originalTags;
  if (field === "sourceCuisineType") return input.sourceCuisineTypes;
  return [];
}

function collectAmbiguousMatches(input, ruleMatches) {
  const ambiguousMatches = [];
  for (const definition of taxonomy.ambiguousTerms) {
    for (const field of definition.fields) {
      const values = valuesForAmbiguousTerm(input, field);
      for (const value of values) {
        const matchedTerm = definition.terms.find((term) => containsTerm(value, term));
        if (!matchedTerm) continue;
        const resolved = definition.resolvedByRuleIds.some((ruleId) => ruleMatches.some((ruleMatch) =>
          ruleMatch.ruleId === ruleId
        ));
        ambiguousMatches.push({
          id: definition.id,
          field,
          matchedTerm,
          matchedValue: value,
          resolved,
          reason: definition.reason,
        });
      }
    }
  }
  return ambiguousMatches;
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
  const unresolvedAmbiguousMatches = ambiguousMatches.filter((match) => !match.resolved);
  const candidateCodes = [...new Set(ruleMatches.map((match) => match.code))];
  const conflict = candidateCodes.length > 1;
  const proposedCode = candidateCodes.length === 1 && !conflict && unresolvedAmbiguousMatches.length === 0
    ? candidateCodes[0]
    : null;
  const proposedCuisineType = cuisineTypeForCode(proposedCode);
  const tagProposal = buildTagProposal(input, ruleMatches, ambiguousMatches);

  let decisionReason = "no-deterministic-evidence";
  if (conflict) decisionReason = "conflicting-cuisine-evidence";
  else if (unresolvedAmbiguousMatches.length > 0) decisionReason = "ambiguous-term-without-context";
  else if (proposedCuisineType) decisionReason = "single-cuisine-evidence";

  const confidence = proposedCuisineType
    ? Math.max(...ruleMatches.filter((match) => match.code === proposedCode).map((match) => match.confidence))
    : 0;

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
    ambiguousMatches,
    decisionReason,
    needsAi: !proposedCuisineType,
    needsWebResearch: false,
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
