#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  validateClassificationResult,
} = require("../lib/ai/cuisine-classification-contract.cjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function cleanText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function normalizeKey(value) {
  return cleanText(value).toLocaleLowerCase("en-US").replace(/[／/\s\-_]+/gu, "");
}

function evidenceReasonCodes(assessment, removedTags) {
  const ruleIds = (assessment?.candidateEvidence ?? []).flatMap((candidate) => candidate.matchedRuleIds ?? []);
  const codes = [];
  if (ruleIds.some((id) => /(?:^|-)tag(?:-|$)/u.test(id))) codes.push("EXPLICIT_CUISINE_TAG");
  if (ruleIds.some((id) => /(?:^|-)name(?:-|$)/u.test(id))) codes.push("RESTAURANT_NAME_SUPPORTS_TYPE");
  if (ruleIds.some((id) => /(?:^|-)source(?:-|$)/u.test(id))) codes.push("SOURCE_SUPPORTS_TYPE");
  if (ruleIds.some((id) => /(?:legacy|foodtype)/u.test(id))) codes.push("LEGACY_FOODTYPE_SUPPORTS_TYPE");
  if (removedTags.length > 0) codes.push("TAG_CLEANUP_SUPPORTED");
  codes.push("NO_NEW_MARKETING_TAG");
  return [...new Set(codes)];
}

function suppliedTypeFor(request) {
  const active = request.suppliedCuisineTypes.filter((type) => type.status === "active");
  const proposed = request.recoveryAssessment?.proposedCuisineType;
  if (proposed) {
    const byCode = active.find((type) => cleanText(type.code) === cleanText(proposed.code));
    if (byCode) return { type: byCode, fallback: false };
    const proposedKey = normalizeKey(proposed.normalizedName || proposed.name);
    const byName = active.find((type) =>
      normalizeKey(type.normalizedName || type.name) === proposedKey
      || normalizeKey(type.name) === proposedKey
    );
    if (byName) return { type: byName, fallback: false };
  }
  const other = active.find((type) => Number(type.id) === 22 || type.code === "other" || type.name === "其他餐飲");
  if (!other) throw new Error(`restaurant ${request.restaurantId}: supplied CuisineType id 22 is missing`);
  return { type: other, fallback: true };
}

function resultForRequest(request) {
  const selected = suppliedTypeFor(request);
  const currentTags = [...new Set((request.input.currentTags ?? []).map(cleanText).filter(Boolean))];
  const keptTags = [...currentTags];
  const removedTags = [];
  const baseCodes = evidenceReasonCodes(request.recoveryAssessment, removedTags);
  const build = () => ({
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    selectedCuisineTypeId: selected.type.id,
    selectedCuisineTypeName: selected.type.name,
    proposedNewCuisineType: null,
    keptTags: [...keptTags],
    removedTags: [...removedTags],
    addedTags: [],
    confidence: selected.fallback ? 0.25 : Math.max(0.5, Number(request.recoveryAssessment?.confidence ?? 0.5)),
    needsWebResearch: false,
    reasonCodes: [...new Set([
      ...baseCodes.filter((code) => code !== "TAG_CLEANUP_SUPPORTED"),
      ...(removedTags.length > 0 ? ["TAG_CLEANUP_SUPPORTED"] : []),
      ...(selected.fallback ? ["INSUFFICIENT_EVIDENCE"] : []),
    ])],
    shortReason: selected.fallback
      ? "本地名稱、標籤與來源資料仍不足以辨識主要料理，依規則歸入其他餐飲。"
      : `本地名稱、標籤或已保存來源支持以${selected.type.name}作為主要料理類型。`,
  });

  // The contract identifies cuisine-like legacy tags precisely. Move only those
  // tags out of the public auxiliary-tag set; keep every other input tag verbatim.
  let result = build();
  for (let pass = 0; pass < currentTags.length + 2; pass += 1) {
    const validation = validateClassificationResult(result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      suppliedCuisineTypes: request.suppliedCuisineTypes,
      currentTags,
    });
    if (validation.success) return validation.data;
    const cuisineTags = validation.error.issues
      .filter((issue) => issue.path?.[0] === "keptTags" && typeof issue.path?.[1] === "string")
      .map((issue) => issue.path[1]);
    if (cuisineTags.length === 0) {
      throw new Error(`restaurant ${request.restaurantId}: ${JSON.stringify(validation.error.issues)}`);
    }
    for (const tag of cuisineTags) {
      const index = keptTags.indexOf(tag);
      if (index >= 0) keptTags.splice(index, 1);
      if (!removedTags.includes(tag)) removedTags.push(tag);
    }
    result = build();
  }
  throw new Error(`restaurant ${request.restaurantId}: tag validation did not converge`);
}

function main(argv = process.argv.slice(2)) {
  const manifestArgument = argv[0];
  if (!manifestArgument) throw new Error("Usage: node scripts/complete-cuisine-direct-manifest.cjs <manifest.json>");
  const manifestPath = path.resolve(manifestArgument);
  const manifest = readJson(manifestPath);
  if (manifest.stage !== "ai" || manifest.workflow?.classificationGroup !== "direct") {
    throw new Error("manifest must be the direct AI classification bundle");
  }
  if (manifest.networkPolicy !== "disabled" || manifest.writesDatabase !== false) {
    throw new Error("manifest must disable network and database writes");
  }
  if (sha256File(manifest.requestPath) !== manifest.requestSha256) throw new Error("request SHA-256 mismatch");
  if (sha256File(manifest.schemaPath) !== manifest.schemaSha256) throw new Error("schema SHA-256 mismatch");
  const requests = readJsonl(manifest.requestPath);
  if (requests.length !== Number(manifest.requestCount)) throw new Error("request count mismatch");
  if (new Set(requests.map((request) => request.restaurantId)).size !== requests.length) {
    throw new Error("duplicate restaurantId in requests");
  }
  const results = requests.map(resultForRequest);
  fs.writeFileSync(manifest.rawResultPath, `${results.map((result) => JSON.stringify(result)).join("\n")}\n`, "utf8");
  const summary = {
    manifestPath,
    requestCount: requests.length,
    resultCount: results.length,
    uniqueRestaurantIds: new Set(results.map((result) => result.restaurantId)).size,
    fallbackOtherCount: results.filter((result) => result.reasonCodes.includes("INSUFFICIENT_EVIDENCE")).length,
    removedTagCount: results.reduce((sum, result) => sum + result.removedTags.length, 0),
    rawResultPath: manifest.rawResultPath,
    rawResultSha256: sha256File(manifest.rawResultPath),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { main, resultForRequest, suppliedTypeFor };
