#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateClassificationResult } = require("../lib/ai/cuisine-classification-contract.cjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

function writeJsonl(filePath, records) {
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function unresolvedDecisionFor(request) {
  const keptTags = [...request.input.currentTags];
  const removedTags = [];
  const build = () => ({
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    selectedCuisineTypeId: null,
    selectedCuisineTypeName: null,
    proposedNewCuisineType: null,
    keptTags,
    removedTags,
    addedTags: [],
    confidence: 0,
    needsWebResearch: true,
    reasonCodes: ["INSUFFICIENT_EVIDENCE", "WEB_RESEARCH_REQUIRED", "NO_NEW_MARKETING_TAG", ...(removedTags.length ? ["TAG_CLEANUP_SUPPORTED"] : [])],
    shortReason: "目前證據不足以可靠分類；維持 unresolved，等待 AI 或可追溯的網路證據，不自動歸入其他餐飲。",
  });
  let result = build();
  for (let pass = 0; pass < 3; pass += 1) {
    const validation = validateClassificationResult(result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      suppliedCuisineTypes: request.suppliedCuisineTypes,
      currentTags: request.input.currentTags,
    });
    if (validation.success) return validation.data;
    const cuisineTags = validation.error.issues
      .filter((issue) => issue.path?.[0] === "keptTags" && typeof issue.path?.[1] === "string")
      .map((issue) => issue.path[1]);
    if (cuisineTags.length === 0) throw new Error(`AI fallback validation failed for restaurant ${request.restaurantId}: ${JSON.stringify(validation.error.issues)}`);
    for (const tag of cuisineTags) {
      const index = keptTags.indexOf(tag);
      if (index >= 0) keptTags.splice(index, 1);
      if (!removedTags.includes(tag)) removedTags.push(tag);
    }
    result = build();
  }
  throw new Error(`AI fallback validation did not converge for restaurant ${request.restaurantId}`);
}

function main(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const requestsPath = path.resolve(args.get("--requests") || "");
  const cuisineTypesPath = path.resolve(args.get("--cuisine-types") || "");
  const outputDir = path.resolve(args.get("--output-dir") || "");
  if (!requestsPath || !cuisineTypesPath || !outputDir) throw new Error("--requests, --cuisine-types and --output-dir are required");
  fs.mkdirSync(outputDir, { recursive: true });
  const requests = readJsonl(requestsPath);
  const cuisineTypesDocument = readJson(cuisineTypesPath);
  const cuisineTypes = cuisineTypesDocument.cuisineTypes ?? cuisineTypesDocument;
  if (cuisineTypes.filter((type) => type.status === "active").length === 0) throw new Error("at least one active CuisineType is required");
  const results = requests.map((request) => ({
    mode: "dry-run",
    readOnly: true,
    customId: request.customId,
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    snapshotHash: request.snapshotHash,
    sourceReferences: request.input.knownSourceReferences ?? [],
    savedSourceCuisineTypes: request.input.savedSourceCuisineTypes ?? [],
    promptVersion: request.promptVersion,
    modelVersion: request.modelVersion,
    status: "unresolved",
    attempts: 0,
    providerRequestId: null,
    result: unresolvedDecisionFor(request),
  }));
  const resultsPath = path.join(outputDir, "ai-results.jsonl");
  writeJsonl(resultsPath, results);
  const webEvidencePath = path.join(outputDir, "web-evidence.jsonl");
  writeJsonl(webEvidencePath, results.map((record) => ({
    restaurantId: record.restaurantId,
    inputFingerprint: record.inputFingerprint,
    status: "pending",
    reason: "Classification remains unresolved and requires identity-bound Web research with fetched evidence.",
    urls: [],
    fetchedContentHashes: [],
  })));
  const manifestPath = path.join(outputDir, "manifest.json");
  const manifest = {
    schemaVersion: "jazamila-cuisine-completion-manifest-v1",
    createdAt: new Date().toISOString(),
    promptVersion: requests[0]?.promptVersion ?? null,
    modelVersion: requests[0]?.modelVersion ?? null,
    policy: "Never convert missing evidence into other cuisine; unresolved rows require AI or identity-bound Web evidence.",
    requestCount: requests.length,
    resultCount: results.length,
    unresolvedCount: results.length,
    files: {
      requests: { path: requestsPath, sha256: hashFile(requestsPath) },
      cuisineTypes: { path: cuisineTypesPath, sha256: hashFile(cuisineTypesPath) },
      results: { path: resultsPath, sha256: hashFile(resultsPath) },
      webEvidence: { path: webEvidencePath, sha256: hashFile(webEvidencePath) },
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputDir, manifestPath, ...manifest }, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}

module.exports = { main, unresolvedDecisionFor };
