#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const { reviewSummaryToArray } = require("./review-summary-utils.cjs");

const basePath = process.argv[2];
const city = process.argv[3];
const district = process.argv[4];
const targetCount = Number(process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || 200);
const shouldWrite = process.argv.includes("--write");
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

if (!basePath || !city || !district) throw new Error("Usage: merge-google-maps-cards.cjs <base-json> <city> <district> [--target=200] [--write]");

function repairMojibake(value) {
  if (typeof value === "string") {
    if (!/[ÃÂæåçèéêëìíîïðñòóôõöøùúûüýþÿ\u0080-\u009f]/.test(value)) return value;
    try {
      return Buffer.from(value, "latin1").toString("utf8");
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(repairMojibake);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairMojibake(item)]));
  return value;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/台(?=中市|南市)/g, "臺")
    .toLowerCase()
    .replace(/[\s\u3000，,。．.、:：;；/\\()（）【】「」『』'"“”‘’《》<>\-—_]/g, "");
}

function linesOf(value) {
  return String(value || "").split(/\n+/).map((line) => line.replace(/[\t ]+/g, " ").trim()).filter(Boolean);
}

function estimatePrice(cuisine) {
  let min = 150;
  let max = 800;
  if (/(小吃|早餐|早午餐|咖啡|甜點|蛋糕|麵|便當|茶飲|冰品|熟食)/.test(cuisine)) {
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
    basis: "Google Maps 搜尋卡片未列完整價位，依料理分類估算；實際以店家最新菜單為準",
  };
}

function parseCard(card) {
  const lines = linesOf(card.text);
  const name = String(card.name || lines.find((line) => !/^[0-5](?:\.[0-9])?$/.test(line) && !/^(營業中|已打烊|即將開始營業|永久關閉|已歇業)/.test(line)) || "").trim();
  const rating = Number(card.rating);
  const locationLine = lines.find((line) => line.includes("·"));
  const parts = locationLine ? locationLine.split("·").map((part) => part.trim()).filter(Boolean) : [];
  const cuisine = parts[0] || "其他餐飲";
  const shortAddress = parts.at(-1) || lines.find((line) => /號|路|街|巷|段|村|里|道|鄰/.test(line) && !line.includes("營業")) || "";
  const closed = /永久關閉|永久歇業|已歇業|停業中|目前不提供用餐/.test(String(card.text));
  const nonRestaurant = /住宿|旅館|民宿|露營|景點|公園|市場|車站|休閒農場/.test(`${name} ${cuisine}`) && !/餐廳|咖啡|餐坊|餐飲/.test(`${name} ${cuisine}`);
  if (!card.href || !name || !shortAddress || !Number.isFinite(rating) || rating < 0 || rating > 5 || closed || nonRestaurant) return null;
  if (/^[\d\s+.-]+$/.test(shortAddress) || shortAddress.length < 2) return null;
  const address = shortAddress.includes(city) && shortAddress.includes(district)
    ? shortAddress.replace(/\s+/g, "").replace(/台(?=中市|南市)/g, "臺")
    : `${city}${district}${shortAddress.replace(/\s+/g, "")}`;
  return {
    source_id: `googlemaps-card-${crypto.createHash("sha1").update(card.href).digest("hex").slice(0, 12)}`,
    name,
    address,
    phone: null,
    physical_store: true,
    price_range_twd_per_person: estimatePrice(cuisine),
    cuisine_types: [cuisine],
    online_rating: {
      platform: "Google Maps",
      score: rating,
      review_count: null,
      source_snapshot: `Google Maps 公開搜尋卡片快照（${TODAY}）`,
      food_diary_count: null,
      review_summary: reviewSummaryToArray("搜尋卡片提供店名、料理分類與評分；卡片未提供可解析的電話、評論數與完整評論摘要。"),
    },
    store_status_check: "Google Maps 公開搜尋卡片列有店址與評分，未標示永久歇業；因詳情頁未能載入，出發前務必再確認電話與營業狀態。",
    sources: [card.href],
    _dedupeKey: `${normalize(name)}||${normalize(address)}`,
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const raw = (await readStdin()).trim();
  const parsed = JSON.parse(raw || "[]");
  const cards = repairMojibake(typeof parsed === "string" ? JSON.parse(parsed) : parsed);
  const seen = new Set((base.restaurants || []).map((item) => `${normalize(item.name)}||${normalize(item.address)}`));
  const added = [];
  const rejected = {};
  for (const card of cards) {
    const candidate = parseCard(card);
    if (!candidate) {
      rejected.invalid = (rejected.invalid || 0) + 1;
      continue;
    }
    if (!candidate.address.includes(city) || !candidate.address.includes(district)) {
      rejected.out_of_scope = (rejected.out_of_scope || 0) + 1;
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
  const prefix = basePath.match(/docs\/([^/]+)-restaurants\.json$/)?.[1] || "regional-district";
  const restaurants = (base.restaurants || []).concat(added).map((item, index) => {
    const { _dedupeKey, ...publicItem } = item;
    return { ...publicItem, id: `${prefix}-${String(index + 1).padStart(3, "0")}` };
  });
  const summary = {
    card_count: cards.length,
    valid_new_count: added.length,
    rejected,
    base_count: base.restaurants?.length || 0,
    merged_count: restaurants.length,
  };
  if (shouldWrite) {
    base.collection = {
      ...base.collection,
      title: `${city}${district}實體餐廳資料（含 Google Maps 搜尋卡片補充）`,
      scope: `${base.collection?.scope || `收集地址屬於${district}且有店面的餐廳。`} 再以 Google Maps 公開搜尋卡片補充，卡片未能載入詳情頁時不填電話且在欄位中保留說明。`,
      status: restaurants.length >= targetCount ? "complete" : "partial",
      record_count: restaurants.length,
      source_platform: `${base.collection?.source_platform || ""}; Google Maps public search cards`.replace(/^; /, ""),
      rating_note: "Google Maps 搜尋卡片補充資料保留卡片顯示的評分；卡片未提供評論數時以 null 表示，未自行推估。",
      review_note: "Google Maps 搜尋卡片未提供完整評論摘要時以明確說明表示；未把完整評論全文寫入資料檔。",
      source_list_pages: [...new Set([...(base.collection?.source_list_pages || []), `https://www.google.com/maps/search/${encodeURIComponent(`${city}${district} 餐廳`)}`])],
      collection_stats: {
        ...(base.collection?.collection_stats || {}),
        google_maps_card_count: cards.length,
        google_maps_card_supplement_added: added.length,
        valid_count: restaurants.length,
      },
    };
    fs.writeFileSync(basePath, `${JSON.stringify({ collection: base.collection, restaurants }, null, 2)}\n`, "utf8");
    summary.written = basePath;
  }
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
