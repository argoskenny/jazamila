import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

describe("legacy import runner", () => {
  it("does not silently skip duplicate source rows", async () => {
    const { replaceTable } = require("../../scripts/legacy-import-runner.cjs") as {
      replaceTable: (
        model: { createMany: (input: unknown) => Promise<void> },
        rows: Array<{ id: number }>,
        label: string,
        options: { dryRun: boolean; batchSize: number; logger: { log: (message: string) => void } }
      ) => Promise<void>;
    };
    const model = { createMany: vi.fn(async () => undefined) };

    await replaceTable(model, [{ id: 1 }], "table", {
      dryRun: false,
      batchSize: 100,
      logger: { log: vi.fn() }
    });

    expect(model.createMany).toHaveBeenCalledWith({ data: [{ id: 1 }] });
  });

  it("runs destructive imports inside a Prisma transaction", async () => {
    const { runImport } = require("../../scripts/legacy-import-runner.cjs") as {
      runImport: (options: {
        prisma: Record<string, unknown>;
        legacy: { query: (sql: string) => Promise<unknown> };
        dryRun: boolean;
        batchSize: number;
        logger: { log: (message: string) => void };
      }) => Promise<void>;
    };

    const baseModel = {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn()
    };
    const txModel = {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(async () => 0),
      updateMany: vi.fn(async () => ({ count: 0 }))
    };
    const city = {
      findFirst: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data })),
      create: vi.fn()
    };
    const district = {
      findFirst: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data })),
      create: vi.fn()
    };
    const tx = {
      restaurant: txModel,
      post: txModel,
      blogLink: txModel,
      feedback: txModel,
      city,
      district
    };
    const prisma = {
      restaurant: baseModel,
      post: baseModel,
      blogLink: baseModel,
      feedback: baseModel,
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx))
    };
    const legacy = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("COUNT")) return [[{ count: 0 }]];
        return [[]];
      })
    };

    await runImport({
      prisma,
      legacy,
      dryRun: false,
      batchSize: 500,
      logger: { log: vi.fn() }
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(txModel.deleteMany).toHaveBeenCalled();
    expect(baseModel.deleteMany).not.toHaveBeenCalled();
    expect(city.update).toHaveBeenCalled();
  });

  it("rolls back when imported row counts do not match the legacy source", async () => {
    const { runImport } = require("../../scripts/legacy-import-runner.cjs") as {
      runImport: (options: {
        prisma: Record<string, unknown>;
        legacy: { query: (sql: string) => Promise<unknown> };
        dryRun: boolean;
        batchSize: number;
        logger: { log: (message: string) => void };
      }) => Promise<void>;
    };
    const model = {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(async () => 0),
      updateMany: vi.fn(async () => ({ count: 0 }))
    };
    const locationModel = {
      findFirst: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data })),
      create: vi.fn()
    };
    const tx = {
      restaurant: model,
      post: model,
      blogLink: model,
      feedback: model,
      city: locationModel,
      district: locationModel
    };
    const prisma = {
      ...tx,
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx))
    };
    const legacy = {
      query: vi.fn(async (sql: string) => sql.includes("COUNT") ? [[{ count: 1 }]] : [[]])
    };

    await expect(runImport({
      prisma,
      legacy,
      dryRun: false,
      batchSize: 500,
      logger: { log: vi.fn() }
    })).rejects.toThrow("匯入筆數不一致");
  });
});
