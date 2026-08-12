/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";

const seed = require("../../scripts/seed-cuisine-types.cjs") as {
  buildSeedPlan: (existing: Array<Record<string, unknown>>, types?: Array<Record<string, unknown>>) => Record<string, any>;
  catalog: Array<Record<string, unknown>>;
  parseArgs: (argv: string[]) => Record<string, unknown>;
};

describe("controlled CuisineType seed", () => {
  it("plans missing types without treating auxiliary tags as catalog entries", () => {
    const plan = seed.buildSeedPlan([], seed.catalog);
    expect(plan.creates.length).toBe(seed.catalog.length);
    expect(seed.catalog.some((type) => type.name === "人氣")).toBe(false);
  });

  it("is idempotent for an existing matching code and detects normalized-name conflicts", () => {
    const [first] = seed.catalog;
    const plan = seed.buildSeedPlan([
      { id: 1, code: first.code, name: first.name, normalizedName: first.normalizedName, legacyFoodType: first.legacyFoodType },
      { id: 2, code: "manual-cafe", name: "自訂咖啡", normalizedName: "咖啡廳", legacyFoodType: null },
    ], [first, { ...first, code: "cafe", name: "咖啡廳", normalizedName: "咖啡廳", legacyFoodType: null }]);
    expect(plan.existing).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].reason).toBe("normalized-name-already-used");
  });

  it("requires explicit apply", () => {
    expect(seed.parseArgs([])).toMatchObject({ apply: false });
    expect(seed.parseArgs(["--apply"])).toMatchObject({ apply: true });
  });
});
