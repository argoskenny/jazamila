import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-require-imports */

const aiPipeline = require("../../lib/ai/cuisine-classification-pipeline.cjs") as any;
const webPipeline = require("../../lib/web-research/web-research-pipeline.cjs") as any;
const webSources = require("../../lib/web-research/web-research-sources.cjs") as any;
const prepare = require("../../scripts/prepare-cuisine-codex-batch.cjs") as any;
const validate = require("../../scripts/validate-cuisine-codex-output.cjs") as any;

const fingerprint = "a".repeat(64);
const suppliedCuisineTypes = [
  { id: 12, code: "hot-pot", name: "火鍋", normalizedName: "火鍋", status: "active" },
  { id: 16, code: "cafe", name: "咖啡廳", normalizedName: "咖啡廳", status: "active" },
];

const input = {
  name: "測試火鍋(大安店)",
  address: "台北市大安區仁愛路1號",
  phone: "02-1234-5678",
  currentFoodType: 0,
  currentTags: ["麻辣鍋", "平價"],
  knownSourceReferences: [{ file: "source.json", id: "42" }],
  savedSourceCuisineTypes: [],
};

function stage3() {
  return {
    mode: "dry-run",
    readOnly: true,
    snapshot: { inputHash: "b".repeat(64) },
    results: [{
      restaurantId: 42,
      inputFingerprint: fingerprint,
      taxonomyVersion: "cuisine-taxonomy-v1.1",
      needsAi: true,
      needsWebResearch: false,
      confidence: 0.4,
      originalFoodType: 0,
      originalTags: input.currentTags,
      keptAuxiliaryTags: ["平價"],
      removedCuisineTags: ["麻辣鍋"],
      matchedRules: [],
      aiInput: input,
    }],
  };
}

function validAiResult(request: any) {
  return {
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    selectedCuisineTypeId: 12,
    selectedCuisineTypeName: "火鍋",
    proposedNewCuisineType: null,
    keptTags: ["平價"],
    removedTags: ["麻辣鍋"],
    addedTags: [],
    confidence: 0.95,
    needsWebResearch: false,
    reasonCodes: ["EXPLICIT_CUISINE_TAG", "TAG_CLEANUP_SUPPORTED", "NO_NEW_MARKETING_TAG"],
    shortReason: "現有料理品項 tag 明確支持火鍋，保留平價輔助 tag。",
  };
}

function makeWebResult(request: any, source: any) {
  return {
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    searchQueries: request.searchQueries,
    matchedName: input.name,
    matchedAddress: input.address,
    matchedPhone: input.phone,
    selectedCuisineType: { id: 12, name: "火鍋", normalizedName: "火鍋", status: "active" },
    proposedNewCuisineType: null,
    keptTags: ["平價"],
    removedTags: ["麻辣鍋"],
    addedTags: [],
    confidence: 0.96,
    evidenceUrls: [source.url],
    evidenceTitles: [source.title],
    checkedAt: "2026-08-11T03:00:00.000Z",
    matchConfidence: 1,
    unresolvedReason: null,
    evidence: [{
      url: source.url,
      title: source.title,
      sourceTier: source.sourceTier,
      sourceKind: source.sourceKind,
      matchedName: source.matchedName,
      matchedAddress: source.matchedAddress,
      matchedPhone: source.matchedPhone,
      contentHash: source.contentHash,
      supportedTags: [],
      cuisineSignals: ["火鍋"],
    }],
  };
}

