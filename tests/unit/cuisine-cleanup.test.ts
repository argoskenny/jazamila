import { createRequire } from "node:module";
import { prisma } from "@/lib/db/prisma";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const cleanup = require("../../scripts/cleanup-cuisine-tags.cjs") as {
  applyCleanupPlans: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  buildCleanupPlans: (rows: Array<Record<string, unknown>>) => { plans: Array<Record<string, any>>; audit: Record<string, number> };
  parseArgs: (argv: string[]) => Record<string, any>;
};
const rollback = require("../../scripts/apply-cuisine-classification.cjs") as {
  previewRollback: (input: Record<string, unknown>) => Promise<Record<string, any>>;
  rollbackBatch: (input: Record<string, unknown>) => Promise<Record<string, any>>;
};

const createdRestaurantIds: number[] = [];
const createdBatchIds: string[] = [];

afterEach(async () => {
  if (createdBatchIds.length > 0) await prisma.cuisineApplyBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
  if (createdRestaurantIds.length > 0) await prisma.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } });
  createdBatchIds.length = 0;
  createdRestaurantIds.length = 0;
});

function restaurant(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "清理測試餐廳",
    address: "臺北市測試路 1 號",
    phone: "02 1234 5678",
    areaNum: "02",
    telNum: "12345678",
    foodType: 0,
    sourceRefsJson: JSON.stringify([{ file: "cleanup.json", id: "cleanup-1" }]),
    manualOverrideFields: null,
    cuisineTypeId: 23,
    cuisineType: { id: 23, code: "candidate-spanish", name: "西班牙料理", normalizedName: "西班牙料理", status: "active" },
    tags: [
      { restaurantId: 1, tagId: 1, position: 0, owner: "source", sourceName: "西班牙料理", isPublic: true, tag: { id: 1, name: "西班牙料理", normalizedName: "西班牙料理" } },
      { restaurantId: 1, tagId: 2, position: 1, owner: "source", sourceName: "海鮮", isPublic: true, tag: { id: 2, name: "海鮮", normalizedName: "海鮮" } },
    ],
    ...overrides,
  };
}

describe("cuisine tag cleanup planning", () => {
  it("hides only public source cuisine-name tags and keeps the relation", () => {
    const result = cleanup.buildCleanupPlans([restaurant()]);
    expect(result.audit).toMatchObject({ restaurantCount: 1, matchingPublicCuisineTagCount: 1, readyRestaurantCount: 1, unclassifiedCount: 0 });
    expect(result.plans[0]).toMatchObject({ status: "ready", matchingTagIds: [1] });
    expect(result.plans[0].after.tags).toEqual(expect.arrayContaining([
      expect.objectContaining({ tagId: 1, isPublic: false }),
      expect.objectContaining({ tagId: 2, isPublic: true }),
    ]));
  });

  it("protects manual and unknown-owner tags and does not infer unclassified cuisine", () => {
    const manual = restaurant({
      id: 2,
      tags: [{ restaurantId: 2, tagId: 3, position: 0, owner: "manual", sourceName: "西班牙料理", isPublic: true, tag: { id: 3, name: "西班牙料理", normalizedName: "西班牙料理" } }],
    });
    const unknown = restaurant({
      id: 3,
      tags: [{ restaurantId: 3, tagId: 4, position: 0, owner: "editorial", sourceName: "西班牙料理", isPublic: true, tag: { id: 4, name: "西班牙料理", normalizedName: "西班牙料理" } }],
    });
    const unclassified = restaurant({ id: 4, cuisineTypeId: null, cuisineType: null });
    const result = cleanup.buildCleanupPlans([manual, unknown, unclassified]);
    expect(result.audit).toMatchObject({ unclassifiedCount: 1, protectedRestaurantCount: 2, unknownOwnerCount: 1, readyRestaurantCount: 0 });
    expect(result.plans).toHaveLength(2);
    expect(result.plans.every((plan) => plan.status === "protected")).toBe(true);
    expect(result.plans.every((plan) => plan.before.tags[0].isPublic === plan.after.tags[0].isPublic)).toBe(true);
  });

  it("requires an explicit non-dev SQLite target", () => {
    expect(() => cleanup.parseArgs(["--database", "file:./dev.db"])).toThrow(/dev\.db/u);
    expect(cleanup.parseArgs(["--database", "file:/private/tmp/isolated.sqlite", "--batch-id", "cleanup-001", "--apply"]))
      .toMatchObject({ database: "file:/private/tmp/isolated.sqlite", batchId: "cleanup-001", apply: true });
  });

  it("applies, audits, previews rollback, and restores without deleting the Tag", async () => {
    const cuisineType = await prisma.cuisineType.findFirstOrThrow({ where: { code: "hot-pot", status: "active" } });
    const tag = await prisma.tag.findUniqueOrThrow({ where: { normalizedName: "火鍋" } });
    const beforeTagCount = await prisma.tag.count();
    const restaurant = await prisma.restaurant.create({
      data: {
        name: "清理交易測試",
        address: "臺北市交易測試路 1 號",
        phone: "02 9000 0001",
        cuisineTypeId: cuisineType.id,
        sourceRefsJson: JSON.stringify([{ file: "cleanup-test.json", id: "cleanup-test-1" }]),
      },
    });
    createdRestaurantIds.push(restaurant.id);
    await prisma.restaurantTag.create({
      data: { restaurantId: restaurant.id, tagId: tag.id, position: 0, owner: "source", sourceName: "火鍋", isPublic: true },
    });
    const loaded = await prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurant.id },
      include: {
        cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
        tags: { orderBy: { position: "asc" }, include: { tag: { select: { id: true, name: true, normalizedName: true } } } },
      },
    });
    const planned = cleanup.buildCleanupPlans([loaded]);
    const batchId = "cleanup-test-transaction-001";
    createdBatchIds.push(batchId);
    await expect(cleanup.applyCleanupPlans({ prisma, plans: planned.plans, batchId })).resolves.toMatchObject({ status: "applied", applied: 1, protected: 0 });
    await expect(prisma.restaurantTag.findUnique({ where: { restaurantId_tagId: { restaurantId: restaurant.id, tagId: tag.id } } })).resolves.toMatchObject({ isPublic: false });
    await expect(prisma.tag.count()).resolves.toBe(beforeTagCount);

    await expect(rollback.previewRollback({ prisma, batchId })).resolves.toMatchObject({ status: "dry-run-rollback", batchStatus: "applied", changes: [expect.objectContaining({ restaurantId: restaurant.id })] });
    await expect(rollback.rollbackBatch({ prisma, batchId })).resolves.toMatchObject({ status: "rolled_back", rolledBack: 1 });
    await expect(prisma.restaurantTag.findUnique({ where: { restaurantId_tagId: { restaurantId: restaurant.id, tagId: tag.id } } })).resolves.toMatchObject({ isPublic: true });
  });
});
