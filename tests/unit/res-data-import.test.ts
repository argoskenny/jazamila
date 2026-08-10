import { createRequire } from "node:module";
import { prisma } from "@/lib/db/prisma";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const importer = require("../../scripts/res-data-importer.cjs") as {
  applyImport: (options: Record<string, unknown>) => Promise<Record<string, number>>;
  buildLocationCatalog: (documents: SourceDocument[], lookup?: Record<string, unknown>) => LocationCatalog;
  legacyFoodType: (tags: string[]) => number;
  prepareImport: (options: {
    documents: SourceDocument[];
    existingLookup?: Record<string, unknown>;
    maxPriceTwd?: number;
    dedupeDecisions?: Array<Record<string, unknown>>;
  }) => PreparedImport;
  normalizeDisplayAddress: (address: string, city: string, district: string) => string;
  restaurantIdentityKey: (address: string, phone: string | null) => string | null;
  stableImportKey: (datasetId: string) => string;
};
const { parseArgs } = require("../../scripts/import-res-data-to-sqlite.cjs") as {
  parseArgs: (argv: string[]) => Record<string, unknown>;
};

type SourceDocument = {
  file: string;
  document: {
    collection: { city: string; district: string; collected_at: string };
    restaurants: Array<Record<string, unknown>>;
  };
};

type LocationCatalog = {
  cities: Array<{
    code: string;
    name: string;
    legacyRegion: number;
    districts: Array<{ code: string; name: string; legacySection: number }>;
  }>;
};

type PreparedImport = {
  catalog: LocationCatalog;
  restaurants: Array<{ importKey: string; data: Record<string, unknown> }>;
  issues: Array<{ status: string; reasonCode: string; importKey: string | null }>;
  summary: Record<string, number | Record<string, number>>;
};

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-001",
    source_id: "external-source-001",
    name: "測試餐廳",
    address: "臺南市安南區測試路1號",
    phone: null,
    price_range_twd_per_person: { min: 100, max: 300 },
    cuisine_types: ["台式", "小吃"],
    online_rating: {
      platform: "未提供",
      score: null,
      review_count: null,
      review_summary: ["目前沒有可整理的公開評論摘要。"],
    },
    image_url: null,
    business_hours: { average_open_time: null, average_close_time: null },
    ...overrides,
  };
}

function source(file: string, city: string, district: string, restaurants: Array<Record<string, unknown>>): SourceDocument {
  return {
    file,
    document: {
      collection: { city, district, collected_at: "2026-08-10" },
      restaurants,
    },
  };
}

const lookup = {
  regions: [
    { id: 0, label: "都可以" },
    { id: 5, label: "臺南市" },
  ],
  sectionsByRegion: {
    "5": [
      { id: 1, label: "安南區" },
      { id: 2, label: "南區" },
    ],
  },
};

