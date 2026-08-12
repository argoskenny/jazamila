/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";

const aiRunner = require("../../scripts/run-cuisine-ai-classification.cjs") as any;
const webRunner = require("../../scripts/run-cuisine-web-research.cjs") as any;
const httpProvider = require("../../lib/web-research/http-web-provider.cjs") as any;

const fingerprint = "a".repeat(64);

function request(prefix: string, modelVersion = "mock-model-v1") {
  return {
    restaurantId: 7,
    inputFingerprint: fingerprint,
    snapshotHash: "b".repeat(64),
    customId: `jazamila-cuisine-${prefix}-v1:r7:f${fingerprint}`,
    modelVersion,
  };
}

describe("external provider runners", () => {
  it("requires explicit run and preserves pending AI records offline", () => {
    expect(aiRunner.parseArgs(["--requests", "requests.jsonl"])).toMatchObject({ run: false });
    expect(() => aiRunner.validateRequests([request("ai")])).not.toThrow();
    expect(aiRunner.countStatuses([{ status: "pending" }, { status: "pending" }])).toEqual({ pending: 2 });
  });

  it("requires explicit run and preserves pending Web records offline", () => {
    expect(webRunner.parseArgs(["--requests", "requests.jsonl"])).toMatchObject({ run: false });
    expect(() => webRunner.validateRequests([request("web")])).not.toThrow();
    expect(webRunner.countStatuses([{ status: "unresolved" }, { status: "ok" }])).toEqual({ unresolved: 1, ok: 1 });
  });

  it("normalizes mocked search results and strips HTML for fetched evidence", async () => {
    const search = httpProvider.createHttpSearchImpl({
      endpoint: "https://search.example/api",
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ results: [{ url: "https://official.example/menu", title: "官方菜單", snippet: "摘要" }] }) }),
    });
    await expect(search("餐廳 地址")).resolves.toMatchObject([{ url: "https://official.example/menu", title: "官方菜單" }]);

    const fetchPage = httpProvider.createHttpPageFetcher({
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "<html><title>官方菜單</title><script>ignore</script><body>火鍋 地址</body></html>" }),
    });
    await expect(fetchPage("https://official.example/menu")).resolves.toMatchObject({ title: "官方菜單" });
    await expect(fetchPage("https://official.example/menu")).resolves.toMatchObject({ content: expect.stringContaining("火鍋 地址") });
  });
});
