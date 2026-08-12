import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const audit = require("../../scripts/audit-cuisine-target.cjs") as {
  candidateChecksFor: (input: Record<string, unknown>) => Array<Record<string, unknown>>;
  parseArgs: (argv: string[]) => Record<string, any>;
};

describe("cuisine target audit configuration", () => {
  it("accepts the current batch, backup, change count, and normalized candidate counts", () => {
    expect(audit.parseArgs([
      "--database", "file:/tmp/current.sqlite",
      "--before-database", "file:/tmp/before.sqlite",
      "--batch-id", "rebuild-001",
      "--expected-changes", "14647",
      "--candidate", "西班牙料理=2",
      "--candidate", "客家料理=1",
    ])).toMatchObject({
      database: "file:/tmp/current.sqlite",
      beforeDatabase: "file:/tmp/before.sqlite",
      batchId: "rebuild-001",
      expectedChanges: 14647,
      candidates: [
        { normalizedName: "西班牙料理", count: 2 },
        { normalizedName: "客家料理", count: 1 },
      ],
    });
  });

  it("keeps historical defaults for callers that do not pass new expectations", () => {
    expect(audit.parseArgs(["--database", "file:/tmp/current.sqlite"])).toMatchObject({
      batchId: "jazamila-cuisine-auto-20260812-001",
      expectedChanges: 9309,
      candidates: [
        { normalizedName: "西班牙料理", count: 2 },
        { normalizedName: "客家料理", count: 1 },
      ],
    });
  });

  it("matches candidates by normalizedName and count rather than numeric IDs", () => {
    expect(audit.candidateChecksFor({
      cuisineTypes: [
        { id: 91, normalizedName: "西班牙料理" },
        { id: 104, normalizedName: "客家料理" },
      ],
      restaurants: [
        { cuisineTypeId: 91 },
        { cuisineTypeId: 91 },
        { cuisineTypeId: 104 },
      ],
      candidates: [
        { normalizedName: "西班牙料理", count: 2 },
        { normalizedName: "客家料理", count: 1 },
      ],
    })).toEqual([
      expect.objectContaining({ normalizedName: "西班牙料理", cuisineTypeId: 91, actualCount: 2, pass: true }),
      expect.objectContaining({ normalizedName: "客家料理", cuisineTypeId: 104, actualCount: 1, pass: true }),
    ]);
  });

  it("rejects malformed candidate specifications", () => {
    expect(() => audit.parseArgs(["--database", "file:/tmp/current.sqlite", "--candidate", "西班牙料理"])).toThrow(/normalizedName/u);
  });
});
