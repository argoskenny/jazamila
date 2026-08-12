import { createRequire } from "node:module";
import { prisma } from "@/lib/db/prisma";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const apply = require("../../scripts/apply-cuisine-classification.cjs") as {
  applyPlans: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  buildPlans: (input: Record<string, unknown>) => Promise<{ plans: Array<Record<string, any>> }>;
  rollbackBatch: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};
const domain = require("../../lib/domain/cuisine-apply.cjs") as {
  fingerprintForRestaurant: (restaurant: Record<string, unknown>) => string;
};

const createdRestaurantIds: number[] = [];
const createdBatchIds: string[] = [];

async function createRestaurant(seed: number) {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `第六階段交易測試${seed}`,
      address: `臺北市中山區交易測試路${seed}號`,
      phone: `02 9000 ${String(seed).padStart(4, "0")}`,
      areaNum: "02",
      telNum: `9000${String(seed).padStart(4, "0")}`,
      sourceRefsJson: JSON.stringify([{ file: "phase6-test.json", id: `phase6-${seed}`, sourceId: `phase6-${seed}` }]),
      foodType: 0,
      cuisineTypeId: null,
    },
  });
  createdRestaurantIds.push(restaurant.id);
  const tag = await prisma.tag.upsert({
    where: { normalizedName: "火鍋" },
    update: {},
    create: { name: "火鍋", normalizedName: "火鍋" },
  });
  await prisma.restaurantTag.create({
    data: { restaurantId: restaurant.id, tagId: tag.id, position: 0, owner: "source", sourceName: "火鍋", isPublic: true },
  });
  const loaded = await prisma.restaurant.findUnique({
    where: { id: restaurant.id },
    include: { tags: { include: { tag: true }, orderBy: { position: "asc" } } },
  });
  if (!loaded) throw new Error(`failed to load test restaurant ${restaurant.id}`);
  return loaded;
}

function classificationFor(restaurant: any, cuisineTypeId: number) {
  return {
    restaurantId: restaurant.id,
    inputFingerprint: domain.fingerprintForRestaurant(restaurant),
    selectedCuisineTypeId: cuisineTypeId,
    selectedCuisineTypeName: "火鍋",
    proposedNewCuisineType: null,
    keptTags: [],
    removedTags: ["火鍋"],
    addedTags: [],
    confidence: 0.97,
    reasonCodes: ["EXPLICIT_CUISINE_TAG"],
  };
}

afterEach(async () => {
  if (createdBatchIds.length > 0) await prisma.cuisineApplyBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
  if (createdRestaurantIds.length > 0) await prisma.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } });
  createdBatchIds.length = 0;
  createdRestaurantIds.length = 0;
});

describe("cuisine apply transaction, rerun, and rollback", () => {
  it("applies a batch, is idempotent on rerun, and rolls back the exact before/after state", async () => {
    const hotPot = await prisma.cuisineType.findFirstOrThrow({ where: { code: "hot-pot", status: "active" } });
    const row = await createRestaurant(601);
    const batchId = "phase6-transaction-601";
    createdBatchIds.push(batchId);
    const built = await apply.buildPlans({
      prisma,
      classificationRecords: { deterministic: [], ai: [classificationFor(row, hotPot.id)], web: [] },
      review: null,
      activeCuisineTypes: [hotPot],
      restaurantIds: [],
      limit: null,
    });
    expect(built.plans[0].status).toBe("ready");

    await expect(apply.applyPlans({ prisma, plans: built.plans, batchId })).resolves.toMatchObject({ status: "applied", applied: 1 });
    await expect(apply.applyPlans({ prisma, plans: built.plans, batchId })).resolves.toMatchObject({ status: "idempotent" });
    await expect(prisma.restaurant.findUnique({ where: { id: row.id }, include: { tags: { include: { tag: true } } } })).resolves.toMatchObject({
      cuisineTypeId: hotPot.id,
      tags: [expect.objectContaining({ owner: "ai", isPublic: false })],
    });

    await expect(apply.rollbackBatch({ prisma, batchId })).resolves.toMatchObject({ status: "rolled_back", rolledBack: 1 });
    await expect(apply.rollbackBatch({ prisma, batchId })).resolves.toMatchObject({ status: "idempotent" });
    await expect(prisma.restaurant.findUnique({ where: { id: row.id }, include: { tags: { include: { tag: true } } } })).resolves.toMatchObject({
      cuisineTypeId: null,
      tags: [expect.objectContaining({ owner: "source", isPublic: true })],
    });
  });

  it("protects a manually changed cuisine field during rollback", async () => {
    const [hotPot, cafe] = await Promise.all([
      prisma.cuisineType.findFirstOrThrow({ where: { code: "hot-pot", status: "active" } }),
      prisma.cuisineType.findFirstOrThrow({ where: { code: "cafe", status: "active" } }),
    ]);
    const row = await createRestaurant(602);
    const batchId = "phase6-manual-602";
    createdBatchIds.push(batchId);
    const built = await apply.buildPlans({
      prisma,
      classificationRecords: { deterministic: [], ai: [classificationFor(row, hotPot.id)], web: [] },
      review: null,
      activeCuisineTypes: [hotPot],
      restaurantIds: [],
      limit: null,
    });
    await apply.applyPlans({ prisma, plans: built.plans, batchId });
    await prisma.restaurant.update({ where: { id: row.id }, data: { cuisineTypeId: cafe.id, manualOverrideFields: JSON.stringify(["cuisineTypeId"]) } });

    await expect(apply.rollbackBatch({ prisma, batchId })).resolves.toMatchObject({ status: "rolled_back", protected: 1 });
    await expect(prisma.restaurant.findUnique({ where: { id: row.id } })).resolves.toMatchObject({ cuisineTypeId: cafe.id });
  });

  it("rolls back the whole apply transaction if a later row becomes stale", async () => {
    const hotPot = await prisma.cuisineType.findFirstOrThrow({ where: { code: "hot-pot", status: "active" } });
    const first = await createRestaurant(603);
    const second = await createRestaurant(604);
    const batchId = "phase6-atomic-603-604";
    createdBatchIds.push(batchId);
    const built = await apply.buildPlans({
      prisma,
      classificationRecords: {
        deterministic: [],
        ai: [classificationFor(first, hotPot.id), classificationFor(second, hotPot.id)],
        web: [],
      },
      review: null,
      activeCuisineTypes: [hotPot],
      restaurantIds: [],
      limit: null,
    });
    await prisma.restaurant.update({ where: { id: second.id }, data: { foodType: 99 } });

    await expect(apply.applyPlans({ prisma, plans: built.plans, batchId })).rejects.toThrow(/changed after fingerprint/u);
    await expect(prisma.restaurant.findUnique({ where: { id: first.id } })).resolves.toMatchObject({ cuisineTypeId: null });
    await expect(prisma.cuisineApplyBatch.findUnique({ where: { id: batchId } })).resolves.toBeNull();
  });
});
