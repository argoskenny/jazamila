import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-require-imports */
const handoff = require("../../scripts/prepare-cuisine-autonomous-codex-handoffs.cjs") as any;

describe("autonomous cuisine Codex handoff preparation", () => {
  it("requires a new explicit output directory and has no apply option", () => {
    expect(() => handoff.parseArgs([])).toThrow("--output-dir is required");
    expect(() => handoff.parseArgs(["--apply"])).toThrow("Unknown option");
    expect(handoff.parseArgs(["--output-dir", "/tmp/cuisine-handoff-test"])).toMatchObject({
      outputDir: "/tmp/cuisine-handoff-test",
      batchPrefix: "cuisine-autonomous-20260813",
    });
  });

  it("preserves identity and includes the deterministic assessment only as a hint", () => {
    const fingerprint = "a".repeat(64);
    const request = handoff.requestFor({
      restaurantId: 7,
      source: { customId: `jazamila-cuisine-ai-v1:r7:f${fingerprint}`, inputFingerprint: fingerprint, snapshotHash: "snapshot" },
      input: { name: "測試咖啡", currentTags: ["咖啡", "平價"] },
      currentDatabase: { reviewSummaryJson: "[\"適合喝咖啡\"]", cuisineTypeId: 22 },
    }, {
      restaurantId: 7,
      inputFingerprint: fingerprint,
      classificationStatus: "classified",
      proposedCuisineType: { code: "cafe", name: "咖啡廳" },
      candidateEvidence: [], ambiguousMatches: [], unsupportedCategoryMatches: [], entityRiskMatches: [],
    }, "direct", [{ id: 16, code: "cafe", name: "咖啡廳", normalizedName: "咖啡廳", status: "active" }]);
    expect(request).toMatchObject({
      restaurantId: 7,
      inputFingerprint: fingerprint,
      preparationGroup: "direct",
      input: { reviewSummaries: ["適合喝咖啡"] },
      recoveryAssessment: { proposedCuisineType: { code: "cafe" } },
    });
  });

  it("keeps the direct safety gate while authorizing a simplified research write", () => {
    const direct = handoff.handoffPrompt({ group: "direct", manifestPath: "/tmp/direct/manifest.json", requestCount: 10, otherCuisineTypeId: 22 });
    const research = handoff.handoffPrompt({ group: "research", manifestPath: "/tmp/research/manifest.json", requestCount: 20, otherCuisineTypeId: 22 });
    expect(direct).toContain("禁止使用網路");
    expect(direct).toContain("不得猜測資料庫路徑");
    expect(direct).toContain("DATABASE_URL");
    expect(research).toContain("本地資料真的看不出來時才做簡單網路搜尋");
    expect(research).toContain("file:/Users/strongbuy/dev/frontend/jazamila/prisma/dev.db");
    expect(research).toContain("不需要 candidate 人工審核");
    expect(research).toContain("不需要等待人工確認");
    expect(research).toContain("直接操作");
    expect(research).toContain("其他餐飲");
  });
});
