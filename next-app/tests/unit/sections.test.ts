import { describe, expect, it } from "vitest";
import { renderListSectionLinks, renderSectionOptions } from "@/lib/domain/sections";

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
});