describe("res-data importer", () => {
  it("uses the dataset id for an import key that survives source corrections", () => {
    const first = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [record({
        id: "stable-record-001",
        source_id: "external-old",
        name: "測試餐廳舊名",
        address: "臺南市安南區測試路1號",
      })])],
      existingLookup: lookup,
    });
    const corrected = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [record({
        id: "stable-record-001",
        source_id: "external-new",
        name: "測試餐廳新名",
        address: "臺南市安南區測試路1之1號",
      })])],
      existingLookup: lookup,
    });

    expect(first.restaurants[0].importKey).toBe(corrected.restaurants[0].importKey);
    expect(first.restaurants[0].importKey).toBe(importer.stableImportKey("stable-record-001"));
    expect(first.restaurants[0].importKey).toMatch(/^res-data:v2:[a-f0-9]{64}$/);
    expect(first.restaurants[0].data.sourceId).toBe("external-old");
    expect(corrected.restaurants[0].data.sourceId).toBe("external-new");
  });

  it("isolates duplicate dataset ids before they can collide in SQLite", () => {
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [
        record({ id: "duplicate-id", address: "臺南市安南區測試路1號" }),
        record({ id: "duplicate-id", address: "臺南市安南區測試路2號" }),
      ])],
      existingLookup: lookup,
    });

    expect(prepared.restaurants).toHaveLength(1);
    expect(prepared.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "rejected", reasonCode: "DUPLICATE_DATASET_ID" }),
    ]));
  });

  it("preserves meaningful house-number separators in identity keys", () => {
    expect(importer.restaurantIdentityKey("桃園市楊梅區環東路31-1號", "03 475 6132"))
      .not.toBe(importer.restaurantIdentityKey("桃園市楊梅區環東路311號", "03 475 6132"));
  });

  it("canonicalizes repeated city and district prefixes exactly once", () => {
    expect(importer.normalizeDisplayAddress(
      "300 新竹市北區新竹市北區大同路77號",
      "新竹市",
      "北區"
    )).toBe("新竹市北區大同路77號");
    expect(importer.normalizeDisplayAddress(
      "台中市大里區臺中市大里區德芳南路472-1號",
      "臺中市",
      "大里區"
    )).toBe("臺中市大里區德芳南路472-1號");
  });

  it("maps only explicit small-eat tags to the legacy small-eats cuisine", () => {
    expect(importer.legacyFoodType(["台式小吃", "在地美食"])).toBe(4);
    expect(importer.legacyFoodType(["麵食/小吃"])).toBe(4);
    expect(importer.legacyFoodType(["火鍋", "中式/台式料理"])).toBe(0);
    expect(importer.legacyFoodType(["咖啡", "甜點", "早餐"])).toBe(0);
    expect(importer.legacyFoodType(["日式料理", "小吃"])).toBe(1);
  });

  it("accepts documented nullable phone, image, rating, and business hours", () => {
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [record()])],
      existingLookup: lookup,
    });

    expect(prepared.summary).toMatchObject({
      sourceRecords: 1,
      acceptedUniqueRestaurants: 1,
      rejectedRecords: 0,
      pendingReviewRecords: 0,
    });
    expect(prepared.restaurants[0].data).toMatchObject({
      region: 5,
      section: 1,
      phone: null,
      externalImageUrl: null,
      ratingScore: null,
      businessOpenTime: null,
      reviewSummaryJson: "[]",
    });
    expect(prepared.summary.reviewSummaryQuality).toMatchObject({
      inputSummaries: 1,
      outputSummaries: 0,
      removedNoRating: 1,
      restaurantsWithSummaries: 0,
    });
  });

  it("treats known placeholder image URLs as missing images", () => {
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [record({
        image_url: "https://www.fonfood.com/store/undefined",
        image_usage_status: "no_explicit_prohibition_found",
      })])],
      existingLookup: lookup,
    });

    expect(prepared.restaurants[0].data).toMatchObject({
      externalImageUrl: null,
      originalImage: null,
      imageUrl: null,
    });
    expect(prepared.summary).toMatchObject({ invalidImageUrlsRemoved: 1 });
  });

  it("keeps useful rated summaries while removing boilerplate, navigation noise, and duplicates", () => {
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [record({
        online_rating: {
          platform: "Google",
          score: 4.5,
          review_count: 120,
          review_summary: [
            "湯頭香氣自然，蔬菜與肉品的新鮮度都很好。",
            "湯頭香氣自然，蔬菜與肉品的新鮮度都很好。",
            "上一篇強者運動用品",
            "交通部觀光署觀光資訊資料庫餐飲資料提供店家基本資料，但未提供可解析的網路評論摘要。",
            "愛食記列表顯示 4.5 分、120 則評論",
            "測試餐廳",
            "好吃",
          ],
        },
      })])],
      existingLookup: lookup,
    });

    expect(prepared.restaurants[0].data.reviewSummaryJson).toBe(
      JSON.stringify(["湯頭香氣自然,蔬菜與肉品的新鮮度都很好。"])
    );
    expect(prepared.summary.reviewSummaryQuality).toMatchObject({
      inputSummaries: 7,
      outputSummaries: 1,
      removedDuplicateWithinRestaurant: 1,
      removedBoilerplate: 3,
      removedRestaurantName: 1,
      removedLowSignal: 1,
    });
  });

  it("removes summaries copied across different restaurants", () => {
    const repeatedSummary = "這是一段被大量不同餐廳重複使用的來源頁面文字。";
    const restaurants = Array.from({ length: 2 }, (_, index) => record({
      id: `repeated-${index}`,
      name: `重複摘要測試餐廳 ${index}`,
      address: `臺南市安南區測試路${index + 1}號`,
      online_rating: {
        platform: "Google",
        score: 4.2,
        review_count: 10,
        review_summary: [repeatedSummary],
      },
    }));
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", restaurants)],
      existingLookup: lookup,
    });

    expect(prepared.restaurants.every((restaurant) => restaurant.data.reviewSummaryJson === "[]")).toBe(true);
    expect(prepared.summary.reviewSummaryQuality).toMatchObject({
      inputSummaries: 2,
      outputSummaries: 0,
      removedGloballyRepeated: 2,
    });
  });

  it("caps retained summaries per restaurant", () => {
    const reviewSummary = Array.from({ length: 10 }, (_, index) => `第 ${index + 1} 則有效評論摘要，內容清楚且足夠具體。`);
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [record({
        online_rating: { platform: "Google", score: 4.3, review_count: 80, review_summary: reviewSummary },
      })])],
      existingLookup: lookup,
    });

    expect(JSON.parse(String(prepared.restaurants[0].data.reviewSummaryJson))).toHaveLength(4);
    expect(prepared.summary.reviewSummaryQuality).toMatchObject({ outputSummaries: 4, removedOverLimit: 6 });
  });

  it("corrects collection placement from the address and globally deduplicates", () => {
    const onlineRating = {
      platform: "Google",
      score: 4.3,
      review_count: 50,
      review_summary: ["同一店家跨來源重複的有效評論摘要內容。"],
    };
    const duplicate = record({ id: "source-002", name: "測試，餐廳", online_rating: onlineRating });
    const prepared = importer.prepareImport({
      documents: [
        source("tainan-annan-restaurants.json", "臺南市", "安南區", [record({ online_rating: onlineRating })]),
        source("tainan-nan-restaurants.json", "臺南市", "南區", [duplicate]),
      ],
      existingLookup: lookup,
    });

    expect(prepared.summary).toMatchObject({
      sourceRecords: 2,
      acceptedUniqueRestaurants: 1,
      duplicatesRemoved: 1,
      locationCorrections: 1,
    });
    expect(prepared.restaurants[0].data).toMatchObject({ region: 5, section: 1 });
    expect(prepared.summary.reviewSummaryQuality).toMatchObject({
      outputSummaries: 1,
      removedDuplicateAcrossSources: 1,
    });
  });

  it("isolates unreasonable prices and ambiguous locations", () => {
    const pricePrepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [
        record({ price_range_twd_per_person: { min: 120_480, max: 180_720 } }),
      ])],
      existingLookup: lookup,
    });
    expect(pricePrepared.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "rejected", reasonCode: "PRICE_OUTLIER" }),
    ]));

    const locationPrepared = importer.prepareImport({
      documents: [
        source("tainan-liujia-restaurants.json", "臺南市", "六甲區", [
          record({ address: "臺南市柳營區六甲區測試路1號" }),
        ]),
        source("tainan-liuying-restaurants.json", "臺南市", "柳營區", []),
      ],
      existingLookup: lookup,
    });
    expect(locationPrepared.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "rejected", reasonCode: "LOCATION_CONFLICT" }),
    ]));
  });

  it("keeps same-name same-phone rows with different addresses pending instead of merging", () => {
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [
        record({ id: "source-001", phone: "06 123 4567", address: "臺南市安南區測試路1號" }),
        record({ id: "source-002", phone: "06 123 4567", address: "臺南市安南區測試路2號" }),
      ])],
      existingLookup: lookup,
    });

    expect(prepared.summary).toMatchObject({
      acceptedUniqueRestaurants: 2,
      pendingReviewRecords: 2,
      pendingDuplicateGroups: 1,
    });
    expect(prepared.issues.filter((issue) => issue.reasonCode === "POTENTIAL_DUPLICATE")).toHaveLength(2);
  });

  it("strictly merges different names with the same canonical address and phone", () => {
    const address = "臺南市安南區測試路8號";
    const phone = "06 123 4567";
    const identityKey = importer.restaurantIdentityKey(address, phone)!;
    const prepared = importer.prepareImport({
      documents: [source("tainan-annan-restaurants.json", "臺南市", "安南區", [
        record({ id: "source-old", name: "測試餐廳舊名", address, phone }),
        record({ id: "source-new", name: "測試餐廳新名", address: `臺南市安南區${address}`, phone }),
      ])],
      existingLookup: lookup,
      dedupeDecisions: [{
        identityKey,
        canonicalName: "測試餐廳最新名稱",
        verifiedAt: "2026-08-10",
        verificationUrl: "https://example.com/restaurant",
        confidence: "high",
        resolution: "verified",
      }],
    });

    expect(prepared.restaurants).toHaveLength(1);
    expect(prepared.restaurants[0].data).toMatchObject({
      name: "測試餐廳最新名稱",
      address,
      phone,
    });
    expect(prepared.summary).toMatchObject({
      duplicatesRemoved: 1,
      strictIdentityDuplicateGroups: 1,
      strictIdentityDuplicatesRemoved: 1,
      strictIdentityDecisionCoverage: { researchedGroups: 1, fallbackGroups: 0 },
    });
    expect(prepared.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "resolved", reasonCode: "IDENTITY_DUPLICATE_MERGED" }),
    ]));
  });

  it("preserves existing legacy location ids when extending the catalog", () => {
    const catalog = importer.buildLocationCatalog([
      source("tainan-annan-restaurants.json", "臺南市", "安南區", []),
      source("tainan-nan-restaurants.json", "臺南市", "南區", []),
    ], lookup);

    expect(catalog.cities[0]).toMatchObject({ legacyRegion: 5 });
    expect(catalog.cities[0].districts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "安南區", legacySection: 1 }),
      expect.objectContaining({ name: "南區", legacySection: 2 }),
    ]));
  });

  it("parses safe dry-run and explicit destructive options", () => {
    expect(parseArgs(["--dry-run", "--max-price", "9000", "--batch-size=25"])).toMatchObject({
      dryRun: true,
      replace: false,
      maxPriceTwd: 9000,
      batchSize: 25,
    });
    expect(parseArgs(["--replace", "--prune"])).toMatchObject({ replace: true, prune: true });
  });

  it("rolls back the whole import when a late write fails", async () => {
    const prepared = importer.prepareImport({
      documents: [source("chiayi-city-dong-restaurants.json", "嘉義市", "東區", [record({
        id: "atomic-rollback-record",
        name: "原子性測試餐廳",
        address: "嘉義市東區測試路88號",
      })])],
      existingLookup: {},
    });
    const importKey = prepared.restaurants[0].importKey;
    const duplicateIssue = {
      issueKey: "atomic-rollback-duplicate-issue",
      status: "pending_review",
      severity: "low",
      reasonCode: "ATOMIC_TEST",
      sourceFile: "atomic-test.json",
      sourceId: null,
      importKey,
      details: "force a unique-key failure after restaurant writes",
      payloadJson: "{}",
    };

    await expect(importer.applyImport({
      prisma,
      prepared: { ...prepared, issues: [duplicateIssue, duplicateIssue] },
      batchSize: 10,
    })).rejects.toThrow();

    await expect(prisma.restaurant.count({ where: { importKey } })).resolves.toBe(0);
    await expect(prisma.city.count({ where: { code: "chiayi-city" } })).resolves.toBe(0);
  });

  it("migrates a legacy content-derived key in place through source refs", async () => {
    const prepared = importer.prepareImport({
      documents: [source("chiayi-city-dong-restaurants.json", "嘉義市", "東區", [record({
        id: "legacy-migration-record",
        name: "修正後名稱",
        address: "嘉義市東區測試路99號",
      })])],
      existingLookup: {},
    });
    const legacy = await prisma.restaurant.create({
      data: {
        name: "修正前名稱",
        address: "嘉義市東區舊地址99號",
        importKey: `res-data:v1:${"a".repeat(64)}`,
        sourceRefsJson: JSON.stringify([{ file: "old-file.json", id: "legacy-migration-record" }]),
      },
    });

    try {
      const result = await importer.applyImport({ prisma, prepared, batchSize: 10 });
      const migrated = await prisma.restaurant.findUnique({ where: { importKey: prepared.restaurants[0].importKey } });

      expect(result.migratedImportKeys).toBe(1);
      expect(migrated).toMatchObject({ id: legacy.id, name: "修正後名稱" });
    } finally {
      await prisma.restaurant.deleteMany({ where: { id: legacy.id } });
      await prisma.restaurantImportIssue.deleteMany();
      await prisma.district.deleteMany({ where: { city: { code: "chiayi-city" } } });
      await prisma.city.deleteMany({ where: { code: "chiayi-city" } });
      await prisma.tag.deleteMany({ where: { normalizedName: { in: ["台式", "小吃"] } } });
    }
  });

  it("keeps an assigned v2 key when a merged source record later disappears", async () => {
    const firstPrepared = importer.prepareImport({
      documents: [source("chiayi-city-dong-restaurants.json", "嘉義市", "東區", [
        record({ id: "anchor-a", name: "穩定合併餐廳", address: "嘉義市東區測試路77號" }),
        record({ id: "anchor-b", name: "穩定合併餐廳", address: "嘉義市東區測試路77號" }),
      ])],
      existingLookup: {},
    });
    const assignedKey = firstPrepared.restaurants[0].importKey;

    try {
      await importer.applyImport({ prisma, prepared: firstPrepared, batchSize: 10 });
      const correctedPrepared = importer.prepareImport({
        documents: [source("chiayi-city-dong-restaurants.json", "嘉義市", "東區", [
          record({ id: "anchor-b", name: "穩定合併餐廳新名", address: "嘉義市東區測試路77號" }),
        ])],
        existingLookup: {},
      });
      expect(correctedPrepared.restaurants[0].importKey).not.toBe(assignedKey);

      const result = await importer.applyImport({ prisma, prepared: correctedPrepared, batchSize: 10 });

      expect(result.preservedImportKeys).toBe(1);
      await expect(prisma.restaurant.findUnique({ where: { importKey: assignedKey } })).resolves.toMatchObject({
        name: "穩定合併餐廳新名",
      });
    } finally {
      await prisma.restaurant.deleteMany({ where: { importKey: assignedKey } });
      await prisma.restaurantImportIssue.deleteMany();
      await prisma.district.deleteMany({ where: { city: { code: "chiayi-city" } } });
      await prisma.city.deleteMany({ where: { code: "chiayi-city" } });
      await prisma.tag.deleteMany({ where: { normalizedName: { in: ["台式", "小吃"] } } });
    }
  });

  it("upserts by import_key without duplicating a second run", async () => {
    const prepared = importer.prepareImport({
      documents: [source("chiayi-city-dong-restaurants.json", "嘉義市", "東區", [
        record({
          id: "idempotent-source",
          name: "匯入冪等測試餐廳",
          address: "嘉義市東區測試路100號",
          cuisine_types: ["冪等測試標籤"],
        }),
      ])],
      existingLookup: {},
    });
    const importKey = prepared.restaurants[0].importKey;

    try {
      const first = await importer.applyImport({ prisma, prepared, batchSize: 10 });
      await prisma.restaurant.update({
        where: { importKey },
        data: {
          name: "人工維護名稱",
          closed: 1,
          manualOverrideFields: JSON.stringify(["closed", "name"]),
        },
      });
      const second = await importer.applyImport({ prisma, prepared, batchSize: 10 });

      expect(first.createdRestaurants).toBe(1);
      expect(second.createdRestaurants).toBe(0);
      expect(second.updatedRestaurants).toBe(1);
      await expect(prisma.restaurant.count({ where: { importKey } })).resolves.toBe(1);
      await expect(prisma.restaurant.findUnique({ where: { importKey } })).resolves.toMatchObject({
        name: "人工維護名稱",
        closed: 1,
      });
    } finally {
      await prisma.restaurant.deleteMany({ where: { importKey } });
      await prisma.restaurantImportIssue.deleteMany();
      await prisma.district.deleteMany({ where: { city: { code: "chiayi-city" } } });
      await prisma.city.deleteMany({ where: { code: "chiayi-city" } });
      await prisma.tag.deleteMany({ where: { normalizedName: "冪等測試標籤" } });
    }
  });
});
