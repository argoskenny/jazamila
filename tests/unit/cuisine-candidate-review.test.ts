import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const review = require("../../lib/domain/cuisine-candidate-review.cjs") as {
  applyCandidateDecisions: (review: Record<string, unknown>, decisions: Array<Record<string, unknown>>, types: Array<Record<string, unknown>>) => Record<string, any>;
  buildCandidateReview: (input: Record<string, unknown>) => Record<string, any>;
  normalizeCandidateName: (value: string) => string;
  suggestedMergeFor: (name: string, types: Array<Record<string, unknown>>) => Record<string, any>;
};

const cuisineTypes = [
  { id: 1, code: "japanese", name: "日式料理", normalizedName: "日式料理", status: "active" },
  { id: 2, code: "southeast-asian", name: "東南亞料理", normalizedName: "東南亞料理", status: "active" },
  { id: 3, code: "cafe", name: "咖啡廳", normalizedName: "咖啡廳", status: "active" },
];

function result(overrides: Record<string, unknown> = {}) {
  return {
    mode: "dry-run",
    readOnly: true,
    status: "ok",
    customId: "jazamila-cuisine-ai-v1:r10:f" + "a".repeat(64),
    restaurantId: 10,
    inputFingerprint: "a".repeat(64),
    result: {
      restaurantId: 10,
      inputFingerprint: "a".repeat(64),
      proposedNewCuisineType: {
        name: "南洋料理",
        normalizedName: "南洋料理",
        reason: "來源明確使用南洋料理描述",
      },
      confidence: 0.82,
      shortReason: "saved source supports the candidate",
      ...overrides,
    },
  };
}

describe("cuisine candidate review", () => {
  it("normalizes names and suggests a synonym merge without activating it", () => {
    expect(review.normalizeCandidateName("臺式／料理")).toBe("台式料理");
    const match = review.suggestedMergeFor("南洋料理", cuisineTypes);
    expect(match.suggested).toMatchObject({ id: 2, matchMethod: "synonym" });

    const artifact = review.buildCandidateReview({
      resultRecords: [result()],
      requestRecords: [{
        customId: "jazamila-cuisine-ai-v1:r10:f" + "a".repeat(64),
        input: { name: "南洋小館", address: "臺北市中山區測試路 10 號", phone: "02 1234 5678" },
        knownSourceReferences: [{
          file: "taipei.json",
          id: "source-10",
          sourceId: "external-10",
          sourceUrls: ["https://source.example/restaurants/10"],
        }],
      }],
      cuisineTypes,
    });

    expect(artifact.readOnly).toBe(true);
    expect(artifact.candidates).toHaveLength(1);
    expect(artifact.candidates[0]).toMatchObject({
      name: "南洋料理",
      affectedRestaurantCount: 1,
      averageConfidence: 0.82,
      minimumConfidence: 0.82,
      decision: "pending",
      suggestedMergeCuisineType: { id: 2, matchMethod: "synonym" },
    });
    expect(artifact.candidates[0].representativeRestaurants[0]).toMatchObject({ restaurantId: 10, name: "南洋小館" });
    expect(artifact.candidates[0].evidenceSources[0]).toMatchObject({
      sourceType: "saved-source-ref",
      file: "taipei.json",
      url: "https://source.example/restaurants/10",
    });
  });

  it("requires an explicit merge decision for an existing synonym and keeps other candidates pending", () => {
    const artifact = review.buildCandidateReview({ resultRecords: [result()], cuisineTypes });
    const candidateKey = artifact.candidates[0].candidateKey;
    const merged = review.applyCandidateDecisions(artifact, [{
      candidateKey,
      decision: "merge",
      mergeToCuisineTypeId: 2,
      decisionReason: "南洋料理是東南亞料理既有同義詞",
    }], cuisineTypes);

    expect(merged.candidates[0]).toMatchObject({ decision: "merge", mergeToCuisineTypeId: 2 });
    expect(merged.summary.merge).toBe(1);
    expect(merged.summary.approve).toBe(0);
  });

  it("does not approve an auxiliary marketing word as a CuisineType", () => {
    const artifact = review.buildCandidateReview({
      resultRecords: [result({
        proposedNewCuisineType: { name: "人氣", normalizedName: "人氣", reason: "模型提出" },
      })],
      cuisineTypes,
    });
    expect(() => review.applyCandidateDecisions(artifact, [{
      candidateKey: artifact.candidates[0].candidateKey,
      decision: "approve",
    }], cuisineTypes)).toThrow(/auxiliary/u);
  });
});
