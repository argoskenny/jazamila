import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-require-imports */

const contract = require("../../lib/ai/cuisine-classification-contract.cjs") as any;
const prompts = require("../../lib/ai/cuisine-classification-prompts.cjs") as any;
const providerModule = require("../../lib/ai/cuisine-classification-provider.cjs") as any;
const pipeline = require("../../lib/ai/cuisine-classification-pipeline.cjs") as any;
const aiScript = require("../../scripts/prepare-cuisine-ai-classification.cjs") as any;

const fingerprint = "a".repeat(64);
const suppliedCuisineTypes = [
  { id: 12, code: "hot-pot", name: "火鍋", normalizedName: "火鍋", status: "active" },
  { id: 16, code: "cafe", name: "咖啡廳", normalizedName: "咖啡廳", status: "active" },
];

function output(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: 42,
    inputFingerprint: fingerprint,
    selectedCuisineTypeId: null,
    selectedCuisineTypeName: null,
    proposedNewCuisineType: null,
    keptTags: ["吃到飽", "平價"],
    removedTags: ["麻辣鍋"],
    addedTags: [],
    confidence: 0.94,
    needsWebResearch: false,
    reasonCodes: ["EXPLICIT_CUISINE_TAG", "TAG_CLEANUP_SUPPORTED", "NO_NEW_MARKETING_TAG"],
    shortReason: "明確料理標籤支持火鍋，並保留輔助標籤。",
    ...overrides,
  };
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: 42,
    inputFingerprint: fingerprint,
    suppliedCuisineTypes,
    currentTags: ["麻辣鍋", "吃到飽", "平價"],
    ...overrides,
  };
}

function fakeResponse(body: unknown, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    json: async () => body,
  };
}

function providerResultFor(result: Record<string, unknown>) {
  return {
    id: "mock-request-1",
    choices: [{ message: { content: JSON.stringify(result) } }],
  };
}

describe("AI cuisine classification contract", () => {
  it("uses a strict schema and rejects unknown fields", () => {
    expect(contract.classificationJsonSchema.additionalProperties).toBe(false);
    expect(contract.classificationJsonSchema.required).toContain("selectedCuisineTypeId");
    expect(contract.validateSchemaOnly({ ...output(), unexpected: true }).success).toBe(false);
    expect(contract.validateSchemaOnly(output()).success).toBe(true);
  });

  it("enforces one selected type or one candidate, never both", () => {
    const result = contract.validateClassificationResult(output({
      selectedCuisineTypeId: 12,
      selectedCuisineTypeName: "火鍋",
      proposedNewCuisineType: {
        name: "北歐料理",
        normalizedName: "北歐料理",
        reason: "現有類型沒有適用項目。",
      },
    }), context());
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue: any) => issue.message).join(" ")).toContain("oneOf");
  });

  it("accepts a supplied active type and rejects cuisine text left in kept tags", () => {
    const valid = contract.validateClassificationResult(output({
      selectedCuisineTypeId: 12,
      selectedCuisineTypeName: "火鍋",
    }), context());
    expect(valid.success).toBe(true);

    const invalid = contract.validateClassificationResult(output({
      keptTags: ["吃到飽", "麻辣鍋"],
      removedTags: [],
    }), context());
    expect(invalid.success).toBe(false);
    expect(invalid.error.issues.map((issue: any) => issue.message).join(" ")).toContain("cuisine");
  });

  it("requires evidence for added tags and allows explicit synonym normalization", () => {
    const unsupported = contract.validateClassificationResult(output({
      keptTags: ["吃到飽", "平價", "人氣"],
      addedTags: ["人氣"],
      reasonCodes: ["TAG_SYNONYM_NORMALIZED", "TAG_CLEANUP_SUPPORTED"],
    }), context());
    expect(unsupported.success).toBe(false);

    const normalized = contract.validateClassificationResult(output({
      keptTags: ["約會"],
      removedTags: ["適合約會"],
      addedTags: ["約會"],
      reasonCodes: ["TAG_SYNONYM_NORMALIZED", "TAG_CLEANUP_SUPPORTED", "WEB_RESEARCH_REQUIRED"],
      needsWebResearch: true,
      shortReason: "將已有的約會同義標籤正規化。",
    }), context({ currentTags: ["適合約會"] }));
    expect(normalized.success).toBe(true);
  });

  it("does not accept a candidate that duplicates an existing or auxiliary term", () => {
    const duplicate = contract.validateClassificationResult(output({
      keptTags: ["平價"],
      removedTags: [],
      proposedNewCuisineType: { name: "火鍋", normalizedName: "火鍋", reason: "看起來是主要類型。" },
      reasonCodes: ["CANDIDATE_TYPE_REQUIRED"],
    }), context({ currentTags: ["平價"] }));
    expect(duplicate.success).toBe(false);

    const auxiliary = contract.validateClassificationResult(output({
      keptTags: ["平價"],
      removedTags: [],
      proposedNewCuisineType: { name: "人氣", normalizedName: "人氣", reason: "看起來是分類。" },
      reasonCodes: ["CANDIDATE_TYPE_REQUIRED"],
    }), context({ currentTags: ["平價"] }));
    expect(auxiliary.success).toBe(false);
  });

  it("creates a safe refusal that remains reviewable and requires web research", () => {
    const refusal = contract.createSafeRefusalResult({
      restaurantId: 42,
      inputFingerprint: fingerprint,
      deterministicResult: { keptAuxiliaryTags: ["人氣"], removedCuisineTags: ["甜點"] },
    });
    expect(refusal).toMatchObject({
      restaurantId: 42,
      selectedCuisineTypeId: null,
      proposedNewCuisineType: null,
      keptTags: ["人氣"],
      removedTags: ["甜點"],
      confidence: 0,
      needsWebResearch: true,
    });
    expect(contract.validateClassificationResult(refusal, context({ currentTags: ["甜點", "人氣"] })).success).toBe(true);
  });
});

