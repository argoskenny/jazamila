import { describe, expect, it } from "vitest";
import lookupData from "@/lib/domain/lookup-data.json";
import { getFoodTypes, getRegions, renderListSectionLinks, renderSectionOptions, sectionsByRegion } from "@/lib/domain/sections";

describe("section compatibility helpers", () => {
  it("renders legacy select options", () => {
    expect(renderSectionOptions(1, 2)).toContain('selected="selected"');
    expect(renderSectionOptions(1)).toContain("大同區");
  });

  it("renders legacy listdata section links", () => {
    const html = renderListSectionLinks(1);

    expect(html).toContain("section_click('0','全區')");
    expect(html).toContain("section_click('2','大同區')");
  });

  it("loads lookup options from the data file", () => {
    expect(getRegions()).toEqual(lookupData.regions);
    expect(getFoodTypes()).toEqual(lookupData.foodTypes);
    expect(sectionsByRegion[1]).toEqual(lookupData.sectionsByRegion["1"]);
  });
});
