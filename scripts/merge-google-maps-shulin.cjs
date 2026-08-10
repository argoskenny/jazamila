#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const { reviewSummaryToArray } = require("./review-summary-utils.cjs");

const basePath = process.argv[2] || "docs/res_data/newtaipei-shulin-restaurants.json";
const outputPath = process.argv[3] || basePath;
const targetCount = Number(process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || 200);
const shouldWrite = process.argv.includes("--write");
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const SEARCH_SOURCES = [
  "https://www.google.com/maps/search/樹林區+餐廳",
  "https://www.google.com/maps/search/樹林區+小吃",
  "https://www.google.com/maps/search/樹林區+早午餐",
  "https://www.google.com/maps/search/樹林區+早餐",
  "https://www.google.com/maps/search/樹林區+火鍋",
  "https://www.google.com/maps/search/樹林區+麵店",
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\u3000，,。．.、:：()（）【】「」『』'"“”‘’《》<>\-—_]/g, "");
}

function linesOf(body) {
  return String(body || "")
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean);
}

function isNoise(line) {
  return /^(附近的餐廳|飯店|觀光景點|酒吧|咖啡|外帶|超市|已儲存|最近|取得應用程式|瀏覽相片|總覽|簡介|規劃路線|儲存|附近|傳送到手機|分享|線上點餐|預約|撰寫評論|提出修改建議|相片|新增相片和影片|關於此資料|充分運用 Google 地圖|登入|圖層)/.test(line)
    || /^[\uE000-\uF8FF\uFFF0-\uFFFF\s]+$/.test(line)
    || line.length < 2;
}

function extractName(lines, rating) {
  const ratingIndex = lines.findIndex((line) => line === String(rating));
  if (ratingIndex < 0) return "";
  const start = Math.max(0, lines.lastIndexOf("最近", ratingIndex) + 1);
  const candidates = lines.slice(start, ratingIndex).filter((line) => !isNoise(line));
  return candidates.at(-1) || "";
}

function extractAddress(lines, city, district) {
  const marker = `${city}${district}`;
  return lines.find((line) => line.includes(marker) && !line.includes("所在地點")) || "";
}

function extractPhone(lines) {
  return lines.find((line) => /^(?:0\d{1,2}[ -]?\d{3,4}[ -]?\d{3,4}|09\d{2}[ -]?\d{3}[ -]?\d{3})$/.test(line)) || "";
}

function extractCuisine(lines, rating) {
  const ratingIndex = lines.findIndex((line) => line === String(rating));
  if (ratingIndex < 0) return "其他餐飲";
  for (const line of lines.slice(ratingIndex + 1, ratingIndex + 6)) {
    if (isNoise(line)) continue;
    const cleaned = line.split("·")[0].replace(/[\uE000-\uF8FF\uFFF0-\uFFFF]/g, "").trim();
    if (cleaned && /餐廳|餐館|料理|小吃|麵|飯|鍋|燒肉|燒烤|牛排|咖哩|咖啡|甜點|漢堡|披薩|壽司|居酒屋|茶飲|店$/.test(cleaned)) return cleaned;
  }
  return "其他餐飲";
}

