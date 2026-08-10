#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { reviewSummaryToArray } = require("./review-summary-utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const RESTAURANT_DATA_DIR = path.join(ROOT, "docs", "res_data");
const TARGET_COUNT = Number(process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || 200);
const SHOULD_WRITE = process.argv.includes("--write");
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

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
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairMojibake(item)]));
  }
  return value;
}

function clean(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function normalize(value) {
  return clean(value)
    .replace(/台(?=中市|南市)/g, "臺")
    .toLowerCase()
    .replace(/[\s\u3000，,。．.、:：;；/\\()（）【】「」『』'"“”‘’《》<>\-—_]/g, "");
}

function linesOf(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean);
}

function inferCuisine(name, tags) {
  const text = `${name} ${tags.join(" ")}`;
  const rules = [
    [/早餐|三明治|蛋餅/, "早餐"],
    [/早午餐/, "早午餐"],
    [/咖啡|cafe|coffee/i, "咖啡"],
    [/甜點|蛋糕|冰品|冰店|餅店|烘焙|麵包/, "甜點／烘焙"],
    [/飲料|茶飲|手搖|茶館/, "茶飲／飲料"],
    [/海鮮|魚|蝦|蟹/, "海鮮料理"],
    [/牛肉麵|麵|小吃|水餃|餃子|碗粿|肉圓/, "麵食／小吃"],
    [/火鍋|鍋物/, "火鍋"],
    [/燒肉|燒烤|炭烤/, "燒烤／燒肉"],
    [/日式|壽司|拉麵|丼飯|居酒屋/, "日式料理"],
    [/義式|義大利|披薩/, "義式料理"],
    [/越南|泰式|南洋/, "東南亞料理"],
    [/素食|蔬食/, "素食"],
    [/合菜|台菜|中式|餐廳|餐館|午餐|晚餐|食堂|料理/, "中式／台式料理"],
  ];
  const result = [];
  for (const [pattern, label] of rules) if (pattern.test(text)) result.push(label);
  for (const tag of tags) {
    if (!result.includes(tag) && tag.length <= 12 && !/^(?:午餐|晚餐|下午茶|宵夜|約會|聚餐)$/.test(tag)) result.push(tag);
  }
  return [...new Set(result)].slice(0, 3).length ? [...new Set(result)].slice(0, 3) : ["其他餐飲"];
}

function estimatedPrice(cuisineTypes) {
  const text = cuisineTypes.join(" ");
  let min = 150;
  let max = 600;
  if (/(早餐|甜點|烘焙|茶飲|飲料|麵食|小吃|咖啡)/.test(text)) {
    min = 60;
    max = 400;
  } else if (/(海鮮|燒肉|燒烤|合菜)/.test(text)) {
    min = 250;
    max = 1000;
  }
  return {
    min,
    max,
    display: `約 NT$${min}–${max}/人`,
    basis: "愛食記列表未提供均消時，依料理分類估算；實際以店家最新菜單為準",
  };
}

function priceFromAverage(value, cuisineTypes) {
  const average = Number(value);
  if (!Number.isFinite(average) || average <= 0) return estimatedPrice(cuisineTypes);
  const min = Math.max(20, Math.floor((average * 0.8) / 10) * 10);
  const max = Math.max(min, Math.ceil((average * 1.2) / 10) * 10);
  return {
    min,
    max,
    display: `約 NT$${min}–${max}/人（愛食記均消約 NT$${average}）`,
    basis: "依愛食記列表顯示的均消換算為約略範圍；實際以店家最新菜單為準",
  };
}

function parseCard(card, city, district, sourceUrl) {
  const lines = linesOf(card.text);
  const canonicalCity = city.replace(/台(?=中市|南市)/g, "臺");
  const expectedDistrict = district.endsWith("區") ? district : `${district}區`;
  const fieldAddress = clean(card.address).replace(/台(?=中市|南市)/g, "臺").replace(/\s+/g, "");
  const addressLine = fieldAddress || lines.find((line) => {
    const normalized = line.replace(/台(?=中市|南市)/g, "臺");
    return normalized.includes(canonicalCity) && normalized.includes(expectedDistrict) && /號|路|街|巷|段|村|里|鄰/.test(normalized);
  });
  if (!card.id || !card.name || !addressLine || /歇業|永久關閉|暫停營業/.test(`${card.status || ""} ${card.text || ""}`)) return null;
  const address = addressLine.replace(/\s+/g, "").replace(/台(?=中市|南市)/g, "臺");
  const ratingLine = clean(card.rating) || lines.find((line) => /^\d(?:\.\d)?$/.test(line));
  const rating = ratingLine && Number.isFinite(Number(ratingLine)) ? Number(ratingLine) : null;
  const reviewLine = clean(card.review_count) || lines.find((line) => /^\([\d,]+則評論\)$/.test(line));
  const reviewCount = reviewLine ? Number(reviewLine.replace(/[^\d]/g, "")) : null;
  const averageLine = clean(card.average) || lines.find((line) => /^均消\s*\$[\d,]+/.test(line));
  const average = averageLine ? Number(averageLine.replace(/[^\d]/g, "")) : null;
  const addressIndex = lines.indexOf(addressLine);
  const tags = Array.isArray(card.tags) && card.tags.length > 0 ? card.tags.map(clean).filter(Boolean) : lines.slice(addressIndex + 1).filter((line) => {
    if (/^(?:現正營業|今日營業|今日休息|均消|永久關閉|暫停營業)/.test(line)) return false;
    if (/^\d{1,2}:\d{2}/.test(line)) return false;
    return !line.includes("共搜尋到") && line.length <= 20;
  });
  const cuisineTypes = inferCuisine(card.name, tags);
  const sourceId = `ifoodie-${card.id}`;
  return {
    source_id: sourceId,
    name: clean(card.name),
    address,
    phone: null,
    physical_store: true,
    price_range_twd_per_person: priceFromAverage(average, cuisineTypes),
    cuisine_types: cuisineTypes,
    online_rating: rating === null
      ? {
          platform: "未提供",
          score: null,
          review_count: reviewCount,
          source_snapshot: `愛食記行政區列表快照（${TODAY}）`,
          food_diary_count: null,
          review_summary: reviewSummaryToArray(`愛食記列表收錄此店家，但未顯示可解析的評分；列表顯示評論數為 ${reviewCount ?? "未知"}。`),
        }
      : {
          platform: "愛食記",
          score: rating,
          review_count: reviewCount,
          source_snapshot: `愛食記行政區列表快照（${TODAY}）`,
          food_diary_count: null,
          review_summary: reviewSummaryToArray(`愛食記列表顯示 ${rating} 分、${reviewCount ?? "未知"} 則評論；未把完整評論全文寫入資料檔。`),
        },
    store_status_check: "愛食記行政區列表列有店家地址；列表未標示永久歇業，電話與當日營業狀態仍建議出發前確認。",
    sources: [sourceUrl, card.href],
    _dedupeKey: `${normalize(card.name)}||${normalize(address)}`,
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = (await readStdin()).trim();
  const parsed = JSON.parse(raw || "[]");
  const scopes = repairMojibake(typeof parsed === "string" ? JSON.parse(parsed) : parsed);
  const summaries = [];
  for (const scope of Array.isArray(scopes) ? scopes : []) {
    const file = path.join(RESTAURANT_DATA_DIR, `${scope.key}-restaurants.json`);
    if (!fs.existsSync(file)) {
      summaries.push({ key: scope.key, error: "missing_json" });
      continue;
    }
    const base = JSON.parse(fs.readFileSync(file, "utf8"));
    const baseRestaurants = (base.restaurants || []).filter((item) => !/^ifoodie-/.test(String(item.source_id || "")));
    const seen = new Set(baseRestaurants.map((item) => `${normalize(item.name)}||${normalize(item.address)}`));
    const added = [];
    const rejected = {};
    if (baseRestaurants.length < TARGET_COUNT) {
      for (const card of scope.cards || []) {
        const candidate = parseCard(card, scope.city, scope.district, scope.url);
        if (!candidate) {
          rejected.invalid = (rejected.invalid || 0) + 1;
          continue;
        }
        const expectedDistrict = scope.district.endsWith("區") ? scope.district : `${scope.district}區`;
        if (!candidate.address.includes(scope.city.replace(/台(?=中市|南市)/g, "臺")) || !candidate.address.includes(expectedDistrict)) {
          rejected.out_of_scope = (rejected.out_of_scope || 0) + 1;
          continue;
        }
        if (seen.has(candidate._dedupeKey)) {
          rejected.duplicate = (rejected.duplicate || 0) + 1;
          continue;
        }
        seen.add(candidate._dedupeKey);
        added.push(candidate);
        if (baseRestaurants.length + added.length >= TARGET_COUNT) break;
      }
    }
    const prefix = scope.key;
    const restaurants = baseRestaurants.concat(added).map((item, index) => {
      const { _dedupeKey, ...publicItem } = item;
      return { ...publicItem, id: `${prefix}-${String(index + 1).padStart(3, "0")}` };
    });
    const collection = {
      ...base.collection,
      title: `${scope.city.replace(/台(?=中市|南市)/g, "臺")}${scope.district}實體餐廳資料（含愛食記補充資料）`,
      scope: `${base.collection?.scope || `收集地址屬於${scope.district}且有店面的餐廳。`} 再以愛食記公開行政區列表補充可核對地址的店家；偏遠或人口較少行政區若公開資料不足，保留實際可找到的筆數。`,
      status: restaurants.length >= TARGET_COUNT ? "complete" : "partial",
      record_count: restaurants.length,
      source_platform: `${base.collection?.source_platform || ""}; iFoodie public district restaurant lists`.replace(/^; /, ""),
      rating_note: "愛食記補充資料保留列表顯示的評分與評論數；未顯示評分時以 null 與來源說明表示，未自行推估。",
      review_note: "review_summary 僅保存列表可公開解析的評分與評論數說明，未把完整評論全文寫入資料檔。",
      source_list_pages: [...new Set([...(base.collection?.source_list_pages || []), scope.url])],
      collection_stats: {
        ...(base.collection?.collection_stats || {}),
        ifoodie_card_count: scope.card_count || (scope.cards || []).length,
        ifoodie_supplement_added: added.length,
        valid_count: restaurants.length,
      },
    };
    if (SHOULD_WRITE) fs.writeFileSync(file, `${JSON.stringify({ collection, restaurants }, null, 2)}\n`, "utf8");
    summaries.push({ key: scope.key, card_count: scope.card_count || (scope.cards || []).length, added: added.length, rejected, count: restaurants.length, status: collection.status, written: SHOULD_WRITE });
  }
  console.log(JSON.stringify(summaries, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
