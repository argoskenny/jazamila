#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { formatPublicFoodDiarySummary, reviewSummaryToArray } = require("./review-summary-utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const RESTAURANT_DATA_DIR = path.join(ROOT, "docs", "res_data");
const CACHE_DIR = process.env.FONFOOD_CACHE_DIR || "/private/tmp/jazamila-fonfood-cache";
const BASE_URL = "https://www.fonfood.com";
const CITY = "台北市";
const TARGET_COUNT = 200;
const LIST_PAGE_COUNT = 10;
const REQUEST_DELAY_MS = Number(process.env.FONFOOD_REQUEST_DELAY_MS || 300);
const CONCURRENCY = Number(process.env.FONFOOD_CONCURRENCY || 4);
const TODAY = new Date().toISOString().slice(0, 10);

const districts = [
  { name: "中山區", slug: "zhongshan" },
  { name: "中正區", slug: "zhongzheng" },
  { name: "大同區", slug: "datong" },
  { name: "萬華區", slug: "wanhua" },
  { name: "文山區", slug: "wenshan" },
  { name: "南港區", slug: "nangang" },
  { name: "內湖區", slug: "neihu" },
  { name: "士林區", slug: "shilin" },
  { name: "北投區", slug: "beitou" },
  { name: "松山區", slug: "songshan" },
  { name: "信義區", slug: "xinyi" },
  { name: "大安區", slug: "daan" },
];

let nextRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function cleanText(value) {
  return decodeEntities(String(value ?? ""))
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\f\r]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberFrom(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cacheFileFor(url) {
  const digest = crypto.createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, `${digest}.html`);
}

