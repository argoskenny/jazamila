/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const audit = require("../../scripts/audit-cuisine-conversion.cjs") as any;
const classifier = require("../../scripts/classify-cuisine-deterministic.cjs") as any;

function writeReport(report: Record<string, unknown>) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-cuisine-audit-"));
  const filePath = path.join(directory, "deterministic.json");
  fs.writeFileSync(filePath, `${JSON.stringify(report)}\n`, "utf8");
  return filePath;
}

function writeJsonl(records: unknown[]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-cuisine-audit-jsonl-"));
  const filePath = path.join(directory, "records.jsonl");
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  return filePath;
}

describe("cuisine conversion artifact audit", () => {
  it("validates a deterministic dry-run with its computed snapshot hash", () => {
    const results = [{ restaurantId: 1, inputFingerprint: "a".repeat(64), proposedCuisineType: null, needsAi: true }];
    const report = {
      mode: "dry-run",
      readOnly: true,
      snapshot: { inputHash: classifier.snapshotHashForResults(results) },
      results,
    };
    const result = audit.auditArtifacts({
      deterministicReport: writeReport(report),
      aiRequests: null,
      aiResults: null,
      webRequests: null,
      webResults: null,
      review: null,
      cuisineTypes: null,
      requireComplete: false,
    });
    expect(result).toMatchObject({ pass: true, snapshot: { resultCount: 1 } });
  });

  it("fails when the snapshot hash is stale", () => {
    const report = { mode: "dry-run", readOnly: true, snapshot: { inputHash: "b".repeat(64) }, results: [] };
    const result = audit.auditArtifacts({
      deterministicReport: writeReport(report),
      aiRequests: null,
      aiResults: null,
      webRequests: null,
      webResults: null,
      review: null,
      cuisineTypes: null,
      requireComplete: false,
    });
    expect(result.pass).toBe(false);
    expect(result.errors).toContain("deterministic snapshot inputHash does not match result rows");
  });

  it("allows an audited unresolved Web result but blocks AI refusal at complete gate", () => {
    const results = [{ restaurantId: 1, inputFingerprint: "a".repeat(64), proposedCuisineType: null, needsAi: true }];
    const report = {
      mode: "dry-run",
      readOnly: true,
      snapshot: { inputHash: classifier.snapshotHashForResults(results) },
      results,
    };
    const aiRequest = {
      customId: `jazamila-cuisine-ai-v1:r1:f${"a".repeat(64)}`,
      restaurantId: 1,
      inputFingerprint: "a".repeat(64),
      snapshotHash: report.snapshot.inputHash,
      sourceReferences: [],
      input: { currentTags: [] },
      suppliedCuisineTypes: [{ id: 1, code: "other", name: "其他餐飲", normalizedName: "其他餐飲", status: "active" }],
    };
    const aiResult = {
      ...aiRequest,
      status: "refusal",
      result: { restaurantId: 1, inputFingerprint: "a".repeat(64) },
    };
    const webRequest = {
      customId: `jazamila-cuisine-web-v1:r1:f${"a".repeat(64)}`,
      restaurantId: 1,
      inputFingerprint: "a".repeat(64),
      snapshotHash: report.snapshot.inputHash,
      searchQueries: ["餐廳 地址"],
      sourceReferences: [],
    };
    const webResult = {
      ...webRequest,
      status: "unresolved",
      result: {
        restaurantId: 1,
        inputFingerprint: "a".repeat(64),
        searchQueries: ["餐廳 地址"],
        matchedName: null,
        matchedAddress: null,
        matchedPhone: null,
        selectedCuisineType: null,
        proposedNewCuisineType: null,
        keptTags: [],
        removedTags: [],
        addedTags: [],
        confidence: 0,
        evidenceUrls: [],
        evidenceTitles: [],
        checkedAt: "2026-08-11T00:00:00.000Z",
        matchConfidence: 0,
        unresolvedReason: "NO_CONFIRMED_SOURCE",
        evidence: [],
      },
      audit: { searchQueries: ["餐廳 地址"], fetchedSources: [] },
    };
    const base = {
      deterministicReport: writeReport(report),
      aiRequests: writeJsonl([aiRequest]),
      aiResults: writeJsonl([aiResult]),
      webRequests: writeJsonl([webRequest]),
      webResults: writeJsonl([webResult]),
      review: null,
      cuisineTypes: null,
      requireComplete: false,
    };
    const pendingAudit = audit.auditArtifacts(base);
    expect(pendingAudit).toMatchObject({ pass: true, web: { statuses: { unresolved: 1 } } });
    const complete = audit.auditArtifacts({ ...base, requireComplete: true });
    expect(complete.pass).toBe(false);
    expect(complete.errors).toContain("ai: non-terminal statuses remain: refusal(1)");
  });

  it("accepts a schema-valid unresolved AI handoff that explicitly requires Web research", () => {
    const results = [{ restaurantId: 1, inputFingerprint: "a".repeat(64), proposedCuisineType: null, needsAi: true }];
    const report = {
      mode: "dry-run",
      readOnly: true,
      snapshot: { inputHash: classifier.snapshotHashForResults(results) },
      results,
    };
    const request = {
      customId: `jazamila-cuisine-ai-v1:r1:f${"a".repeat(64)}`,
      restaurantId: 1,
      inputFingerprint: "a".repeat(64),
      snapshotHash: report.snapshot.inputHash,
      sourceReferences: [],
      input: { currentTags: [] },
      suppliedCuisineTypes: [{ id: 22, code: "other", name: "其他餐飲", normalizedName: "其他餐飲", status: "active" }],
    };
    const unresolved = {
      ...request,
      status: "unresolved",
      result: {
        restaurantId: 1,
        inputFingerprint: "a".repeat(64),
        selectedCuisineTypeId: null,
        selectedCuisineTypeName: null,
        proposedNewCuisineType: null,
        keptTags: [],
        removedTags: [],
        addedTags: [],
        confidence: 0,
        needsWebResearch: true,
        reasonCodes: ["INSUFFICIENT_EVIDENCE", "WEB_RESEARCH_REQUIRED"],
        shortReason: "證據不足，等待可追溯的網路證據。",
      },
    };
    const audited = audit.auditArtifacts({
      deterministicReport: writeReport(report),
      aiRequests: writeJsonl([request]),
      aiResults: writeJsonl([unresolved]),
      webRequests: null,
      webResults: null,
      review: null,
      cuisineTypes: null,
      requireComplete: true,
    });
    expect(audited).toMatchObject({ pass: true, ai: { statuses: { unresolved: 1 } } });
  });
});
