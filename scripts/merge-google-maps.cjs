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

if (!basePath || !city || !district) throw new Error("Usage: merge-google-maps.cjs <base-json> <city> <district> [--target=200] [--write]");

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/台(?=中市|南市)/g, "臺")
    .toLowerCase()
    .replace(/[\s\u3000，,。．.、:：;；/\\()（）【】「」『』'"“”‘’《》<>\-—_]/g, "");
}

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

function linesOf(body) {
  return String(body || "")
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean);
}

function isNoise(line) {
  return /^(附近的餐廳|飯店|觀光景點|酒吧|咖啡|外帶|超市|已儲存|最近|取得應用程式|瀏覽相片|總覽|簡介|規劃路線|儲存|附近|傳送到手機|分享|線上點餐|預約|撰寫評論|提出修改建議|相片|新增相片和影片|關於此資料|充分運用 Google 地圖|登入|圖層|聲明商家擁有權|新增遺漏的資訊|新增營業時間|新增網站)/.test(line)
    || /^[\uE000-\uF8FF\uFFF0-\uFFFF\s]+$/.test(line)
    || line.length < 2;
}

function extractName(lines, rating) {
  const ratingIndex = lines.findIndex((line) => line === String(rating));
  if (ratingIndex < 0) return "";
  const recentIndex = lines.lastIndexOf("最近", ratingIndex);
  const candidates = lines.slice(Math.max(0, recentIndex + 1), ratingIndex).filter((line) => !isNoise(line));
  return candidates.at(-1) || "";
}

function canonicalAddress(lines) {
  const cityAliases = city === "臺中市" ? ["臺中市", "台中市"] : city === "臺南市" ? ["臺南市", "台南市"] : [city];
  const line = lines.find((item) => cityAliases.some((alias) => item.includes(alias)) && item.includes(district) && /號|路|街|巷|段/.test(item)) || "";
  const alias = cityAliases.find((item) => line.includes(item));
  if (!alias) return "";
  return line.slice(line.indexOf(alias)).replace(/\s+/g, "").replace(/台(?=中市|南市)/g, "臺");
}

function extractPhone(lines) {
  return lines.find((line) => /^(?:0\d{1,2}[ -]?\d{3,4}[ -]?\d{3,4}|09\d{2}[ -]?\d{3}[ -]?\d{3})$/.test(line.replace(/[()]/g, ""))) || "";
}

function extractCuisine(lines, rating) {
  const ratingIndex = lines.findIndex((line) => line === String(rating));
  if (ratingIndex < 0) return "其他餐飲";
  for (const line of lines.slice(ratingIndex + 1, ratingIndex + 10)) {
    if (isNoise(line) || line.includes(city) || line.includes(district) || /^(?:\d{3,5}|總覽|簡介)$/.test(line)) continue;
    const cleaned = line.split("·")[0].replace(/[\uE000-\uF8FF\uFFF0-\uFFFF]/g, "").trim();
    if (cleaned && /餐廳|餐館|料理|小吃|麵|飯|鍋|燒肉|燒烤|牛排|咖哩|咖啡|甜點|漢堡|披薩|壽司|居酒屋|茶飲|早餐|早午餐|熟食|餃子|飲食/.test(cleaned)) return cleaned;
  }
  return "其他餐飲";
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
    basis: "Google Maps 公開頁面未列完整價位，依料理分類估算；實際以店家最新菜單為準",
  };
}

