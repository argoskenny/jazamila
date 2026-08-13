import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-require-imports */

const eligibility = require("../../lib/web-research/web-research-eligibility.cjs") as any;
const prompts = require("../../lib/web-research/web-research-prompts.cjs") as any;
const sources = require("../../lib/web-research/web-research-sources.cjs") as any;
const contract = require("../../lib/web-research/web-research-contract.cjs") as any;
const pipeline = require("../../lib/web-research/web-research-pipeline.cjs") as any;
const providerModule = require("../../lib/web-research/web-research-provider.cjs") as any;
const webScript = require("../../scripts/prepare-cuisine-web-research.cjs") as any;

const fingerprint = "b".repeat(64);
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

function stage3(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: 42,
    inputFingerprint: fingerprint,
    confidence: 0.4,
    needsAi: true,
    needsWebResearch: false,
    decisionReason: "no-deterministic-evidence",
    originalFoodType: 0,
    originalTags: input.currentTags,
    matchedRules: [],
    aiInput: input,
    ...overrides,
  };
}

function report(results: Array<Record<string, unknown>>) {
  return { mode: "dry-run", readOnly: true, taxonomyVersion: "cuisine-taxonomy-v1.1", results };
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  const [request] = pipeline.buildRequestsFromStage3Report({
    report: report([stage3(overrides)]),
    suppliedCuisineTypes,
    confidenceThreshold: 0.7,
  });
  return request;
}

function fetchedSource(overrides: Record<string, unknown> = {}) {
  const content = `${input.name} ${input.address} ${input.phone} 火鍋 平價`;
  return {
    url: "https://official.example/menu",
    title: "測試火鍋|官方菜單",
    sourceTier: 1,
    sourceKind: "official_menu",
    contentHash: sources.sha256(content),
    content,
    fetched: true,
    matchedName: input.name,
    matchedAddress: input.address,
    matchedPhone: input.phone,
    identityMatch: { name: true, address: true, phone: true, score: 1 },
    supportedTags: [],
    cuisineSignals: ["火鍋"],
    cuisineTypeCodes: ["hot-pot"],
    ...overrides,
  };
}

function validWebResult(request: any, source: any, overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

describe("web research eligibility and identity-bound queries", () => {
  it("only makes low confidence, conflict, candidate, identity-risk, or insufficient rows eligible", () => {
    const high = eligibility.classifyWebEligibility({
      stage3Result: stage3({ confidence: 0.95, needsAi: false }),
    });
    expect(high.eligible).toBe(false);

    const conflict = eligibility.classifyWebEligibility({
      stage3Result: stage3({ confidence: 0.95, matchedRules: [{ field: "tag", code: "hot-pot" }, { field: "tag", code: "cafe" }] }),
    });
    expect(conflict.reasons).toContain("CONFLICTING_TAGS");

    const candidate = eligibility.classifyWebEligibility({
      stage3Result: stage3({ confidence: 0.95, needsAi: false }),
      aiResult: { confidence: 0.9, proposedNewCuisineType: { name: "北歐料理" } },
    });
    expect(candidate.reasons).toContain("NEW_CUISINE_CANDIDATE");

    const missing = eligibility.classifyWebEligibility({
      stage3Result: stage3({ confidence: 0.95, aiInput: { ...input, name: "", address: "" } }),
    });
    expect(missing.reasons).toContain("INSUFFICIENT_INFORMATION");
  });

  it("carries an unresolved AI handoff into Web eligibility", () => {
    const stage3Result = stage3({ confidence: 0, needsWebResearch: true });
    const aiResult = {
      customId: `jazamila-cuisine-ai-v1:r42:f${fingerprint}`,
      restaurantId: 42,
      inputFingerprint: fingerprint,
      status: "unresolved",
      result: {
        selectedCuisineTypeId: null,
        selectedCuisineTypeName: null,
        proposedNewCuisineType: null,
        confidence: 0,
        needsWebResearch: true,
      },
    };
    const requests = pipeline.buildRequestsFromStage3Report({
      report: report([stage3Result]),
      aiResults: [aiResult],
      suppliedCuisineTypes,
      confidenceThreshold: 0.7,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].aiResult).toMatchObject({ needsWebResearch: true });
    expect(requests[0].eligibility.reasons).toContain("EXPLICIT_NEEDS_WEB_RESEARCH");
  });

  it("uses full name, address, city, district, phone, and branch in every query", () => {
    const location = eligibility.identityInputForResult(stage3());
    expect(location).toMatchObject({ city: "台北市", district: "大安區", branchName: "大安店" });
    const queries = eligibility.buildSearchQueries(location);
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      for (const token of [input.name, input.address, "台北市", "大安區", input.phone, "大安店"]) {
        expect(query).toContain(`"${token}"`);
      }
    }
  });

  it("marks same names and branch variants as identity risk", () => {
    const results = [
      stage3({ restaurantId: 42, inputFingerprint: fingerprint, confidence: 0.95, needsAi: false }),
      stage3({ restaurantId: 43, inputFingerprint: "c".repeat(64), confidence: 0.95, needsAi: false, aiInput: { ...input, address: "台北市信義區松仁路2號" } }),
    ];
    const risks = eligibility.identityRiskIndex(results);
    expect([...risks.get(42)]).toContain("SAME_NAME_OR_BRANCH_RISK");
    expect([...risks.get(43)]).toContain("SAME_NAME_OR_BRANCH_RISK");
  });
});

