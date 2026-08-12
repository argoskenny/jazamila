import { describe, expect, it } from "vitest";
import { defaultPreferences, parsePreferenceCuisineTypes, parsePreferenceFoodTypes, readHomePreferences } from "@/lib/cookies";

function cookieReader(values: Record<string, string>) {
  return {
    get(name: string) {
      const value = values[name];
      return value === undefined ? undefined : { value };
    }
  };
}

describe("homepage preference cookies", () => {
  it("reads saved filters without requiring a remember flag", () => {
    expect(
      readHomePreferences(
        cookieReader({
          foodwhere_region: "1",
          foodwhere_section: "2",
          foodmoney_max: "500",
          foodmoney_min: "100",
          foodtype: "1-3"
        })
      )
    ).toEqual({
      foodwhere_region: 1,
      foodwhere_section: 2,
      foodmoney_max: 500,
      foodmoney_min: 100,
      foodtypes: [1, 3]
    });
  });

  it("keeps old single-value cuisine cookies compatible", () => {
    expect(parsePreferenceFoodTypes("2")).toEqual([2]);
    expect(parsePreferenceFoodTypes("0")).toEqual([]);
    expect(defaultPreferences().foodtypes).toEqual([]);
  });

  it("reads canonical CuisineType cookies while preserving the legacy cookie shape", () => {
    expect(parsePreferenceCuisineTypes("legacy:1,code:hot-pot,invalid value")).toEqual(["legacy:1", "code:hot-pot"]);
    expect(readHomePreferences(cookieReader({ cuisine_types: "code:hot-pot" }))).toMatchObject({ cuisineTypes: ["code:hot-pot"] });
  });
});