function reviewCount(body) {
  const match = String(body || "").match(/([\d,]+)\s*(?:則)?評論/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function parseCandidate(item) {
  const lines = linesOf(item.body);
  const rating = Number(item.rating);
  const name = extractName(lines, rating) || String(item.name || "").trim();
  const address = canonicalAddress(lines);
  const phone = extractPhone(lines);
  const cuisine = extractCuisine(lines, rating);
  const closed = /(永久關閉|永久歇業|已歇業|暫時關閉|停業中)/.test(item.body);
  if (!item.href || !name || !address || !Number.isFinite(rating) || rating < 0 || rating > 5 || closed) return null;
  return {
    source_id: `googlemaps-${crypto.createHash("sha1").update(item.href).digest("hex").slice(0, 12)}`,
    name,
    address,
    phone: phone || null,
    physical_store: true,
    price_range_twd_per_person: estimatePrice(cuisine),
    cuisine_types: [cuisine],
    online_rating: {
      platform: "Google Maps",
      score: rating,
      review_count: reviewCount(item.body),
      source_snapshot: `Google Maps 公開店家頁面快照（${TODAY}）`,
      food_diary_count: null,
      review_summary: reviewSummaryToArray("Google Maps 公開頁面提供評分；評論數與完整評論摘要僅在頁面可解析時保留，未自行推估。"),
    },
    store_status_check: "Google Maps 公開店家頁面列有店址，未標示永久歇業；出發前仍建議確認當日營業。",
    sources: [item.href],
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
  const rawDetails = (await readStdin()).trim();
  const parsedDetails = JSON.parse(rawDetails || "[]");
  const details = repairMojibake(typeof parsedDetails === "string" ? JSON.parse(parsedDetails) : parsedDetails);
  const seen = new Set((base.restaurants || []).map((item) => `${normalize(item.name)}||${normalize(item.address)}`));
  const added = [];
  const rejected = {};
  for (const detail of details) {
    const candidate = parseCandidate(detail);
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
  const summary = {
    detail_count: details.length,
    valid_new_count: added.length,
    rejected,
    base_count: base.restaurants?.length || 0,
    merged_count: (base.restaurants?.length || 0) + added.length,
  };
  if (shouldWrite) {
    const restaurants = (base.restaurants || []).concat(added.map((item, index) => {
      const { _dedupeKey, ...publicItem } = item;
      const prefix = base.collection?.city === "臺中市" ? "taichung" : base.collection?.city === "臺南市" ? "tainan" : basePath.match(/docs\/([^-/]+)/)?.[1] || "regional";
      const slug = basePath.match(/-(.+)-restaurants\.json$/)?.[1] || "district";
      return { ...publicItem, id: `${prefix}-${slug}-${String((base.restaurants?.length || 0) + index + 1).padStart(3, "0")}` };
    }));
    base.collection = {
      ...base.collection,
      title: `${city}${district}實體餐廳資料（含 Google Maps 補充資料）`,
      scope: `${base.collection?.scope || `收集地址屬於${district}且有店面的餐廳。`} 再以 Google Maps 公開搜尋與店家頁面補充，僅保留公開頁面可核對到地址屬於${district}的店家。`,
      status: restaurants.length >= targetCount ? "complete" : "partial",
      record_count: restaurants.length,
      source_platform: `${base.collection?.source_platform || ""}; Google Maps public search and place pages`.replace(/^; /, ""),
      rating_note: "Google Maps 補充資料保留公開頁面評分；評論數與完整評論摘要未在頁面公開或無法解析時以 null 與說明表示。",
      review_note: "review_summary 僅保存來源頁面可公開解析的短摘要；未把完整評論全文寫入資料檔。",
      source_list_pages: [...new Set([...(base.collection?.source_list_pages || []), `https://www.google.com/maps/search/${encodeURIComponent(`${city}${district} 餐廳`)}`])],
      collection_stats: {
        ...(base.collection?.collection_stats || {}),
        google_maps_detail_count: details.length,
        google_maps_supplement_added: added.length,
        valid_count: restaurants.length,
      },
    };
    fs.writeFileSync(basePath, `${JSON.stringify({ collection: base.collection, restaurants }, null, 2)}\n`, "utf8");
    summary.written = basePath;
  }
  console.log(JSON.stringify(summary));
  if (shouldWrite && summary.merged_count < targetCount) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
