import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-require-imports */

const completion = require("../../scripts/complete-cuisine-ai-results.cjs") as any;
const backup = require("../../scripts/classify-cuisine-unverified-backup.cjs") as any;
const classifier = require("../../lib/domain/deterministic-cuisine-classifier.cjs") as any;
const contract = require("../../lib/ai/cuisine-classification-contract.cjs") as any;

const fingerprint = "d".repeat(64);
const suppliedCuisineTypes = [
  { id: 15, code: "street-food", name: "小吃", normalizedName: "小吃", status: "active" },
  { id: 22, code: "other", name: "其他餐飲", normalizedName: "其他餐飲", status: "active" },
];

describe("unverified cuisine recovery", () => {
  it("keeps a missing-evidence completion unresolved instead of silently selecting other", () => {
    const request = {
      restaurantId: 42,
      inputFingerprint: fingerprint,
      suppliedCuisineTypes,
      input: { currentTags: ["其他餐飲", "平價"] },
    };
    const result = completion.unresolvedDecisionFor(request);
    expect(result).toMatchObject({
      selectedCuisineTypeId: null,
      selectedCuisineTypeName: null,
      proposedNewCuisineType: null,
      keptTags: ["平價"],
      removedTags: ["其他餐飲"],
      confidence: 0,
      needsWebResearch: true,
    });
    expect(result.reasonCodes).toContain("INSUFFICIENT_EVIDENCE");
    expect(result.reasonCodes).toContain("WEB_RESEARCH_REQUIRED");
    expect(contract.validateClassificationResult(result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      suppliedCuisineTypes,
      currentTags: request.input.currentTags,
    }).success).toBe(true);
  });

  it("creates compact read-only recovery output without treating the previous fallback as evidence", () => {
    const record = {
      restaurantId: 42,
      source: { inputFingerprint: null },
      input: {
        name: "民主火雞肉飯",
        note: "料理與特色：在地美食",
        address: "嘉義市東區民族路149號",
        phone: "05 216 2666",
        currentFoodType: 0,
        currentTags: ["在地美食"],
        knownSourceReferences: [],
        savedSourceCuisineTypes: ["在地美食"],
      },
      priorDecision: { selectedCuisineTypeName: "其他餐飲" },
      currentDatabase: { areaNum: "05", telNum: "2162666" },
    };
    const input = backup.inputForRecord(record);
    const output = backup.compactResult(record, classifier.classifyRestaurant(input));
    expect(output).toMatchObject({
      mode: "dry-run",
      readOnly: true,
      callsNetwork: false,
      writesDatabase: false,
      previousFallbackCuisineType: "其他餐飲",
      classificationStatus: "classified",
      proposedCuisineType: { code: "street-food", name: "小吃" },
      needsWebResearch: false,
    });
  });

  it("requires an explicit output directory and never exposes an apply option", () => {
    expect(() => backup.parseArgs([])).toThrow("--output-dir is required");
    expect(() => backup.parseArgs(["--apply"])).toThrow("Unknown option");
    expect(backup.parseArgs(["--output-dir", "/tmp/jazamila-test-output"])).toMatchObject({
      outputDir: "/tmp/jazamila-test-output",
      sampleSize: 5,
    });
  });
});
