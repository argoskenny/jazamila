import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-require-imports */

const classifier = require("../../lib/domain/deterministic-cuisine-classifier.cjs") as {
  TAXONOMY_VERSION: string;
  classifyRestaurant: (input: Record<string, unknown>) => Record<string, unknown>;
  taxonomy: {
    cuisineTypes: Array<{ code: string; name: string; normalizedName: string }>;
    rules: Array<{ id: string }>;
    auxiliaryTags: Array<{ name: string }>;
    ambiguousTerms: Array<{ id: string }>;
  };
};

const taxonomy = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "lib", "domain", "cuisine-taxonomy.v1.json"),
  "utf8"
)) as typeof classifier.taxonomy & { version: string };
const seededCatalog = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "lib", "domain", "cuisine-types.json"),
  "utf8"
)).cuisineTypes as Array<{ code: string; name: string; normalizedName: string }>;

function classify(input: Record<string, unknown>) {
  return classifier.classifyRestaurant({
    restaurantId: 1,
    address: "台北市中正區測試路 1 號",
    phone: "02-1234-5678",
    areaNum: "02",
    telNum: "1234567",
    originalFoodType: 0,
    originalTags: [],
    sourceRefs: [],
    sourceCuisineTypes: [],
    ...input,
  });
}

describe("deterministic cuisine classifier", () => {
  it("keeps the taxonomy versioned and aligned with the controlled CuisineType catalog", () => {
    expect(classifier.TAXONOMY_VERSION).toBe("cuisine-taxonomy-v1");
    expect(taxonomy.version).toBe(classifier.TAXONOMY_VERSION);
    expect(taxonomy.cuisineTypes).toEqual(seededCatalog.map(({ code, name, normalizedName }) => ({ code, name, normalizedName })));
    expect(new Set(taxonomy.rules.map((rule) => rule.id)).size).toBe(taxonomy.rules.length);
    expect(taxonomy.auxiliaryTags.map((tag) => tag.name)).toEqual([
      "人氣", "平價", "吃到飽", "古早味", "排隊", "聚餐", "約會", "親子", "寵物友善"
    ]);
    expect(taxonomy.ambiguousTerms.map((term) => term.id)).toEqual([
      "ambiguous-dessert",
      "ambiguous-breakfast",
      "ambiguous-beef-noodle",
      "ambiguous-taiwanese-street-food"
    ]);
  });

  it("maps explicit legacy foodType and strong name/tag/source evidence to one type", () => {
    expect(classify({ originalFoodType: 1 })).toMatchObject({
      proposedCuisineType: { code: "japanese", name: "日式料理" },
      confidence: 1,
      needsAi: false,
      needsWebResearch: false,
    });
    expect(classify({ name: "老地方壽司店" })).toMatchObject({
      proposedCuisineType: { code: "japanese" },
      needsAi: false,
    });
    expect(classify({ originalTags: ["韓式烤肉", "人氣"] })).toMatchObject({
      proposedCuisineType: { code: "korean" },
      keptAuxiliaryTags: ["人氣"],
      removedCuisineTags: ["韓式烤肉"],
      needsAi: false,
    });
    expect(classify({ sourceCuisineTypes: ["景觀咖啡", "平價"] })).toMatchObject({
      proposedCuisineType: { code: "cafe" },
      keptAuxiliaryTags: [],
      removedCuisineTags: [],
      needsAi: false,
    });
  });

  it("removes cuisine tags while retaining auxiliary tags, including composite tags", () => {
    expect(classify({ originalTags: ["涮涮鍋吃到飽", "平價", "聚餐"] })).toMatchObject({
      proposedCuisineType: { code: "hot-pot" },
      keptAuxiliaryTags: ["吃到飽", "平價", "聚餐"],
      removedCuisineTags: ["涮涮鍋吃到飽"],
      normalizedTags: ["涮涮鍋吃到飽", "平價", "聚餐"],
    });
    expect(classify({ originalTags: ["景觀咖啡", "日式建築"] })).toMatchObject({
      proposedCuisineType: { code: "cafe" },
      keptAuxiliaryTags: ["日式建築"],
      removedCuisineTags: ["景觀咖啡"],
      needsAi: false,
    });
  });

  it("keeps ambiguous terms unclassified without enough context", () => {
    for (const input of [
      { name: "午後甜點" , originalTags: ["甜點"] },
      { name: "早餐時光", originalTags: ["早餐"] },
      { name: "老張牛肉麵", originalTags: ["牛肉麵"] },
      { name: "台式小吃名店", originalTags: ["台式小吃"] },
    ]) {
      const result = classify(input);
      expect(result.proposedCuisineType).toBeNull();
      expect(result.needsAi).toBe(true);
      expect(result.needsWebResearch).toBe(false);
    }
    expect(classify({ name: "小樹甜點店", originalTags: ["甜點"] })).toMatchObject({
      proposedCuisineType: { code: "dessert" },
      needsAi: false,
    });
    expect(classify({ name: "早午餐日記" })).toMatchObject({
      proposedCuisineType: { code: "breakfast-brunch" },
      needsAi: false,
    });
  });

  it("does not guess when evidence conflicts", () => {
    const result = classify({ originalTags: ["日式料理", "韓式料理", "人氣"] });
    expect(result.proposedCuisineType).toBeNull();
    expect(result.decisionReason).toBe("conflicting-cuisine-evidence");
    expect(result.keptAuxiliaryTags).toEqual(["人氣"]);
    expect(result.removedCuisineTags).toEqual(["日式料理", "韓式料理"]);
    expect(result.needsAi).toBe(true);
  });

  it("is deterministic and fingerprints all classification inputs", () => {
    const input = {
      restaurantId: 42,
      name: "一致性咖啡店",
      address: "台北市大安區測試路 42 號",
      phone: "02-2222-3333",
      originalFoodType: 0,
      originalTags: ["人氣", "咖啡"],
      sourceRefs: [{ file: "taipei.json", id: "42", sourceId: "source-42" }],
      sourceCuisineTypes: ["咖啡"],
    };
    const first = classifier.classifyRestaurant(input);
    const second = classifier.classifyRestaurant(input);
    expect(second).toEqual(first);
    expect(first.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(classifier.classifyRestaurant({ ...input, phone: "02-9999-9999" }).inputFingerprint)
      .not.toBe(first.inputFingerprint);
  });

  it("preserves saved source URLs for evidence without changing identity fingerprints", () => {
    const sourceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-cuisine-source-"));
    fs.writeFileSync(path.join(sourceDirectory, "saved.json"), JSON.stringify({
      restaurants: [{
        id: "saved-42",
        source_id: "source-42",
        name: "來源餐廳",
        address: "台北市中正區來源路 1 號",
        sources: ["https://source.example/restaurants/42"],
        cuisine_types: ["火鍋"],
      }],
    }), "utf8");
    const sourceScript = require("../../scripts/classify-cuisine-deterministic.cjs") as any;
    const sourceIndex = sourceScript.loadSavedSourceIndex(sourceDirectory);
    const evidence = sourceScript.sourceEvidenceFor({
      sourceRefsJson: JSON.stringify([{ file: "saved.json", id: "saved-42", sourceId: "source-42" }]),
    }, sourceIndex.index);
    expect(evidence.evidence[0]).toMatchObject({ sourceUrls: ["https://source.example/restaurants/42"] });
    expect(evidence.refs[0]).toMatchObject({ sourceUrls: ["https://source.example/restaurants/42"] });
    expect(classifier.classifyRestaurant({
      restaurantId: 42,
      name: "來源餐廳",
      sourceRefs: evidence.refs,
      sourceCuisineTypes: ["火鍋"],
    }).inputFingerprint).toBe(classifier.classifyRestaurant({
      restaurantId: 42,
      name: "來源餐廳",
      sourceRefs: [{ file: "saved.json", id: "saved-42", sourceId: "source-42" }],
      sourceCuisineTypes: ["火鍋"],
    }).inputFingerprint);
  });

  it("keeps the dry-run script read-only and rejects an apply mode", () => {
    const scriptPath = path.join(process.cwd(), "scripts", "classify-cuisine-deterministic.cjs");
    const scriptSource = fs.readFileSync(scriptPath, "utf8");
    expect(scriptSource).not.toMatch(/prisma\.(create|update|delete|upsert|\$transaction)/u);

    const { parseArgs } = require("../../scripts/classify-cuisine-deterministic.cjs") as {
      parseArgs: (args: string[]) => { dryRun: boolean; sampleSize: number };
    };
    expect(parseArgs(["--dry-run"])).toMatchObject({ dryRun: true, sampleSize: 12 });
    expect(() => parseArgs(["--apply"])).toThrow("Unknown option");
  });
});