describe("AI cuisine prompts and request pipeline", () => {
  it("keeps the supplied prompt text versioned and serializes evidence as JSON", () => {
    const bundle = prompts.buildPromptBundle({
      restaurantId: 42,
      name: "測試火鍋",
      address: "台北市測試路",
      phone: "02-12345678",
      currentFoodType: 0,
      currentTags: ["麻辣鍋", "平價"],
      suppliedCuisineTypes,
      knownSourceReferences: [{ file: "source.json", id: "42" }],
      savedSourceCuisineTypes: ["火鍋"],
    });
    expect(bundle.promptVersion).toBe("cuisine-ai-prompt-v2");
    expect(bundle.systemPrompt).toContain("人氣、平價、古早味、聚餐、排隊");
    expect(bundle.systemPrompt).toContain("僅輸出符合指定 JSON Schema 的資料");
    expect(bundle.userPrompt).toContain('"麻辣鍋"');
    expect(bundle.userPrompt).toContain('"savedCuisineTypes"');
    expect(bundle.userPromptFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("filters phase 3 results to needsAi=true and provides a reversible custom ID", () => {
    const report = {
      mode: "dry-run",
      readOnly: true,
      taxonomyVersion: "cuisine-taxonomy-v1.1",
      results: [
        {
          restaurantId: 1,
          inputFingerprint: "1".repeat(64),
          needsAi: false,
          aiInput: { name: "已分類", address: "地址", phone: "電話", currentFoodType: 1, currentTags: [], knownSourceReferences: [], savedSourceCuisineTypes: [] },
        },
        {
          restaurantId: 42,
          inputFingerprint: fingerprint,
          needsAi: true,
          aiInput: {
            name: "待確認火鍋",
            address: "台北市待確認路",
            phone: "02-22223333",
            currentFoodType: 0,
            currentTags: ["麻辣鍋", "平價"],
            knownSourceReferences: [{ file: "source.json", id: "42" }],
            savedSourceCuisineTypes: ["火鍋"],
          },
        },
      ],
    };
    const requests = pipeline.buildRequestsFromStage3Report({
      report,
      suppliedCuisineTypes,
      modelVersion: "mock-model-v1",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      restaurantId: 42,
      customId: pipeline.customIdFor(42, fingerprint),
      promptVersion: "cuisine-ai-prompt-v2",
      modelVersion: "mock-model-v1",
      input: { knownSourceReferences: [{ file: "source.json", id: "42" }] },
    });
    expect(pipeline.restaurantIdFromCustomId(requests[0].customId)).toBe(42);
    expect(pipeline.parseCustomId(requests[0].customId).inputFingerprint).toBe(fingerprint);
    expect(requests[0].requestBody.response_format.json_schema.strict).toBe(true);
  });

  it("writes and reads request/result JSONL without touching Prisma", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-ai-jsonl-"));
    const filePath = path.join(tempDir, "requests.jsonl");
    const records = [{ customId: "one", restaurantId: 42 }, { customId: "two", restaurantId: 43 }];
    expect(pipeline.writeJsonl(filePath, records)).toBe(filePath);
    expect(pipeline.readJsonl(filePath)).toEqual(records);
    const scriptSource = fs.readFileSync(path.join(process.cwd(), "scripts", "prepare-cuisine-ai-classification.cjs"), "utf8");
    expect(scriptSource).not.toMatch(/PrismaClient|prisma\.(create|update|delete|upsert|\$transaction)/u);
  });

  it("maps a provider refusal into a structured result JSONL line", async () => {
    const report = {
      mode: "dry-run",
      readOnly: true,
      results: [{
        restaurantId: 42,
        inputFingerprint: fingerprint,
        needsAi: true,
        taxonomyVersion: "cuisine-taxonomy-v1.1",
        originalTags: ["甜點", "人氣"],
        keptAuxiliaryTags: ["人氣"],
        removedCuisineTags: ["甜點"],
        aiInput: {
          name: "待查甜點",
          address: "地址",
          phone: "電話",
          currentFoodType: 0,
          currentTags: ["甜點", "人氣"],
          knownSourceReferences: [{ file: "source.json", id: "42" }],
          savedSourceCuisineTypes: [],
        },
      }],
    };
    const [request] = pipeline.buildRequestsFromStage3Report({ report, suppliedCuisineTypes, modelVersion: "mock-model-v1" });
    const resultLines = await pipeline.runProviderRequests({
      requests: [request],
      provider: {
        classify: async ({ customId }: { customId: string }) => ({
          status: "refusal",
          customId,
          attempts: 1,
          refusal: "需要查核",
        }),
      },
      deterministicResultsByRestaurantId: new Map([[42, { keptAuxiliaryTags: ["人氣"], removedCuisineTags: ["甜點"] }]]),
    });
    expect(resultLines[0]).toMatchObject({
      status: "refusal",
      customId: request.customId,
      restaurantId: 42,
      sourceReferences: [{ file: "source.json", id: "42" }],
      result: { needsWebResearch: true, confidence: 0, keptTags: ["人氣"], removedTags: ["甜點"] },
    });
  });

  it("keeps the preparation CLI dry-run-only", () => {
    expect(aiScript.parseArgs(["--help"]).help).toBe(true);
    expect(() => aiScript.parseArgs(["--apply"])).toThrow("Unknown option");
    expect(() => aiScript.parseArgs(["--input", "report.json"])).toThrow("--cuisine-types is required");
  });
});

describe("mocked provider adapter", () => {
  const requestArgs = {
    customId: pipeline.customIdFor(42, fingerprint),
    promptVersion: "cuisine-ai-prompt-v1",
    systemPrompt: "system",
    userPrompt: "user",
    responseSchema: contract.classificationJsonSchema,
    validationContext: context(),
    validateResult: contract.validateClassificationResult,
  };

  it("retries a transient failure and records model/prompt versions", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const valid = output({ selectedCuisineTypeId: 12, selectedCuisineTypeName: "火鍋" });
    const adapter = new providerModule.OpenAIChatCompletionsProviderAdapter({
      apiKey: "mock-key",
      modelVersion: "mock-model-v1",
      maxAttempts: 3,
      backoffMs: 0,
      sleep: async () => {},
      fetchImpl: async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return calls.length === 1
          ? fakeResponse({ error: { message: "temporary" } }, 503)
          : fakeResponse(providerResultFor(valid));
      },
    });
    const result = await adapter.classify(requestArgs);
    expect(result).toMatchObject({ status: "ok", attempts: 2, modelVersion: "mock-model-v1" });
    expect(calls).toHaveLength(2);
    const body = JSON.parse(String(calls[1].init.body));
    expect(body.user).toBe(requestArgs.customId);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(calls[1].init.headers).toMatchObject({ authorization: "Bearer mock-key" });
  });

  it("returns an explicit refusal without inventing a classification", async () => {
    const adapter = new providerModule.OpenAIChatCompletionsProviderAdapter({
      apiKey: "mock-key",
      modelVersion: "mock-model-v1",
      fetchImpl: async () => fakeResponse({ id: "refusal-1", choices: [{ message: { refusal: "資料不足" } }] }),
    });
    const result = await adapter.classify(requestArgs);
    expect(result).toMatchObject({ status: "refusal", attempts: 1, refusal: "資料不足" });
  });

  it("retries invalid structured output and stops without calling a real API", async () => {
    let calls = 0;
    const adapter = new providerModule.OpenAIChatCompletionsProviderAdapter({
      apiKey: "mock-key",
      modelVersion: "mock-model-v1",
      maxAttempts: 2,
      backoffMs: 0,
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1;
        return fakeResponse(providerResultFor({ ...output(), unexpected: true }));
      },
    });
    const result = await adapter.classify(requestArgs);
    expect(result).toMatchObject({ status: "invalid", attempts: 2, errorCode: "SCHEMA_VALIDATION_FAILED" });
    expect(calls).toBe(2);
  });
});