describe("web prompt, source retrieval, and evidence rules", () => {
  it("keeps the supplied web prompt versioned and includes structured candidate types", () => {
    const bundle = prompts.buildWebResearchPromptBundle({
      name: input.name,
      address: input.address,
      phone: input.phone,
      currentTags: input.currentTags,
      candidateCuisineTypes: suppliedCuisineTypes,
    });
    expect(bundle.promptVersion).toBe("cuisine-web-research-prompt-v1");
    expect(bundle.userPrompt).toContain("必須確認搜尋結果對應相同名稱與相同地址");
    expect(bundle.userPrompt).not.toContain("只看搜尋摘要");
    expect(bundle.userPrompt).toContain('"火鍋"');
    expect(bundle.userPromptFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("does not treat a search snippet as evidence; a fetched page is required", async () => {
    const result = await sources.collectFetchedEvidence({
      input,
      searchQueries: ["identity query"],
      searchImpl: async () => [{ url: "https://official.example/menu", title: "官方菜單", snippet: "搜尋摘要" }],
      fetchImpl: async () => ({
        url: "https://official.example/menu",
        title: "官方菜單",
        sourceKind: "official_menu",
        content: `${input.name} ${input.address} ${input.phone} 火鍋`,
        cuisineSignals: ["火鍋"],
      }),
      clock: () => new Date("2026-08-11T03:00:00.000Z"),
    });
    expect(result.searchHits[0].snippet).toBe("搜尋摘要");
    expect(result.fetchedSources).toHaveLength(1);
    expect(result.fetchedSources[0]).not.toHaveProperty("snippet");
    expect(result.fetchedSources[0]).toMatchObject({ fetched: true, sourceTier: 1, sourceKind: "official_menu" });
    expect(result.fetchedSources[0].contentHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("accepts only a traceable fetched source and rejects lower-tier-only override", () => {
    const request = makeRequest();
    const official = fetchedSource();
    const valid = contract.validateWebResearchResult(validWebResult(request, official), {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      input: request.input,
      currentTags: request.currentTags,
      searchQueries: request.searchQueries,
      suppliedCuisineTypes,
      fetchedSources: [official],
    });
    expect(valid.success).toBe(true);

    const article = fetchedSource({
      url: "https://article.example/review",
      title: "一般文章",
      sourceTier: 5,
      sourceKind: "article",
      cuisineSignals: ["咖啡廳"],
      cuisineTypeCodes: ["cafe"],
    });
    const invalid = contract.validateWebResearchResult(validWebResult(request, article), {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      input: request.input,
      currentTags: request.currentTags,
      searchQueries: request.searchQueries,
      suppliedCuisineTypes,
      fetchedSources: [official, article],
    });
    expect(invalid.success).toBe(false);
    expect(invalid.error.issues.map((issue: any) => issue.message).join(" ")).toContain("lower-tier");
  });

  it("allows an added auxiliary tag only when the fetched source explicitly supports it", () => {
    const request = makeRequest();
    const unsupportedSource = fetchedSource();
    const unsupportedResult = validWebResult(request, unsupportedSource, {
      keptTags: ["平價", "人氣"],
      addedTags: ["人氣"],
      evidence: [{
        url: unsupportedSource.url,
        title: unsupportedSource.title,
        sourceTier: unsupportedSource.sourceTier,
        sourceKind: unsupportedSource.sourceKind,
        matchedName: unsupportedSource.matchedName,
        matchedAddress: unsupportedSource.matchedAddress,
        matchedPhone: unsupportedSource.matchedPhone,
        contentHash: unsupportedSource.contentHash,
        supportedTags: [],
        cuisineSignals: ["火鍋"],
      }],
    });
    expect(contract.validateWebResearchResult(unsupportedResult, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      input: request.input,
      currentTags: request.currentTags,
      searchQueries: request.searchQueries,
      suppliedCuisineTypes,
      fetchedSources: [unsupportedSource],
    }).success).toBe(false);

    const source = fetchedSource({ supportedTags: ["人氣"] });
    const result = validWebResult(request, source, {
      keptTags: ["平價", "人氣"],
      addedTags: ["人氣"],
      evidence: [{
        url: source.url,
        title: source.title,
        sourceTier: source.sourceTier,
        sourceKind: source.sourceKind,
        matchedName: source.matchedName,
        matchedAddress: source.matchedAddress,
        matchedPhone: source.matchedPhone,
        contentHash: source.contentHash,
        supportedTags: ["人氣"],
        cuisineSignals: ["火鍋"],
      }],
    });
    expect(contract.validateWebResearchResult(result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      input: request.input,
      currentTags: request.currentTags,
      searchQueries: request.searchQueries,
      suppliedCuisineTypes,
      fetchedSources: [source],
    }).success).toBe(true);
  });

  it("keeps an unresolved result conservative when no identity is confirmed", () => {
    const request = makeRequest();
    const unresolved = contract.createSafeUnresolvedResult({
      request,
      checkedAt: "2026-08-11T03:00:00.000Z",
      reason: "NO_FETCHED_EVIDENCE",
    });
    const result = contract.validateWebResearchResult(unresolved, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      input: request.input,
      currentTags: request.currentTags,
      searchQueries: request.searchQueries,
      suppliedCuisineTypes,
      fetchedSources: [],
    });
    expect(result.success).toBe(true);
    expect(unresolved).toMatchObject({ selectedCuisineType: null, confidence: 0, matchConfidence: 0, evidenceUrls: [] });
  });
});

describe("web research pipeline and mocked provider", () => {
  it("filters only eligible rows and round-trips the web custom ID", () => {
    const high = stage3({
      restaurantId: 1,
      inputFingerprint: "1".repeat(64),
      confidence: 0.95,
      needsAi: false,
      aiInput: { ...input, name: "另一家餐廳", address: "台北市中山區中山路3號" },
    });
    const low = stage3({ restaurantId: 42 });
    const requests = pipeline.buildRequestsFromStage3Report({ report: report([high, low]), suppliedCuisineTypes });
    expect(requests).toHaveLength(1);
    expect(requests[0].restaurantId).toBe(42);
    expect(pipeline.restaurantIdFromCustomId(requests[0].customId)).toBe(42);
    expect(pipeline.parseCustomId(requests[0].customId).inputFingerprint).toBe(fingerprint);
    expect(requests[0].eligibility.reasons).toContain("LOW_CONFIDENCE");
  });

  it("accepts a mocked fetched official page and structured model result", async () => {
    const request = makeRequest();
    const source = fetchedSource();
    const modelResult = validWebResult(request, source);
    const adapter = new providerModule.WebResearchProviderAdapter({
      searchImpl: async () => [{ url: source.url, title: source.title, snippet: "不要直接使用" }],
      fetchImpl: async () => ({
        url: source.url,
        title: source.title,
        sourceKind: source.sourceKind,
        sourceTier: source.sourceTier,
        content: source.content,
        cuisineSignals: source.cuisineSignals,
        cuisineTypeCodes: source.cuisineTypeCodes,
        supportedTags: source.supportedTags,
      }),
      clock: () => new Date("2026-08-11T03:00:00.000Z"),
      modelAdapter: {
        classify: async ({ customId, validateResult, validationContext }: any) => {
          const validation = validateResult(modelResult, validationContext);
          expect(validation.success).toBe(true);
          return { status: "ok", customId, attempts: 1, providerRequestId: "mock-web-1", result: modelResult };
        },
      },
    });
    const result = await pipeline.runWebResearchRequests({ requests: [request], provider: adapter });
    expect(result[0]).toMatchObject({
      status: "ok",
      restaurantId: 42,
      sourceReferences: [{ file: "source.json", id: "42" }],
      result: { selectedCuisineType: { name: "火鍋" } },
    });
    expect(result[0].audit.fetchedSources[0].contentHash).toBe(source.contentHash);
  });

  it("returns unresolved when search hits cannot be fetched and never calls the model", async () => {
    let modelCalls = 0;
    const request = makeRequest();
    const adapter = new providerModule.WebResearchProviderAdapter({
      searchImpl: async () => [{ url: "https://missing.example", title: "只有摘要", snippet: "不算證據" }],
      fetchImpl: async () => { throw new Error("network unavailable"); },
      modelAdapter: { classify: async () => { modelCalls += 1; return null; } },
    });
    const result = await pipeline.runWebResearchRequests({ requests: [request], provider: adapter });
    expect(result[0]).toMatchObject({ status: "unresolved", result: { unresolvedReason: "NO_FETCHED_EVIDENCE", selectedCuisineType: null } });
    expect(modelCalls).toBe(0);
  });

  it("keeps the dry-run CLI read-only and rejects apply mode", () => {
    expect(webScript.parseArgs(["--help"]).help).toBe(true);
    expect(() => webScript.parseArgs(["--apply"])).toThrow("Unknown option");
    const scriptSource = fs.readFileSync(path.join(process.cwd(), "scripts", "prepare-cuisine-web-research.cjs"), "utf8");
    expect(scriptSource).not.toMatch(/PrismaClient|prisma\.(create|update|delete|upsert|\$transaction)/u);
  });
});
