import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";

it("initializes production lookups and cuisines without demo restaurants, repeatably", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jazamila-bootstrap-"));
  const databaseUrl = `file:${join(dir, "fresh.db")}`;
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    for (let index = 0; index < 2; index++) {
      execFileSync("npm", ["run", "db:migrate:prod"], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe", timeout: 15000 });
    }
    expect(await client.cuisineType.count({ where: { status: "active" } })).toBeGreaterThan(0);
    expect(await client.city.count()).toBeGreaterThan(0);
    expect(await client.restaurant.count()).toBe(0);
  } finally { await client.$disconnect(); rmSync(dir, { recursive: true, force: true }); }
}, 35000);