function estimatePrice(cuisine) {
  let min = 150;
  let max = 800;
  if (/(小吃|早餐|早午餐|咖啡|甜點|蛋糕|麵|便當|茶飲|冰品|飯)/.test(cuisine)) {
    min = 80;
    max = 400;
  } else if (/(牛排|燒肉|海鮮|無菜單|法式|高級)/.test(cuisine)) {
    min = 400;
    max = 1800;
  }
  return {
    min,
    max,
    display: `約 NT$${min}–${max}/人`,
    basis: "Google Maps 公開頁面未列完整價位，依料理分類估算；實際以店家最新菜單為準",
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function parseCandidate(item) {
  const bodyLines = linesOf(item.body);
  const rating = Number(item.rating);
  const address = extractAddress(bodyLines, "新北市", "樹林區");
  const phone = extractPhone(bodyLines);
  const name = extractName(bodyLines, rating);
  const cuisine = extractCuisine(bodyLines, rating);
  const permanentlyClosed = /(永久關閉|永久歇業|已歇業|暫時關閉)/.test(item.body);
  if (!item.href || !name || !address || !phone || !Number.isFinite(rating) || permanentlyClosed) return null;
  return {
    source_id: `googlemaps-${crypto.createHash("sha1").update(item.href).digest("hex").slice(0, 12)}`,
    name,
    address,
    phone,
    physical_store: true,
    price_range_twd_per_person: estimatePrice(cuisine),
    cuisine_types: [cuisine],
    online_rating: {
      platform: "Google Maps",
      score: rating,
      review_count: null,
      source_snapshot: `Google Maps 公開店家頁面快照（${TODAY}）`,
      food_diary_count: null,
      review_summary: reviewSummaryToArray("Google Maps 公開頁面提供評分；目前頁面未公開可解析的評論數與完整評論摘要。"),
    },
    store_status_check: "Google Maps 公開店家頁面列有店址與電話，未標示永久歇業；出發前仍建議確認當日營業。",
    sources: [item.href],
    _dedupeKey: `${normalize(name)}||${normalize(address)}`,
  };
}

async function main() {
  const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const details = JSON.parse((await readStdin()) || "[]");
  const seen = new Set((base.restaurants || []).map((item) => `${normalize(item.name)}||${normalize(item.address)}`));
  const added = [];
  const rejected = {};
  for (const detail of details) {
    const candidate = parseCandidate(detail);
    if (!candidate) {
      rejected.invalid = (rejected.invalid || 0) + 1;
      continue;
    }
    if (seen.has(candidate._dedupeKey)) {
      rejected.duplicate = (rejected.duplicate || 0) + 1;
      continue;
    }
    seen.add(candidate._dedupeKey);
    added.push(candidate);
    if ((base.restaurants?.length || 0) + added.length >= targetCount) break;
  }
  const summary = {
    detail_count: details.length,
    valid_new_count: added.length,
    rejected,
    base_count: base.restaurants?.length || 0,
    merged_count: (base.restaurants?.length || 0) + added.length,
  };
  if (shouldWrite && summary.merged_count >= targetCount) {
    const restaurants = base.restaurants.concat(added.map((item, index) => {
      const { _dedupeKey, ...publicItem } = item;
      return { ...publicItem, id: `newtaipei-shulin-${String(base.restaurants.length + index + 1).padStart(3, "0")}` };
    }));
    base.collection = {
      ...base.collection,
      title: "新北市樹林區實體餐廳資料（含 Google Maps 補充資料）",
      scope: "以 FonFood 公開店家頁面取得 150 筆基礎資料，再以 Google Maps 公開搜尋與店家頁面補充，逐筆核對完整地址、電話、料理分類與評分；僅保留地址屬於樹林區、具店址與電話且未見永久歇業標記的有店面店家。",
      status: "complete",
      target_count: targetCount,
      record_count: restaurants.length,
      source_platform: "FonFood public restaurant pages; Google Maps public search and place pages",
      rating_note: "FonFood 基礎資料保留來源頁面的 Google 評價快照；Google Maps 補充資料保留公開頁面評分，評論數與完整評論摘要未在可解析頁面公開時以 null 與說明表示。",
      review_note: "review_summary 僅保存來源頁面可公開解析的短摘要；Google Maps 補充資料若未公開評論數或完整摘要，不自行推估。",
      source_list_pages: [...new Set([...(base.collection.source_list_pages || []), ...SEARCH_SOURCES])],
      collection_stats: {
        ...(base.collection.collection_stats || {}),
        fonfood_base_count: base.restaurants.length,
        google_maps_detail_count: details.length,
        google_maps_supplement_added: added.length,
        valid_count: restaurants.length,
      },
    };
    fs.writeFileSync(outputPath, `${JSON.stringify({ collection: base.collection, restaurants }, null, 2)}\n`, "utf8");
    summary.written = outputPath;
  }
  console.log(JSON.stringify(summary));
  if (shouldWrite && !summary.written) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
