import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

describe("legacy import runner", () => {
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
      count: vi.fn(async () => 0)
    };
    const tx = {
      restaurant: txModel,
      post: txModel,
      blogLink: txModel,
      feedback: txModel
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
  });
});
