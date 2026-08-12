import { prisma } from "@/lib/db/prisma";
import {
  cuisineTypeCatalog,
  cuisineTypeCodeForLegacyFoodType,
  cuisineTypeForLegacyFoodType,
  getPublicCuisineTypes,
  listSegmentForCuisineTypeTokens,
  normalizeCuisineTypeQueryTokens
} from "@/lib/domain/cuisine-types";
import { describe, expect, it } from "vitest";

describe("cuisine type catalog and compatibility mapping", () => {
  it("maps only the legacy cuisine ids with an explicit mapping", () => {
    expect(cuisineTypeCodeForLegacyFoodType(0)).toBeNull();
    expect(cuisineTypeForLegacyFoodType(1)).toMatchObject({ code: "japanese", name: "日式料理" });
    expect(cuisineTypeForLegacyFoodType(2)).toMatchObject({ code: "american", name: "美式料理" });
    expect(cuisineTypeForLegacyFoodType(3)).toMatchObject({ code: "italian", name: "義式料理" });
    expect(cuisineTypeForLegacyFoodType(4)).toMatchObject({ code: "street-food", name: "小吃" });
    expect(cuisineTypeCodeForLegacyFoodType(99)).toBeNull();
  });

  it("has unique normalized names and no candidate in public options", () => {
    const normalizedNames = cuisineTypeCatalog.map((cuisineType) => cuisineType.normalizedName);
    expect(new Set(normalizedNames).size).toBe(normalizedNames.length);

    const withCandidate = [
      ...cuisineTypeCatalog,
      {
        code: "candidate-test",
        name: "候選料理",
        normalizedName: "候選料理",
        status: "candidate" as const,
        createdBy: "ai" as const,
        legacyFoodType: null
      }
    ];
    expect(getPublicCuisineTypes(withCandidate).some((cuisineType) => cuisineType.status === "candidate")).toBe(false);
  });

  it("normalizes detail query tokens and preserves a single canonical list segment", () => {
    expect(normalizeCuisineTypeQueryTokens("hot-pot,code:hot-pot,legacy:1")).toEqual([
      "code:hot-pot",
      "legacy:1"
    ]);
    expect(listSegmentForCuisineTypeTokens(["code:hot-pot"])).toBe("c:hot-pot");
    expect(listSegmentForCuisineTypeTokens(["legacy:1"])).toBe("1");
    expect(listSegmentForCuisineTypeTokens(["code:hot-pot", "code:japanese"])).toBeNull();
  });

  it("seeds a nullable canonical relation while preserving legacy foodType", async () => {
    const seededTypes = await prisma.cuisineType.findMany({
      orderBy: { code: "asc" },
      select: { code: true, status: true, createdBy: true, createdAt: true, updatedAt: true }
    });
    expect(seededTypes).toHaveLength(cuisineTypeCatalog.length);
    expect(seededTypes.map((cuisineType) => cuisineType.code)).toEqual(
      [...cuisineTypeCatalog].map((cuisineType) => cuisineType.code).sort()
    );
    expect(seededTypes.every((cuisineType) =>
      cuisineType.status === "active" &&
      cuisineType.createdBy === "seed" &&
      cuisineType.createdAt instanceof Date &&
      cuisineType.updatedAt instanceof Date
    )).toBe(true);

    const rows = await prisma.restaurant.findMany({
      where: { id: { in: [1, 2, 3, 5] } },
      select: { id: true, foodType: true, cuisineTypeId: true, cuisineType: { select: { code: true } } },
      orderBy: { id: "asc" }
    });

    expect(rows).toEqual([
      expect.objectContaining({ id: 1, foodType: 1, cuisineType: { code: "japanese" } }),
      expect.objectContaining({ id: 2, foodType: 2, cuisineType: { code: "american" } }),
      expect.objectContaining({ id: 3, foodType: 3, cuisineType: { code: "italian" } }),
      expect.objectContaining({ id: 5, foodType: 0, cuisineTypeId: null, cuisineType: null })
    ]);
  });

  it("enforces normalizedName uniqueness and the cuisine foreign key", async () => {
    await expect(prisma.cuisineType.create({
      data: {
        code: "duplicate-normalized-name-test",
        name: "重複測試",
        normalizedName: "日式料理",
        status: "candidate",
        createdBy: "manual"
      }
    })).rejects.toThrow();

    await expect(prisma.restaurant.update({
      where: { id: 1 },
      data: { cuisineTypeId: 999999 }
    })).rejects.toThrow();
  });

  it("does not create a many-to-many cuisine relation table", async () => {
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name LIKE '%cuisine%'
      ORDER BY name
    `;

    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      "r_cuisine_apply_batch",
      "r_cuisine_apply_change",
      "r_cuisine_type",
    ]));
    expect(tables.map((table) => table.name)).not.toContain("r_restaurant_cuisine_type");
  });
});
