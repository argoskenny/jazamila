const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

const ELIGIBILITY_REASONS = {
  EXPLICIT_NEEDS_WEB_RESEARCH: "EXPLICIT_NEEDS_WEB_RESEARCH",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  CONFLICTING_TAGS: "CONFLICTING_TAGS",
  NEW_CUISINE_CANDIDATE: "NEW_CUISINE_CANDIDATE",
  SAME_NAME_OR_BRANCH_RISK: "SAME_NAME_OR_BRANCH_RISK",
  INSUFFICIENT_INFORMATION: "INSUFFICIENT_INFORMATION",
};

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function uniqueText(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value);
    const key = normalizeKey(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function normalizePhone(value) {
  return cleanText(value).replace(/[^\d+]/gu, "");
}

function parseLocation(address) {
  const normalizedAddress = cleanText(address);
  const cityMatch = normalizedAddress.match(/^(.{2,4}?[縣市])/u);
  const city = cityMatch?.[1] ?? "";
  const remaining = city ? normalizedAddress.slice(city.length) : normalizedAddress;
  const districtMatch = remaining.match(/^(.{1,5}?[區鄉鎮市])/u);
  return {
    city,
    district: districtMatch?.[1] ?? "",
  };
}

function extractBranchName(name) {
  const normalizedName = cleanText(name);
  const parenthesized = normalizedName.match(/[（(]([^（）()]{1,30})[）)]/u);
  if (parenthesized?.[1]) return cleanText(parenthesized[1]);
  const branch = normalizedName.match(/([^\s,，]{1,20}(?:分店|旗艦店|概念店|門市|店))/u);
  return branch?.[1] ? cleanText(branch[1]) : "";
}

function baseRestaurantName(name) {
  return normalizeKey(cleanText(name)
    .replace(/[（(][^（）()]{1,30}[）)]/gu, "")
    .replace(/(?:分店|旗艦店|概念店|門市|店)$/u, ""));
}

function identityInputForResult(result) {
  const aiInput = result?.aiInput ?? {};
  const address = cleanText(aiInput.address);
  const location = parseLocation(address);
  return {
    name: cleanText(aiInput.name),
    address,
    phone: cleanText(aiInput.phone),
    currentFoodType: Number(aiInput.currentFoodType ?? result?.originalFoodType ?? 0),
    currentTags: uniqueText(aiInput.currentTags ?? result?.originalTags),
    knownSourceReferences: Array.isArray(aiInput.knownSourceReferences)
      ? aiInput.knownSourceReferences
      : Array.isArray(result?.sourceRefs) ? result.sourceRefs : [],
    savedSourceCuisineTypes: uniqueText(aiInput.savedSourceCuisineTypes ?? result?.savedSourceCuisineTypes),
    city: cleanText(aiInput.city) || location.city,
    district: cleanText(aiInput.district) || location.district,
    branchName: cleanText(aiInput.branchName) || extractBranchName(aiInput.name),
  };
}

function identityRiskIndex(results) {
  const groups = new Map();
  const baseGroups = new Map();
  for (const result of Array.isArray(results) ? results : []) {
    const input = identityInputForResult(result);
    const id = Number(result?.restaurantId);
    if (!Number.isInteger(id) || id < 1) continue;
    const nameKey = normalizeKey(input.name);
    const baseKey = baseRestaurantName(input.name);
    if (nameKey) groups.set(nameKey, [...(groups.get(nameKey) ?? []), { id, address: input.address }]);
    if (baseKey) baseGroups.set(baseKey, [...(baseGroups.get(baseKey) ?? []), { id, name: input.name, address: input.address }]);
  }

  const riskByRestaurantId = new Map();
  const addRisk = (id, reason) => {
    const current = riskByRestaurantId.get(id) ?? new Set();
    current.add(reason);
    riskByRestaurantId.set(id, current);
  };
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const member of members) addRisk(member.id, ELIGIBILITY_REASONS.SAME_NAME_OR_BRANCH_RISK);
  }
  for (const members of baseGroups.values()) {
    const distinctNames = new Set(members.map((member) => normalizeKey(member.name)));
    if (members.length < 2 || distinctNames.size < 2) continue;
    for (const member of members) addRisk(member.id, ELIGIBILITY_REASONS.SAME_NAME_OR_BRANCH_RISK);
  }
  return riskByRestaurantId;
}

