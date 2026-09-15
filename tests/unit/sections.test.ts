import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import lookupData from "@/lib/domain/lookup-data.json";
import { prisma } from "@/lib/db/prisma";
import { renderListSectionLinks, renderSectionOptions } from "@/lib/domain/sections";

const require = createRequire(import.meta.url);
const { syncLocationLookups } = require("../../scripts/location-lookups.cjs") as {
  syncLocationLookups: (client: typeof prisma) => Promise<unknown>;
};

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

  it("keeps every selectable city and district resolvable in the database", async () => {
    await syncLocationLookups(prisma);
    const cities = await prisma.city.findMany({
      include: { districts: true }
    });

    for (const region of lookupData.regions.filter((option) => option.id > 0)) {
      const city = cities.find((candidate) => candidate.legacyRegion === region.id);
      expect(city?.name).toBe(region.label);
      const expectedDistricts = lookupData.sectionsByRegion[String(region.id) as keyof typeof lookupData.sectionsByRegion];
      expect(city?.districts.map((district) => district.legacySection).sort((a, b) => (a ?? 0) - (b ?? 0)))
        .toEqual(expectedDistricts.map((district) => district.id));
    }

    const unresolved = await prisma.restaurant.count({
      where: {
        region: { gt: 0 },
        section: { gt: 0 },
        OR: [{ cityId: null }, { districtId: null }]
      }
    });
    expect(unresolved).toBe(0);
  });
});
