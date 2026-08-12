import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const apply = require("../../lib/domain/cuisine-apply.cjs") as {
  fingerprintForRestaurant: (restaurant: Record<string, unknown>, savedSourceCuisineTypes?: string[]) => string;
  indexClassificationResults: (input: Record<string, unknown>) => Map<number, any>;
  planRestaurantChange: (input: Record<string, unknown>) => Record<string, any>;
};
const cli = require("../../scripts/apply-cuisine-classification.cjs") as {
  parseArgs: (argv: string[]) => Record<string, any>;
};
const review = require("../../lib/domain/cuisine-candidate-review.cjs") as {
  applyCandidateDecisions: (review: Record<string, unknown>, decisions: Array<Record<string, unknown>>, types: Array<Record<string, unknown>>) => Record<string, any>;
  buildCandidateReview: (input: Record<string, unknown>) => Record<string, any>;
};

const types = [
  { id: 12, code: "hot-pot", name: "火鍋", normalizedName: "火鍋", status: "active" },
  { id: 16, code: "cafe", name: "咖啡廳", normalizedName: "咖啡廳", status: "active" },
];

function restaurant(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    name: "測試火鍋店",
    address: "臺北市中山區測試路 101 號",
    phone: "02 1234 5678",
    areaNum: "02",
    telNum: "12345678",
    foodType: 0,
    sourceRefsJson: JSON.stringify([{ file: "taipei.json", id: "source-101", sourceId: "external-101" }]),
    manualOverrideFields: null,
    cuisineTypeId: null,
    tags: [
      { restaurantId: 101, tagId: 1, position: 0, owner: "source", sourceName: "火鍋", isPublic: true, tag: { name: "火鍋", normalizedName: "火鍋" } },
      { restaurantId: 101, tagId: 2, position: 1, owner: "source", sourceName: "吃到飽", isPublic: true, tag: { name: "吃到飽", normalizedName: "吃到飽" } },
    ],
    ...overrides,
  };
}

function classification(row: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: row.id,
    inputFingerprint: apply.fingerprintForRestaurant(row),
    selectedCuisineTypeId: 12,
    selectedCuisineTypeName: "火鍋",
    proposedNewCuisineType: null,
    keptTags: ["吃到飽"],
    removedTags: ["火鍋"],
    addedTags: [],
    confidence: 0.95,
    reasonCodes: ["EXPLICIT_CUISINE_TAG"],
    ...overrides,
  };
}

describe("cuisine apply planning", () => {
  it("defaults to dry-run and requires an explicit batch id for writes", () => {
    expect(cli.parseArgs(["--ai-results", "results.jsonl", "--restaurant-id", "101", "--limit", "1"]))
      .toMatchObject({ apply: false, batchId: null, restaurantIds: [101], limit: 1 });
    expect(() => cli.parseArgs(["--ai-results", "results.jsonl", "--apply"])).toThrow(/batch-id/u);
  });

  it("preserves the raw source tag but removes it from public auxiliary tags", () => {
    const row = restaurant();
    const indexed = apply.indexClassificationResults({
      deterministicRecords: [],
      aiRecords: [classification(row)],
      webRecords: [],
      activeCuisineTypes: types,
    });
    const plan = apply.planRestaurantChange({
      restaurant: row,
      classification: indexed.get(101),
      review: null,
      activeCuisineTypes: types,
    });

    expect(plan.status).toBe("ready");
    expect(plan.after.cuisineTypeId).toBe(12);
    expect(plan.after.tags).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "火鍋", owner: "ai", isPublic: false, sourceName: "火鍋" }),
      expect.objectContaining({ name: "吃到飽", isPublic: true, owner: "source" }),
    ]));
  });

  it("does not delete or hide a manual tag even when the decision explicitly removes it", () => {
    const row = restaurant({
      tags: [{ restaurantId: 101, tagId: 1, position: 0, owner: "manual", sourceName: "火鍋", isPublic: true, tag: { name: "火鍋", normalizedName: "火鍋" } }],
    });
    const indexed = apply.indexClassificationResults({ deterministicRecords: [], aiRecords: [classification(row)], webRecords: [], activeCuisineTypes: types });
    const plan = apply.planRestaurantChange({ restaurant: row, classification: indexed.get(101), review: null, activeCuisineTypes: types });

    expect(plan.status).toBe("ready");
    expect(plan.protectedTags).toEqual(["火鍋"]);
    expect(plan.after.tags[0]).toMatchObject({ owner: "manual", isPublic: true });
    expect(plan.after.cuisineTypeId).toBe(12);
  });

  it("rejects stale result fingerprints before any apply plan is ready", () => {
    const row = restaurant();
    const indexed = apply.indexClassificationResults({
      deterministicRecords: [],
      aiRecords: [classification(row, { inputFingerprint: "b".repeat(64) })],
      webRecords: [],
      activeCuisineTypes: types,
    });
    const plan = apply.planRestaurantChange({ restaurant: row, classification: indexed.get(101), review: null, activeCuisineTypes: types });
    expect(plan.status).toBe("fingerprint-mismatch");
  });

  it("canonicalizes duplicate saved-source cuisine values before fingerprint validation", () => {
    const row = restaurant();
    const withDuplicateSource = apply.fingerprintForRestaurant(row, ["火鍋", "火鍋"]);
    const withUniqueSource = apply.fingerprintForRestaurant(row, ["火鍋"]);
    expect(withDuplicateSource).toBe(withUniqueSource);

    const indexed = apply.indexClassificationResults({
      deterministicRecords: [],
      aiRecords: [classification(row, {
        inputFingerprint: withUniqueSource,
        savedSourceCuisineTypes: ["火鍋", "火鍋"],
      })],
      webRecords: [],
      activeCuisineTypes: types,
    });
    const plan = apply.planRestaurantChange({ restaurant: row, classification: indexed.get(101), review: null, activeCuisineTypes: types });
    expect(plan.status).toBe("ready");
  });

  it("keeps an approved new type out of plans until the explicit apply phase", () => {
    const row = restaurant({ name: "南洋測試店", tags: [{ restaurantId: 101, tagId: 2, position: 0, owner: "source", sourceName: "吃到飽", isPublic: true, tag: { name: "吃到飽", normalizedName: "吃到飽" } }] });
    const direct = {
      restaurantId: 101,
      inputFingerprint: apply.fingerprintForRestaurant(row),
      proposedNewCuisineType: { name: "南洋料理", normalizedName: "南洋料理", reason: "需要人工審核" },
      selectedCuisineTypeId: null,
      selectedCuisineTypeName: null,
      keptTags: ["吃到飽"],
      removedTags: [],
      addedTags: [],
      confidence: 0.72,
    };
    const artifact = review.buildCandidateReview({ resultRecords: [direct], cuisineTypes: types });
    const approved = review.applyCandidateDecisions(artifact, [{ candidateKey: artifact.candidates[0].candidateKey, decision: "approve" }], types);
    const indexed = apply.indexClassificationResults({ deterministicRecords: [], aiRecords: [direct], webRecords: [], activeCuisineTypes: types });
    const plan = apply.planRestaurantChange({ restaurant: row, classification: indexed.get(101), review: approved, activeCuisineTypes: types });

    expect(plan.status).toBe("ready");
    expect(plan.requiresCuisineCreation).toBe(true);
    expect(plan.after.cuisineTypeId).toBeNull();
    expect(plan.candidateDecision.status).toBe("create-candidate");
  });
});