function stage3HasConflictingCuisineEvidence(result) {
  if (result?.decisionReason === "conflicting-cuisine-evidence") return true;
  const matchedCodes = new Set((Array.isArray(result?.matchedRules) ? result.matchedRules : [])
    .filter((match) => match?.field === "tag" || match?.field === "sourceCuisineType" || match?.field === "name")
    .map((match) => cleanText(match.code))
    .filter(Boolean));
  return matchedCodes.size > 1;
}

function aiHasConflictingEvidence(aiResult) {
  return Array.isArray(aiResult?.reasonCodes) && aiResult.reasonCodes.includes("CONFLICTING_EVIDENCE");
}

function classifyWebEligibility({
  stage3Result,
  aiResult = null,
  identityRiskReasons = [],
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
}) {
  const input = identityInputForResult(stage3Result);
  const reasons = new Set();
  const confidence = Number.isFinite(Number(aiResult?.confidence))
    ? Number(aiResult.confidence)
    : Number.isFinite(Number(stage3Result?.confidence)) ? Number(stage3Result.confidence) : 0;
  if (stage3Result?.needsWebResearch === true || aiResult?.needsWebResearch === true) {
    reasons.add(ELIGIBILITY_REASONS.EXPLICIT_NEEDS_WEB_RESEARCH);
  }
  if (confidence < confidenceThreshold) reasons.add(ELIGIBILITY_REASONS.LOW_CONFIDENCE);
  if (stage3HasConflictingCuisineEvidence(stage3Result) || aiHasConflictingEvidence(aiResult)) {
    reasons.add(ELIGIBILITY_REASONS.CONFLICTING_TAGS);
  }
  if (aiResult?.proposedNewCuisineType) reasons.add(ELIGIBILITY_REASONS.NEW_CUISINE_CANDIDATE);
  for (const reason of Array.isArray(identityRiskReasons) ? identityRiskReasons : []) reasons.add(reason);
  const hasClassificationEvidence = Boolean(
    input.name ||
    input.currentFoodType > 0 ||
    input.currentTags.length > 0 ||
    input.savedSourceCuisineTypes.length > 0
  );
  if (!input.name || !input.address || !hasClassificationEvidence) {
    reasons.add(ELIGIBILITY_REASONS.INSUFFICIENT_INFORMATION);
  }
  return {
    eligible: reasons.size > 0,
    reasons: [...reasons],
    confidence,
    confidenceThreshold,
    identityRisk: identityRiskReasons.length > 0,
  };
}

function quote(value) {
  return `"${cleanText(value).replace(/"/gu, "\\\"")}"`;
}

function buildSearchQueries(input) {
  const identityValues = [input.name, input.address, input.city, input.district, input.phone, input.branchName]
    .map(cleanText)
    .filter(Boolean);
  if (!input.name || !input.address) return [];
  const identity = identityValues.map(quote).join(" ");
  return uniqueText([
    `${identity} 官方 菜單`,
    `${identity} 官方 社群`,
    `${identity} 店家 料理`,
  ]);
}

module.exports = {
  DEFAULT_CONFIDENCE_THRESHOLD,
  ELIGIBILITY_REASONS,
  baseRestaurantName,
  buildSearchQueries,
  classifyWebEligibility,
  cleanText,
  extractBranchName,
  identityInputForResult,
  identityRiskIndex,
  normalizeKey,
  normalizePhone,
  parseLocation,
  uniqueText,
};
