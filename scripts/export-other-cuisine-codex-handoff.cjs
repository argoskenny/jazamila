#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const { PrismaClient } = require("@prisma/client");

const ROOT = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/export-other-cuisine-codex-handoff.cjs --database <file:path> --output-dir <path>

Export every restaurant currently assigned to active CuisineType code "other".
This command is read-only for SQLite and refuses to overwrite an output directory.
`;
}

function parseArgs(argv) {
  const options = { database: null, outputDir: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--database" || argument.startsWith("--database=")) {
      options.database = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    } else if (argument === "--output-dir" || argument.startsWith("--output-dir=")) {
      options.outputDir = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.help) return options;
  if (!options.database || !options.outputDir) throw new Error("--database and --output-dir are required");
  if (!String(options.database).startsWith("file:")) throw new Error("--database must be an explicit SQLite file: URL");
  options.outputDir = path.resolve(ROOT, String(options.outputDir));
  return options;
}

function cleanText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function recordFor(row) {
  const tags = row.tags.map((relation) => ({
    id: relation.tag.id,
    name: relation.tag.name,
    normalizedName: relation.tag.normalizedName,
    position: relation.position,
    owner: relation.owner,
    sourceName: relation.sourceName,
    kind: relation.kind,
    isPublic: relation.isPublic,
    visibilityReason: relation.visibilityReason,
  }));
  const sourceRefs = parseJsonArray(row.sourceRefsJson);
  if (sourceRefs.length === 0 && (row.sourceFile || row.sourceId)) {
    sourceRefs.push({ file: row.sourceFile ?? null, sourceId: row.sourceId ?? null });
  }
  const input = {
    name: cleanText(row.name),
    note: cleanText(row.note),
    address: cleanText(row.address),
    phone: cleanText(row.phone) || [row.areaNum, row.telNum].filter(Boolean).join(" "),
    currentFoodType: Number(row.foodType ?? 0),
    currentCuisineType: row.cuisineType,
    auxiliaryTags: tags.filter((tag) => tag.kind === "auxiliary" && tag.isPublic).map((tag) => tag.name),
    hiddenSourceTags: tags.filter((tag) => tag.kind !== "auxiliary" || !tag.isPublic),
    allTags: tags,
    reviewSummaries: parseJsonArray(row.reviewSummaryJson).map(cleanText).filter(Boolean),
    knownSourceReferences: sourceRefs,
    sourceFile: row.sourceFile ?? null,
    sourceId: row.sourceId ?? null,
  };
  return {
    schemaVersion: "cuisine-other-reclassification-input-v1",
    restaurantId: row.id,
    inputFingerprint: sha256(JSON.stringify({ restaurantId: row.id, input })),
    input,
  };
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`, "utf8")) await once(stream, "drain");
}

function promptText({ database, recordsPath, cuisineTypesPath, recordCount }) {
  return `# Codex session：重新分類目前仍為「其他餐飲」的餐廳

請全權處理 \`${recordsPath}\` 中 ${recordCount.toLocaleString("en-US")} 筆餐廳。這些餐廳目前都使用 CuisineType id 22「其他餐飲」。

- 目標開發資料庫：\`${database}\`
- 現有料理類型：\`${cuisineTypesPath}\`
- 採寬鬆判定；名稱、標籤、評論摘要大致可判斷時直接分類。
- 本地資料仍不足時可做簡單網路搜尋，用店名加地區或地址辨識，通常查看 1～2 個結果即可。
- 優先使用現有 CuisineType；真的沒有合適大類時，可新增穩定、可重用的類型。
- 不要用品牌名、單一道菜或行銷詞建立類型。
- 可直接分批更新上述開發資料庫；只處理 records.jsonl 內的 restaurantId。
- 每筆都要嘗試選出比「其他餐飲」更具體的類型；仍完全無法判斷才保留 id 22。
- 完成後回報更新數、仍為其他餐飲數、新增類型與失敗數。
`;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { process.stdout.write(usage()); return null; }
  if (fs.existsSync(options.outputDir)) throw new Error(`refusing to overwrite output directory: ${options.outputDir}`);
  fs.mkdirSync(options.outputDir, { recursive: true });

  const prisma = new PrismaClient({ datasources: { db: { url: options.database } } });
  const recordsPath = path.join(options.outputDir, "records.jsonl");
  const cuisineTypesPath = path.join(options.outputDir, "cuisine-types.json");
  const promptPath = path.join(options.outputDir, "codex-prompt.md");
  const stream = fs.createWriteStream(recordsPath, { flags: "wx", encoding: "utf8" });
  let count = 0;
  try {
    const other = await prisma.cuisineType.findUnique({ where: { code: "other" } });
    if (!other || other.status !== "active") throw new Error("active CuisineType code other was not found");
    const cuisineTypes = await prisma.cuisineType.findMany({ where: { status: "active" }, orderBy: { id: "asc" } });
    fs.writeFileSync(cuisineTypesPath, `${JSON.stringify({ cuisineTypes }, null, 2)}\n`, { flag: "wx" });
    const chunkSize = 500;
    let cursor = 0;
    while (true) {
      const rows = await prisma.restaurant.findMany({
        where: { cuisineTypeId: other.id, id: { gt: cursor } },
        orderBy: { id: "asc" },
        take: chunkSize,
        include: {
          cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
          tags: { orderBy: { position: "asc" }, include: { tag: true } },
        },
      });
      if (rows.length === 0) break;
      for (const row of rows) { await writeLine(stream, recordFor(row)); count += 1; }
      cursor = rows.at(-1).id;
    }
    stream.end();
    await once(stream, "finish");
    const databaseCount = await prisma.restaurant.count({ where: { cuisineTypeId: other.id } });
    if (count !== databaseCount) throw new Error(`export count mismatch: ${count}/${databaseCount}`);
    fs.writeFileSync(promptPath, promptText({ database: options.database, recordsPath, cuisineTypesPath, recordCount: count }), { flag: "wx" });
    const summary = {
      schemaVersion: "cuisine-other-reclassification-handoff-v1",
      createdAt: new Date().toISOString(),
      readOnlyExport: true,
      database: options.database,
      cuisineType: { id: other.id, code: other.code, name: other.name, status: other.status },
      recordCount: count,
      activeCuisineTypeCount: cuisineTypes.length,
      recordsPath,
      cuisineTypesPath,
      promptPath,
    };
    const summaryPath = path.join(options.outputDir, "summary.json");
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
    const files = [recordsPath, cuisineTypesPath, promptPath, summaryPath].map((filePath) => ({
      path: path.basename(filePath), bytes: fs.statSync(filePath).size, sha256: sha256File(filePath),
    }));
    fs.writeFileSync(path.join(options.outputDir, "sha256-manifest.json"), `${JSON.stringify({ algorithm: "sha256", files }, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } finally {
    if (!stream.closed) stream.destroy();
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { main, parseArgs, recordFor, usage };