async function fetchPage(url) {
  const cacheFile = cacheFileFor(url);
  try {
    return await fs.readFile(cacheFile, "utf8");
  } catch {
    // Cache miss; fetch below.
  }

  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait > 0) await sleep(wait);
  nextRequestAt = Date.now() + REQUEST_DELAY_MS;

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "JAZAMILA public restaurant data collector/1.0",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      await fs.writeFile(cacheFile, html, "utf8");
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(800 * attempt);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message || lastError}`);
}

async function mapWithConcurrency(items, worker, concurrency = CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function parseRestaurantIds(html) {
  const ids = [];
  for (const match of html.matchAll(/"url"\s*:\s*"https:\/\/www\.fonfood\.com\/store\/(\d+)"/g)) {
    ids.push(match[1]);
  }
  return unique(ids);
}

function extractDistrictCategoryUrls(html, districtName) {
  const prefix = `${BASE_URL}/${CITY}${districtName}/`;
  const urls = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = decodeEntities(match[1]);
    if (!href.startsWith(prefix)) continue;
    const suffix = href.slice(prefix.length);
    if (!suffix || /^\d+$/.test(suffix) || suffix.includes("/")) continue;
    urls.push(href);
  }
  return unique(urls);
}

function parseJsonLdRestaurant(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1].trim());
      const candidates = Array.isArray(value) ? value : [value];
      const restaurant = candidates.find((item) => item && item["@type"] === "Restaurant");
      if (restaurant) return restaurant;
    } catch {
      // Some pages contain non-JSON scripts; continue to the next JSON-LD block.
    }
  }
  return null;
}

function sectionHtml(html, heading) {
  const marker = `<h2 class="sectionTitle">${heading}</h2>`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const remainder = html.slice(start + marker.length);
  const end = remainder.indexOf("</section>");
  return end >= 0 ? remainder.slice(0, end) : remainder.slice(0, 20000);
}

function extractGoogleRating(html) {
  const index = html.indexOf("Google評分");
  if (index < 0) return { score: null, reviewCount: null, sourceSnapshot: "來源頁面未提供 Google 評價快照" };
  const row = html.slice(index, index + 2000);
  const text = cleanText(row);
  const match = text.match(/([0-5](?:\.\d)?)\s*\/\s*([\d,]+)\s*則(?:\s*\(([^)]*)\))?/);
  if (!match) return { score: null, reviewCount: null, sourceSnapshot: "來源頁面未提供可解析的 Google 評價快照" };
  return {
    score: numberFrom(match[1]),
    reviewCount: numberFrom(match[2]),
    sourceSnapshot: match[3] ? `來源頁面標註${cleanText(match[3])}` : "來源頁面未標註快照時間",
  };
}

function extractPriceValues(html) {
  const section = sectionHtml(html, "推薦菜單及價位");
  const priceBlock = section.match(/<div[^>]+class=["']menuPrice["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || section;
  const values = [];
  const pattern = /(?:：|:|NT\$|NT＄|\$)\s*([\d,]+)(?:\s*[-–~～]\s*([\d,]+))?\s*(?:元|\/人|起)?/g;
  for (const match of cleanText(priceBlock).matchAll(pattern)) {
    const first = numberFrom(match[1]);
    const second = match[2] ? numberFrom(match[2]) : null;
    if (first !== null && first >= 10 && first <= 10000) values.push(first);
    if (second !== null && second >= 10 && second <= 10000) values.push(second);
  }
  return unique(values.map(String)).map(Number).sort((a, b) => a - b);
}

function estimatePriceRange(values, cuisineTypes, intro) {
  const tags = [...cuisineTypes, intro].join(" ");
  if (values.length > 0) {
    const usable = values.filter((value) => value >= 30);
    const source = usable.length ? usable : values;
    const min = source[0];
    const max = source[source.length - 1];
    return {
      min,
      max,
      display: min === max ? `約 NT$${min}/人` : `約 NT$${min}–${max}/人`,
      basis: "依公開頁面推薦菜單價位區間估算；實際以店家最新菜單為準",
    };
  }

  let min = 200;
  let max = 800;
  if (/(吃到飽|buffet)/i.test(tags)) {
    min = 400;
    max = 1500;
  } else if (/(米其林|無菜單|高級|fine dining|牛排)/i.test(tags)) {
    min = 800;
    max = 2500;
  } else if (/(小吃|早餐|咖啡|甜點|蛋糕|麵|便當|平價|輕食)/i.test(tags)) {
    min = 80;
    max = 400;
  }
  return {
    min,
    max,
    display: `約 NT$${min}–${max}/人`,
    basis: "公開頁面未列出可解析的完整價位，依料理分類與餐點定位估算；實際以店家最新菜單為準",
  };
}

function extractCuisineTypes(html, restaurantLd) {
  const cuisines = [];
  for (const match of html.matchAll(/<span[^>]+class=["'][^"']*food-style[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)) {
    const value = cleanText(match[1]);
    if (value) cuisines.push(value);
  }
  if (cuisines.length === 0 && restaurantLd?.servesCuisine) {
    if (Array.isArray(restaurantLd.servesCuisine)) cuisines.push(...restaurantLd.servesCuisine);
    else cuisines.push(String(restaurantLd.servesCuisine));
  }
  if (cuisines.length === 0) {
    const keywordText = cleanText(html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i)?.[1] || "");
    const keywordCuisineMap = [
      ["台式", "台式料理"], ["中式", "中式料理"], ["日式", "日式料理"], ["韓式", "韓式料理"],
      ["泰式", "泰式料理"], ["港式", "港式料理"], ["粵菜", "粵菜"], ["川菜", "川菜"],
      ["義式", "義式料理"], ["義大利麵", "義式料理"], ["美式", "美式料理"], ["法式", "法式料理"],
      ["印度", "印度料理"], ["越式", "越式料理"], ["火鍋", "火鍋"], ["燒肉", "燒肉"],
      ["海鮮", "海鮮料理"], ["牛排", "牛排"], ["小吃", "小吃"], ["咖啡", "咖啡"],
      ["café", "咖啡"], ["cafe", "咖啡"], ["甜點", "甜點"], ["蛋糕", "甜點"], ["麵包", "麵包"],
      ["早午餐", "早午餐"], ["早餐", "早餐"], ["早點", "早餐"], ["下午茶", "下午茶"], ["漢堡", "漢堡"],
      ["披薩", "披薩"], ["拉麵", "拉麵"], ["素食", "素食"], ["冰品", "冰品"], ["便當", "便當"],
      ["牛肉麵", "牛肉麵"], ["居酒屋", "居酒屋"], ["壽司", "壽司"], ["燒烤", "燒烤"],
      ["餐酒館", "餐酒館"], ["無菜單", "無菜單料理"], ["吃到飽", "吃到飽"], ["紅茶", "茶飲"], ["茶飲", "茶飲"],
    ];
    for (const [needle, label] of keywordCuisineMap) {
      if (keywordText.toLowerCase().includes(needle.toLowerCase())) cuisines.push(label);
    }
  }
  return unique(cuisines);
}

function extractPopularFoods(html) {
  const block = html.match(/<div class="foodNameBlock">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] || "";
  const foods = [];
  for (const match of block.matchAll(/<span[^>]+class=["'][^"']*item[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)) {
    const food = cleanText(match[1]).replace(/^\d+\.\s*/, "");
    if (food) foods.push(food);
  }
  return unique(foods);
}

function extractFoodDiaryCount(html) {
  const match = html.match(/href=["']https:\/\/www\.fonfood\.com\/store\/\d+\/post["'][^>]*>\s*食記\(([^)]+)\)/i);
  if (!match) return null;
  return numberFrom(match[1]);
}

function extractReviewExcerpt(html) {
  const match = html.match(/<div class="summary">([\s\S]*?)<\/div>/i);
  if (!match) return "";
  const summary = cleanText(match[1]).replace(/\(詳全文\)$/, "");
  return summary.length > 100 ? `${summary.slice(0, 100)}…` : summary;
}

function parseStore(id, html, district) {
  const restaurantLd = parseJsonLdRestaurant(html);
  const street = restaurantLd?.address?.streetAddress ? cleanText(restaurantLd.address.streetAddress) : "";
  const city = restaurantLd?.address?.addressRegion ? cleanText(restaurantLd.address.addressRegion) : CITY;
  const locality = restaurantLd?.address?.addressLocality ? cleanText(restaurantLd.address.addressLocality) : district.name;
  const address = [city, locality, street].filter(Boolean).join("");
  const name = restaurantLd?.name ? cleanText(restaurantLd.name) : cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const phone = restaurantLd?.telephone
    ? cleanText(restaurantLd.telephone)
    : cleanText(html.match(/href=["']tel:[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || "");
  const cuisineTypes = extractCuisineTypes(html, restaurantLd);
  const intro = cleanText(sectionHtml(html, "簡介"));
  const popularFoods = extractPopularFoods(html);
  const google = extractGoogleRating(html);
  const foodDiaryCount = extractFoodDiaryCount(html);
  const reviewExcerpt = extractReviewExcerpt(html);
  const priceRange = estimatePriceRange(extractPriceValues(html), cuisineTypes, intro);
  const hasClosedMarker = /(已歇業|暫停營業|永久歇業|永久關閉|停業中)/i.test(cleanText(html));
  const districtMatches = address.includes(district.name) || locality === district.name;

  const reviewSummary = reviewExcerpt
    ? formatPublicFoodDiarySummary(reviewExcerpt)
    : reviewSummaryToArray(`${foodDiaryCount === null ? "公開頁面未標示食記篇數" : `公開頁面列有 ${foodDiaryCount.toLocaleString("zh-TW")} 篇食記`}${popularFoods.length ? `；熱門餐點包括${popularFoods.slice(0, 3).join("、")}` : ""}。`);

  return {
    id: `${district.slug}-${id}`,
    source_id: id,
    name,
    address,
    phone,
    physical_store: Boolean(address),
    price_range_twd_per_person: priceRange,
    cuisine_types: cuisineTypes,
    online_rating: {
      platform: "Google",
      score: google.score,
      review_count: google.reviewCount,
      source_snapshot: google.sourceSnapshot,
      food_diary_count: foodDiaryCount,
      review_summary: reviewSummary,
    },
    store_status_check: hasClosedMarker
      ? "公開頁面出現歇業或停業標記，未納入完成清單。"
      : "公開店家頁面列有店址，未發現歇業或停業標記；出發前仍建議確認當日營業。",
    sources: [`${BASE_URL}/store/${id}`],
    _valid: Boolean(name && address && phone && cuisineTypes.length > 0 && google.score !== null && google.reviewCount !== null && districtMatches && !hasClosedMarker),
    _dedupeKey: `${name}||${address}`.replace(/\s+/g, "").toLowerCase(),
  };
}

function removeInternalFields(store) {
  const { _valid, _dedupeKey, ...publicStore } = store;
  return publicStore;
}

function outputFile(district) {
  return path.join(RESTAURANT_DATA_DIR, `taipei-${district.slug}-restaurants.json`);
}

async function collectCandidateIds(district) {
  const urls = [
    `${BASE_URL}/${CITY}${district.name}`,
    ...Array.from({ length: LIST_PAGE_COUNT - 1 }, (_, index) => `${BASE_URL}/${CITY}${district.name}/${index + 2}`),
  ];
  const pages = await mapWithConcurrency(urls, async (url) => fetchPage(url));
  const ids = unique(pages.flatMap(parseRestaurantIds));
  return { ids, firstPageHtml: pages[0], categoryUrls: extractDistrictCategoryUrls(pages[0], district.name) };
}

async function collectSupplementIds(district, categoryUrls, existingIds) {
  const collected = [...existingIds];
  const seen = new Set(collected);
  for (const categoryUrl of categoryUrls) {
    if (collected.length >= TARGET_COUNT + 200) break;
    const urls = [categoryUrl, ...Array.from({ length: LIST_PAGE_COUNT - 1 }, (_, index) => `${categoryUrl}/${index + 2}`)];
    const pages = await mapWithConcurrency(urls, async (url) => fetchPage(url));
    for (const id of pages.flatMap(parseRestaurantIds)) {
      if (!seen.has(id)) {
        seen.add(id);
        collected.push(id);
      }
    }
  }
  return collected;
}

async function parseStores(ids, district) {
  let completed = 0;
  const parsed = await mapWithConcurrency(ids, async (id) => {
    const url = `${BASE_URL}/store/${id}`;
    try {
      const html = await fetchPage(url);
      return parseStore(id, html, district);
    } catch (error) {
      console.warn(`[${district.name}] failed store ${id}: ${error.message}`);
      return null;
    } finally {
      completed += 1;
      if (completed % 25 === 0 || completed === ids.length) {
        console.log(`[${district.name}] detail pages ${completed}/${ids.length}`);
      }
    }
  });
  return parsed.filter(Boolean);
}

function selectValidStores(stores) {
  const selected = [];
  const seen = new Set();
  for (const store of stores) {
    if (!store._valid || seen.has(store._dedupeKey)) continue;
    seen.add(store._dedupeKey);
    selected.push(store);
    if (selected.length === TARGET_COUNT) break;
  }
  return selected;
}

async function collectDistrict(district) {
  console.log(`\n[${district.name}] collecting district list pages`);
  const { ids, categoryUrls } = await collectCandidateIds(district);
  console.log(`[${district.name}] list candidates: ${ids.length}; categories: ${categoryUrls.length}`);

  let stores = await parseStores(ids, district);
  let selected = selectValidStores(stores);
  if (selected.length < TARGET_COUNT) {
    console.log(`[${district.name}] valid stores after first pass: ${selected.length}; collecting category supplements`);
    const supplementIds = await collectSupplementIds(district, categoryUrls, ids);
    const missingIds = supplementIds.filter((id) => !ids.includes(id));
    stores = stores.concat(await parseStores(missingIds, district));
    selected = selectValidStores(stores);
  }

  if (selected.length < TARGET_COUNT) {
    throw new Error(`[${district.name}] only ${selected.length} valid stores found; refusing to write a short file`);
  }

  const restaurants = selected.slice(0, TARGET_COUNT).map(removeInternalFields).map((store, index) => ({
    ...store,
    id: `${district.slug}-${String(index + 1).padStart(3, "0")}`,
  }));
  const document = {
    collection: {
      title: `台北市${district.name}實體餐廳資料`,
      city: CITY,
      district: district.name,
      scope: `從 FonFood「${CITY}${district.name}－美食餐廳」公開列表第 1–10 頁取得候選店家，再逐頁核對店家地址、電話、料理分類、Google 評價快照、推薦菜單價位與食記摘要；僅保留地址屬於${district.name}且未見歇業標記的有店面店家。`,
      collected_at: TODAY,
      status: "complete",
      target_count: TARGET_COUNT,
      source_platform: "FonFood public restaurant pages; Google rating snapshots embedded by FonFood",
      rating_note: "Google 評分與評論數是各店家來源頁面抓取到的快照；每筆保留來源頁面標示的相對時間，不能視為目前即時數值。",
    review_note: "review_summary 是來源頁面公開食記摘要整理成的短段落，或依頁面食記數量與熱門餐點生成的說明；未把完整評論全文寫入資料檔。",
      price_note: "價位是每人約略消費範圍（新台幣）；優先取公開推薦菜單的價位區間，沒有可解析價格時依料理分類與餐點定位估算，實際仍以店家最新菜單為準。",
      dedupe_rule: "以店名加地址作為唯一鍵；同品牌不同地址視為不同實體門市，同一地址不重複收錄。",
      source_list_pages: [
        `${BASE_URL}/${CITY}${district.name}`,
        ...Array.from({ length: LIST_PAGE_COUNT - 1 }, (_, index) => `${BASE_URL}/${CITY}${district.name}/${index + 2}`),
      ],
    },
    restaurants,
  };
  await fs.writeFile(outputFile(district), `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`[${district.name}] wrote ${restaurants.length} restaurants -> ${path.relative(ROOT, outputFile(district))}`);
}

async function main() {
  await fs.mkdir(RESTAURANT_DATA_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  for (const district of districts) {
    await collectDistrict(district);
  }
  console.log("\nAll districts complete.");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
