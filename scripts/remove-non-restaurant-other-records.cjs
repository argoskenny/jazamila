#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const ROOT = path.resolve(__dirname, "..");

const DEFINITIONS = [
  ["convenience-store", /(?:統一超商|7[\s-]*eleven|全家便利商店|familymart|萊爾富|hi[\s-]*life|ok(?:超商|\s*mart)|富達零售股份有限公司)/iu],
  ["delivery-platform", /(?:外送合約平台|外送平台)/iu],
  ["gas-station", /(?:台灣中油|中油股份|加油站|油品行銷事業部)/u],
  ["automotive-company", /(?:汽車股份有限公司|汽車有限公司|汽車公司|汽車服務|汽車百貨|汽車保養|汽車維修|車業股份有限公司)/u],
];

// Match the store entity itself, not a restaurant whose branch happens to be
// inside Carrefour, RT-Mart, AMart, or another supermarket.
const SUPERMARKET_ENTITY = /^(?:台灣楓康超市股份有限公司|棉花田有機園地(?:\(.+門市\))?|彩虹奇菁肉肉超市|全聯實業股份有限公司.+分公司|新屋區農會生鮮超市|高雄市美濃區農會附設生鮮超市)$/u;

const RESTAURANT_SIGNAL = /餐廳|餐館|食堂|小吃|美食|料理|廚房|茶館|茶坊|咖啡|飯店$|麵|飯|粥|鍋|肉|雞|鴨|鵝|魚|蝦|餅|包|冰|甜點|烘焙|麵包|飲料|酒吧|餐酒|bar\b|bistro|自助餐|宴會|婚宴|早午餐|早餐|便當|燒烤|燒肉|牛排|火鍋/iu;
const HIGH_CONFIDENCE_NON_RESTAURANTS = [
  ["school", /(?:國民小學|國民中學|高中國中部|附設國中|附設國小|國中\(小\)|國小|國中|高中|高級中學|大學|學院|幼兒園|托兒所|補習班)$/u],
  ["medical-care", /(?:醫院|診所|衛生所|護理之家|養護中心|長照中心|照護中心|安養中心|老人之家)$/u],
  ["social-organization", /(?:社會福利基金會|社區發展協會|關懷協會|慈善基金會|文教基金會|產業工會|職業工會|同業公會)$/u],
  ["government-finance", /(?:區公所|鄉公所|鎮公所|市公所|戶政事務所|地政事務所|稅捐處|消防局|警察局|派出所|郵局|銀行|信用合作社)$/u],
  ["religious", /(?:寺|宮|廟|教會|禮拜堂|道院|佛堂)$/u],
  ["pure-lodging", /(?:民宿|旅館|汽車旅館|商旅|青年旅館|渡假村|度假村|酒店|大飯店|會館)$/u],
  ["pure-retail", /(?:書局|百貨有限公司|家具有限公司|便利商店|雜貨店|雜貨舖|購物中心|醬園門市部|醬油.+門市|生鮮肉品商行)$/u],
  ["pure-entertainment", /(?:影城股份有限公司|電影院|KTV|卡拉OK|遊藝場|電子遊戲場|網咖|撞球館|保齡球館|健身房|運動中心)$/iu],
  ["pure-attraction", /(?:主題館|遊樂園|美術館|博物館|故事館|觀光工廠|化石園區)$/u],
  ["pure-service", /(?:旅行社有限公司|營造股份有限公司|工程有限公司|工程行|建設股份有限公司|資訊有限公司|科技有限公司|設計企業社|行銷顧問有限公司)$/u],
];

function usage() {
  return `Usage: node scripts/remove-non-restaurant-other-records.cjs --database <file:path> --records <records.jsonl> [--apply]

Default mode is a read-only dry-run. --apply deletes only matched restaurantIds
that are still assigned to active CuisineType code "other".
`;
}

function parseArgs(argv) {
  const options = { database: null, recordsPath: null, apply: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--database" || argument.startsWith("--database=")) {
      options.database = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    } else if (argument === "--records" || argument.startsWith("--records=")) {
      options.recordsPath = path.resolve(ROOT, argument.includes("=") ? argument.split("=", 2)[1] : argv[++index]);
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.help) return options;
  if (!options.database || !options.recordsPath) throw new Error("--database and --records are required");
  if (!String(options.database).startsWith("file:")) throw new Error("--database must be an explicit SQLite file: URL");
  return options;
}

function categoryFor(name) {
  for (const [category, pattern] of DEFINITIONS) if (pattern.test(name)) return category;
  if (SUPERMARKET_ENTITY.test(name)) return "supermarket";
  if (!RESTAURANT_SIGNAL.test(name)) {
    for (const [category, pattern] of HIGH_CONFIDENCE_NON_RESTAURANTS) if (pattern.test(name)) return category;
  }
  return null;
}

function readPlan(recordsPath) {
  const rows = fs.readFileSync(recordsPath, "utf8").split(/\r?\n/u).filter(Boolean).map(JSON.parse);
  const plan = rows.map((row) => ({
    restaurantId: Number(row.restaurantId),
    name: String(row.input?.name ?? "").trim(),
    category: categoryFor(String(row.input?.name ?? "").trim()),
  })).filter((row) => row.category);
  if (new Set(plan.map((row) => row.restaurantId)).size !== plan.length) throw new Error("deletion plan contains duplicate restaurantId");
  return plan;
}

function categoryCounts(plan) {
  const counts = {};
  for (const row of plan) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return counts;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { process.stdout.write(usage()); return null; }
  const plan = readPlan(options.recordsPath);
  const ids = plan.map((row) => row.restaurantId);
  const prisma = new PrismaClient({ datasources: { db: { url: options.database } } });
  try {
    const rows = await prisma.restaurant.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, cuisineType: { select: { code: true, status: true } } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const item of plan) {
      const row = byId.get(item.restaurantId);
      if (!row) throw new Error(`restaurant ${item.restaurantId} does not exist`);
      if (row.name !== item.name) throw new Error(`restaurant ${item.restaurantId} name changed`);
      if (row.cuisineType?.code !== "other" || row.cuisineType.status !== "active") {
        throw new Error(`restaurant ${item.restaurantId} is no longer active other cuisine`);
      }
    }
    let deleted = 0;
    if (options.apply) {
      deleted = await prisma.$transaction(async (tx) => {
        const result = await tx.restaurant.deleteMany({ where: { id: { in: ids }, cuisineType: { code: "other", status: "active" } } });
        if (result.count !== plan.length) throw new Error(`delete count mismatch: ${result.count}/${plan.length}`);
        return result.count;
      });
    }
    const summary = {
      mode: options.apply ? "apply" : "dry-run",
      database: options.database,
      recordsPath: options.recordsPath,
      planned: plan.length,
      deleted,
      byCategory: categoryCounts(plan),
      distinctNames: new Set(plan.map((row) => row.name)).size,
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { categoryFor, main, parseArgs, readPlan, usage };