describe("Codex dry-run handoff", () => {
  it("rejects an unconfirmed model label before a batch is handed to Codex", () => {
    expect(() => prepare.configuredModelVersion("codex-cli-session-model-to-confirm")).toThrow(/modelVersion/u);
  });

  it("creates a read-only AI bundle and validates customId/fingerprint mapping", async () => {
    const [request] = aiPipeline.buildRequestsFromStage3Report({
      report: stage3(),
      suppliedCuisineTypes,
      modelVersion: "codex-test-model-v1",
    });
    const sourceRequests = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-codex-source-")), "requests.jsonl");
    fs.writeFileSync(sourceRequests, `${JSON.stringify(request)}\n`, "utf8");
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-codex-ai-"));
    const summary = await prepare.main([
      "--stage", "ai",
      "--requests", sourceRequests,
      "--batch-id", "codex-test-ai-001",
      "--output-dir", outputDir,
      "--codex-cli-version", "codex-cli-test",
    ]);
    const manifest = JSON.parse(fs.readFileSync(summary.manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      readOnly: true,
      writesDatabase: false,
      callsProjectApi: false,
      stage: "ai",
      requestCount: 1,
      modelVersion: "codex-test-model-v1",
    });
    expect(fs.readFileSync(summary.promptPath, "utf8")).toContain("不可使用網路");
    fs.writeFileSync(manifest.rawResultPath, `${JSON.stringify(validAiResult(request))}\n`, "utf8");

    const validation = await validate.main(["--stage", "ai", "--manifest", summary.manifestPath]);
    expect(validation).toMatchObject({ validResults: 1, invalidResults: 0, writesDatabase: false });
    const [envelope] = fs.readFileSync(manifest.validatedResultPath, "utf8")
      .trim().split(/\r?\n/u).map((line) => JSON.parse(line));
    expect(envelope).toMatchObject({
      status: "ok",
      customId: request.customId,
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      promptVersion: request.promptVersion,
      modelVersion: request.modelVersion,
      result: { selectedCuisineTypeId: 12 },
    });
  });

  it("turns a missing Codex result into a safe invalid envelope without writing SQLite", async () => {
    const [request] = aiPipeline.buildRequestsFromStage3Report({
      report: stage3(),
      suppliedCuisineTypes,
      modelVersion: "codex-test-model-v1",
    });
    const sourceRequests = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-codex-source-")), "requests.jsonl");
    fs.writeFileSync(sourceRequests, `${JSON.stringify(request)}\n`, "utf8");
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-codex-missing-"));
    const summary = await prepare.main([
      "--stage", "ai",
      "--requests", sourceRequests,
      "--batch-id", "codex-test-ai-missing",
      "--output-dir", outputDir,
    ]);
    const validation = await validate.main(["--stage", "ai", "--manifest", summary.manifestPath]);
    expect(validation).toMatchObject({ validResults: 0, invalidResults: 1, writesDatabase: false });
    const [envelope] = fs.readFileSync(summary.validatedResultPath, "utf8")
      .trim().split(/\r?\n/u).map((line) => JSON.parse(line));
    expect(envelope).toMatchObject({
      status: "invalid",
      errorCode: "MISSING_CODEX_RESULT",
      result: { selectedCuisineTypeId: null, needsWebResearch: true },
    });
  });

  it("validates Web results against fetched evidence sidecar and preserves source hashes", async () => {
    const webRequest = webPipeline.buildRequestsFromStage3Report({
      report: stage3(),
      suppliedCuisineTypes,
      modelVersion: "codex-test-web-model-v1",
      confidenceThreshold: 0.7,
    })[0];
    const sourceRequests = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-codex-source-")), "requests.jsonl");
    fs.writeFileSync(sourceRequests, `${JSON.stringify(webRequest)}\n`, "utf8");
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-codex-web-"));
    const summary = await prepare.main([
      "--stage", "web",
      "--requests", sourceRequests,
      "--batch-id", "codex-test-web-001",
      "--output-dir", outputDir,
    ]);
    const manifest = JSON.parse(fs.readFileSync(summary.manifestPath, "utf8"));
    const content = `${input.name} ${input.address} ${input.phone} 火鍋 平價`;
    const source = {
      url: "https://official.example/menu",
      title: "測試火鍋｜官方菜單",
      sourceTier: 1,
      sourceKind: "official_menu",
      content,
      contentHash: webSources.sha256(content),
      retrievedAt: "2026-08-11T03:00:00.000Z",
      matchedName: input.name,
      matchedAddress: input.address,
      matchedPhone: input.phone,
      identityMatch: { name: true, address: true, phone: true, score: 1 },
      supportedTags: [],
      cuisineSignals: ["火鍋"],
      cuisineTypeCodes: ["hot-pot"],
      fetched: true,
    };
    fs.writeFileSync(manifest.rawResultPath, `${JSON.stringify(makeWebResult(webRequest, source))}\n`, "utf8");
    fs.writeFileSync(manifest.evidencePath, `${JSON.stringify({
      customId: webRequest.customId,
      restaurantId: webRequest.restaurantId,
      inputFingerprint: webRequest.inputFingerprint,
      fetchedSources: [source],
      audit: {
        searchQueries: webRequest.searchQueries,
        searchHits: [{ query: webRequest.searchQueries[0], url: source.url, title: source.title }],
        searchErrors: [],
        fetchErrors: [],
        sourceConflict: false,
      },
    })}\n`, "utf8");

    const validation = await validate.main(["--stage", "web", "--manifest", summary.manifestPath]);
    expect(validation).toMatchObject({ validResults: 1, invalidResults: 0, writesDatabase: false });
    const [envelope] = fs.readFileSync(manifest.validatedResultPath, "utf8")
      .trim().split(/\r?\n/u).map((line) => JSON.parse(line));
    expect(envelope).toMatchObject({
      status: "ok",
      requestType: "cuisine-web-research",
      audit: { fetchedSources: expect.any(Array) },
      result: { selectedCuisineType: { id: 12 }, evidenceUrls: [source.url] },
    });
  });
});
