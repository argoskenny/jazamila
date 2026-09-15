import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

async function databaseSnapshot(client: PrismaClient) {
  const tables = await client.$queryRaw<Array<{ name: string; sql: string }>>`
    SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name
  `;
  const snapshot = [];
  for (const table of tables) {
    const rows = await client.$queryRawUnsafe(`SELECT * FROM "${table.name.replace(/"/g, '""')}" ORDER BY rowid`);
    snapshot.push({ ...table, rows });
  }
  return JSON.stringify(snapshot, (_, value) => typeof value === "bigint" ? value.toString() : value);
}

it("runs the three dry-run npm commands without changing SQLite or source inputs", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-dry-run-cli-"));
  const databaseUrl = `file:${path.join(tempDir, "test.sqlite")}`;
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const dataDir = path.join(tempDir, "sources");
  const sourcePath = path.join(dataDir, "restaurants.json");
  const reportPath = path.join(tempDir, "report.json");
  const typesPath = path.join(tempDir, "types.json");
  try {
    fs.writeFileSync(path.join(tempDir, "test.sqlite"), "");
    const setup = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], {
      env, encoding: "utf8", timeout: 30_000
    });
    expect(setup.status, setup.stderr).toBe(0);
    await client.restaurant.create({
      data: { id: 42, name: "待確認餐廳", address: "台北市大同區測試路 1 號", foodType: 0 }
    });
    fs.mkdirSync(dataDir);
    fs.writeFileSync(sourcePath, JSON.stringify({ restaurants: [{ id: "42", name: "待確認餐廳" }] }));
    fs.copyFileSync("tests/fixtures/cuisine-types-with-ids.json", typesPath);
    const originalInputs = [sourcePath, typesPath].map((file) => fs.readFileSync(file, "utf8"));
    const before = await databaseSnapshot(client);

    const commands = [
      { name: "db:classify:cuisine:dry", args: ["--data-dir", dataDir, "--report", reportPath], output: reportPath },
      ...["ai", "web"].map((kind) => ({
        name: `db:classify:cuisine:${kind}:dry`,
        args: ["--input", reportPath, "--cuisine-types", typesPath, "--requests", path.join(tempDir, `${kind}.jsonl`)],
        output: path.join(tempDir, `${kind}.jsonl`)
      }))
    ];
    for (const command of commands) {
      const result = spawnSync("npm", ["run", "--silent", command.name, "--", ...command.args], {
        env, encoding: "utf8", timeout: 30_000
      });
      expect(result.status, `${command.name}: ${result.stderr}`).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ mode: "dry-run", readOnly: true });
      const output = fs.readFileSync(command.output, "utf8");
      const records = command.output.endsWith(".jsonl")
        ? output.trim().split("\n").map((line) => JSON.parse(line))
        : JSON.parse(output).results;
      expect(records).toHaveLength(1);
      expect(records[0].restaurantId).toBe(42);
      expect(await databaseSnapshot(client)).toBe(before);
      expect([sourcePath, typesPath].map((file) => fs.readFileSync(file, "utf8"))).toEqual(originalInputs);

      const rejected = spawnSync("npm", ["run", "--silent", command.name, "--", ...command.args, "--apply"], {
        env, encoding: "utf8", timeout: 30_000
      });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain("Unknown option: --apply");
      expect(await databaseSnapshot(client)).toBe(before);
      expect(fs.readFileSync(command.output, "utf8")).toBe(output);
    }
  } finally {
    await client.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}, 60_000);
