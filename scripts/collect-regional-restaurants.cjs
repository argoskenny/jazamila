#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { formatPublicFoodDiarySummary, reviewSummaryToArray } = require("./review-summary-utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const RESTAURANT_DATA_DIR = path.join(ROOT, "docs", "res_data");
const CACHE_DIR = process.env.FONFOOD_CACHE_DIR || "/private/tmp/jazamila-fonfood-cache";
const BASE_URL = "https://www.fonfood.com";
const TARGET_COUNT = Number(process.env.FONFOOD_TARGET_COUNT || 200);
const MAX_LIST_PAGES = Number(process.env.FONFOOD_MAX_LIST_PAGES || 20);
const MAX_CITY_LIST_PAGES = Number(process.env.FONFOOD_MAX_CITY_LIST_PAGES || 20);
const MAX_CATEGORY_PAGES = Number(process.env.FONFOOD_MAX_CATEGORY_PAGES || 10);
const MAX_CATEGORY_URLS = Number(process.env.FONFOOD_MAX_CATEGORY_URLS || 80);
const REQUEST_DELAY_MS = Number(process.env.FONFOOD_REQUEST_DELAY_MS || 180);
const CONCURRENCY = Number(process.env.FONFOOD_CONCURRENCY || 8);
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

const cityGroups = [
  {
    key: "newtaipei",
    label: "新北市",
    urlCity: "新北市",
    filePrefix: "newtaipei",
    districts: [
      ["板橋區", "banqiao"], ["三重區", "sanchong"], ["中和區", "zhonghe"], ["永和區", "yonghe"],
      ["新莊區", "xinzhuang"], ["新店區", "xindian"], ["土城區", "tucheng"], ["蘆洲區", "luzhou"],
      ["樹林區", "shulin"], ["汐止區", "xizhi"], ["鶯歌區", "yingge"], ["三峽區", "sanxia"],
      ["淡水區", "tamsui"], ["瑞芳區", "ruifang"], ["五股區", "wugu"], ["泰山區", "taishan"],
      ["林口區", "linkou"], ["深坑區", "shenkeng"], ["石碇區", "shiding"], ["坪林區", "pinglin"],
      ["三芝區", "sanzhi"], ["石門區", "shimen"], ["八里區", "bali"], ["平溪區", "pingxi"],
      ["雙溪區", "shuangxi"], ["貢寮區", "gongliao"], ["金山區", "jinshan"], ["萬里區", "wanli"], ["烏來區", "wulai"],
    ],
  },
  {
    key: "taoyuan",
    label: "桃園市",
    urlCity: "桃園市",
    filePrefix: "taoyuan",
    districts: [
      ["桃園區", "taoyuan"], ["中壢區", "zhongli"], ["平鎮區", "pingzhen"], ["八德區", "bade"],
      ["楊梅區", "yangmei"], ["蘆竹區", "luzhu"], ["大溪區", "daxi"], ["龜山區", "guishan"],
      ["大園區", "dayuan"], ["觀音區", "guanyin"], ["新屋區", "xinwu"], ["龍潭區", "longtan"], ["復興區", "fuxing"],
    ],
  },
  {
    key: "taichung",
    label: "臺中市",
    urlCity: "台中市",
    filePrefix: "taichung",
    districts: [
      ["中區", "zhong"], ["東區", "dong"], ["南區", "nan"], ["西區", "xi"], ["北區", "bei"],
      ["西屯區", "xitun"], ["南屯區", "nantun"], ["北屯區", "beitun"], ["豐原區", "fengyuan"], ["東勢區", "dongshi"],
      ["大甲區", "dajia"], ["清水區", "qingshui"], ["沙鹿區", "shalu"], ["梧棲區", "wuqi"], ["后里區", "houli"],
      ["神岡區", "shengang"], ["潭子區", "tanzi"], ["大雅區", "daya"], ["新社區", "xinshe"], ["石岡區", "shigang"],
      ["外埔區", "waipu"], ["大安區", "daan"], ["烏日區", "wuri"], ["大肚區", "dadu"], ["龍井區", "longjing"],
      ["霧峰區", "wufeng"], ["太平區", "taiping"], ["大里區", "dali"], ["和平區", "heping"],
    ],
  },
  {
    key: "tainan",
    label: "臺南市",
    urlCity: "台南市",
    filePrefix: "tainan",
    districts: [
      ["中西區", "zhongxi"], ["東區", "dong"], ["南區", "nan"], ["北區", "bei"], ["安平區", "anping"],
      ["安南區", "annan"], ["永康區", "yongkang"], ["歸仁區", "guiren"], ["新化區", "xinhua"], ["左鎮區", "zuozhen"],
      ["玉井區", "yujing"], ["楠西區", "nanxi"], ["南化區", "nanhua"], ["仁德區", "rende"], ["關廟區", "guanmiao"],
      ["龍崎區", "longqi"], ["官田區", "guantian"], ["麻豆區", "madou"], ["佳里區", "jiali"], ["西港區", "xigang"],
      ["七股區", "qigu"], ["將軍區", "jiangjun"], ["學甲區", "xuejia"], ["北門區", "beimen"], ["新營區", "xinying"],
      ["後壁區", "houbi"], ["白河區", "baihe"], ["東山區", "dongshan"], ["六甲區", "liujia"], ["下營區", "xiaying"],
      ["柳營區", "liuying"], ["鹽水區", "yanshui"], ["善化區", "shanhua"], ["大內區", "danei"], ["山上區", "shanshang"],
      ["新市區", "xinshi"], ["安定區", "anding"],
    ],
  },
  {
    key: "kaohsiung",
    label: "高雄市",
    urlCity: "高雄市",
    filePrefix: "kaohsiung",
    districts: [
      ["楠梓區", "nanzi"], ["左營區", "zuoying"], ["鼓山區", "gushan"], ["三民區", "sanmin"], ["鹽埕區", "yancheng"],
      ["前金區", "qianjin"], ["新興區", "xinxing"], ["苓雅區", "lingya"], ["前鎮區", "qianzhen"], ["旗津區", "qijin"],
      ["小港區", "xiaogang"], ["鳳山區", "fengshan"], ["林園區", "linyuan"], ["大寮區", "daliao"], ["大樹區", "dashu"],
      ["大社區", "dashe"], ["仁武區", "renwu"], ["鳥松區", "niaosong"], ["岡山區", "gangshan"], ["橋頭區", "qiaotou"],
      ["燕巢區", "yanchao"], ["田寮區", "tianliao"], ["阿蓮區", "alian"], ["路竹區", "luzhu"], ["湖內區", "hunei"],
      ["茄萣區", "qieding"], ["永安區", "yongan"], ["彌陀區", "mituo"], ["梓官區", "ziguan"], ["旗山區", "qishan"],
      ["美濃區", "meinong"], ["六龜區", "liugui"], ["甲仙區", "jiaxian"], ["杉林區", "shanlin"], ["內門區", "neimen"],
      ["茂林區", "maolin"], ["桃源區", "taoyuan"], ["那瑪夏區", "namaxia"],
    ],
  },
  {
    key: "keelung",
    label: "基隆市",
    urlCity: "基隆市",
    filePrefix: "keelung",
    districts: [
      ["仁愛區", "renai"], ["信義區", "xinyi"], ["中正區", "zhongzheng"], ["中山區", "zhongshan"],
      ["安樂區", "anle"], ["暖暖區", "nuannuan"], ["七堵區", "qidu"],
    ],
  },
  {
    key: "hsinchu-city",
    label: "新竹市",
    urlCity: "新竹市",
    filePrefix: "hsinchu-city",
    districts: [["東區", "dong"], ["北區", "bei"], ["香山區", "xiangshan"]],
  },
  {
    key: "chiayi-city",
    label: "嘉義市",
    urlCity: "嘉義市",
    filePrefix: "chiayi-city",
    districts: [["東區", "dong"], ["西區", "xi"]],
  },
].map((group) => ({
  ...group,
  districts: group.districts.map(([name, slug]) => ({ name, slug })),
}));

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
    .replace(/<br\s*\/?\s*>/gi, "\n")
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
  for (const match of html.matchAll(/(?:https?:)?\/\/www\.fonfood\.com\/store\/(\d+)/g)) ids.push(match[1]);
  return unique(ids);
}

function extractDistrictCategoryUrls(html, district, city) {
  const prefixes = [
    `${BASE_URL}/${city.urlCity}${district.name}/`,
    `${BASE_URL}/${encodeURIComponent(city.urlCity + district.name)}/`,
  ];
  const urls = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = decodeEntities(match[1]);
    const prefix = prefixes.find((candidate) => href.startsWith(candidate));
    if (!prefix) continue;
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
      const restaurant = candidates.find((item) => {
        const types = Array.isArray(item?.["@type"]) ? item["@type"] : [item?.["@type"]];
        return types.includes("Restaurant");
      });
      if (restaurant) return restaurant;
    } catch {
      // Continue through malformed JSON-LD blocks.
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
  const text = cleanText(html.slice(index, index + 2000));
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
  if (cuisines.length === 0) cuisines.push("其他餐飲");
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
  return match ? numberFrom(match[1]) : null;
}

function extractReviewExcerpt(html) {
  const match = html.match(/<div class="summary">([\s\S]*?)<\/div>/i);
  if (!match) return "";
  const summary = cleanText(match[1]).replace(/\(詳全文\)$/, "");
  return summary.length > 100 ? `${summary.slice(0, 100)}…` : summary;
}

function parseStore(id, html, district, city) {
  const restaurantLd = parseJsonLdRestaurant(html);
  const street = restaurantLd?.address?.streetAddress ? cleanText(restaurantLd.address.streetAddress) : "";
  const sourceCity = restaurantLd?.address?.addressRegion ? cleanText(restaurantLd.address.addressRegion) : city.urlCity;
  const locality = restaurantLd?.address?.addressLocality ? cleanText(restaurantLd.address.addressLocality) : district.name;
  const address = [sourceCity, locality, street].filter(Boolean).join("");
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
  const normalizedAddress = address.replace(/台(?=中市|南市)/g, "臺");
  const normalizedCity = city.label.replace(/台(?=中市|南市)/g, "臺");
  const districtMatches = normalizedAddress.includes(normalizedCity)
    && (normalizedAddress.includes(district.name) || locality === district.name);
  const reviewSummary = reviewExcerpt
    ? formatPublicFoodDiarySummary(reviewExcerpt)
    : reviewSummaryToArray(`${foodDiaryCount === null ? "公開頁面未標示食記篇數" : `公開頁面列有 ${foodDiaryCount.toLocaleString("zh-TW")} 篇食記`}${popularFoods.length ? `；熱門餐點包括${popularFoods.slice(0, 3).join("、")}` : ""}。`);
  const invalidReasons = [];
  if (!name) invalidReasons.push("name");
  if (!address) invalidReasons.push("address");
  if (!phone) invalidReasons.push("phone");
  if (cuisineTypes.length === 0) invalidReasons.push("cuisine");
  if (google.score === null || google.reviewCount === null) invalidReasons.push("rating");
  if (!districtMatches) invalidReasons.push("district");
  if (hasClosedMarker) invalidReasons.push("closed");

  return {
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
    _valid: invalidReasons.length === 0,
    _invalidReasons: invalidReasons,
    _dedupeKey: `${name}||${address}`.replace(/\s+/g, "").toLowerCase(),
  };
}

function publicStore(store, city, district, index) {
  const { _valid, _invalidReasons, _dedupeKey, ...rest } = store;
  return { ...rest, id: `${city.filePrefix}-${district.slug}-${String(index + 1).padStart(3, "0")}` };
}

function selectValidStores(stores) {
  const selected = [];
  const seen = new Set();
  for (const store of stores) {
    if (!store?._valid || seen.has(store._dedupeKey)) continue;
    seen.add(store._dedupeKey);
    selected.push(store);
    if (selected.length === TARGET_COUNT) break;
  }
  return selected;
}

function listPageUrl(city, district, page) {
  const base = `${BASE_URL}/${city.urlCity}${district.name}`;
  return page === 1 ? base : `${base}/${page}`;
}

function cityListPageUrl(city, page) {
  const base = `${BASE_URL}/${city.urlCity}`;
  return page === 1 ? base : `${base}/${page}`;
}

async function parseNewStores(ids, parsedStores, parsedIds, city, district) {
  const newIds = ids.filter((id) => !parsedIds.has(id));
  newIds.forEach((id) => parsedIds.add(id));
  if (newIds.length === 0) return;
  let completed = 0;
  const stores = await mapWithConcurrency(newIds, async (id) => {
    try {
      return parseStore(id, await fetchPage(`${BASE_URL}/store/${id}`), district, city);
    } catch (error) {
      console.warn(`[${city.label}${district.name}] failed store ${id}: ${error.message}`);
      return null;
    } finally {
      completed += 1;
      if (completed % 25 === 0 || completed === newIds.length) {
        console.log(`[${city.label}${district.name}] detail pages ${completed}/${newIds.length}`);
      }
    }
  });
  parsedStores.push(...stores.filter(Boolean));
}

async function writeDistrict(city, district, selected, sourceListPages, categoryUrls, stats) {
  const restaurants = selected.map((store, index) => publicStore(store, city, district, index));
  const sourcePages = unique(sourceListPages.concat(categoryUrls));
  const document = {
    collection: {
      title: `${city.label}${district.name}實體餐廳資料`,
      city: city.label,
      district: district.name,
      scope: `從 FonFood「${city.urlCity}${district.name}－美食餐廳」公開列表與料理分類頁取得候選店家，再逐頁核對店家地址、電話、料理分類、Google 評價快照、推薦菜單價位與食記摘要；僅保留地址屬於${district.name}且未見歇業標記的有店面店家。`,
      collected_at: TODAY,
      status: restaurants.length === TARGET_COUNT ? "complete" : "partial",
      target_count: TARGET_COUNT,
      record_count: restaurants.length,
      source_platform: "FonFood public restaurant pages; Google rating snapshots embedded by FonFood",
      rating_note: "Google 評分與評論數是各店家來源頁面抓取到的快照；每筆保留來源頁面標示的相對時間，不能視為目前即時數值。",
      review_note: "review_summary 是來源頁面公開食記摘要整理成的短段落，或依頁面食記數量與熱門餐點生成的說明；未把完整評論全文寫入資料檔。",
      price_note: "價位是每人約略消費範圍（新台幣）；優先取公開推薦菜單的價位區間，沒有可解析價格時依料理分類與餐點定位估算，實際仍以店家最新菜單為準。",
      dedupe_rule: "以店名加地址作為唯一鍵；同品牌不同地址視為不同實體門市，同一地址不重複收錄。",
      source_list_pages: sourcePages,
      collection_stats: stats,
    },
    restaurants,
  };
  const output = path.join(RESTAURANT_DATA_DIR, `${city.filePrefix}-${district.slug}-restaurants.json`);
  await fs.writeFile(output, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return output;
}

async function collectDistrict(city, district) {
  const label = `${city.label}${district.name}`;
  const output = path.join(RESTAURANT_DATA_DIR, `${city.filePrefix}-${district.slug}-restaurants.json`);
  try {
    const existing = JSON.parse(await fs.readFile(output, "utf8"));
    if (existing.collection?.status === "complete" && existing.restaurants?.length >= TARGET_COUNT) {
      console.log(`[${label}] already complete (${existing.restaurants.length}), skip`);
      return { status: "skipped", count: existing.restaurants.length, output };
    }
  } catch {
    // No complete output yet.
  }

  console.log(`\n[${label}] collecting list pages`);
  const parsedStores = [];
  const parsedIds = new Set();
  const candidateIds = new Set();
  const sourceListPages = [];
  const categoryUrls = new Set();
  let selected = [];
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_LIST_PAGES && selected.length < TARGET_COUNT; page += 1) {
    const url = listPageUrl(city, district, page);
    let html;
    try {
      html = await fetchPage(url);
    } catch (error) {
      console.warn(`[${label}] list page ${page} failed: ${error.message}`);
      break;
    }
    pagesFetched += 1;
    sourceListPages.push(url);
    extractDistrictCategoryUrls(html, district, city).forEach((item) => categoryUrls.add(item));
    const ids = parseRestaurantIds(html);
    const previousCount = candidateIds.size;
    ids.forEach((id) => candidateIds.add(id));
    const newIds = [...candidateIds].filter((id) => !parsedIds.has(id));
    console.log(`[${label}] list page ${page}: ${ids.length} ids, ${candidateIds.size} unique candidates`);
    await parseNewStores(newIds, parsedStores, parsedIds, city, district);
    selected = selectValidStores(parsedStores);
    console.log(`[${label}] valid unique stores: ${selected.length}/${TARGET_COUNT}`);
    if (ids.length === 0 || candidateIds.size === previousCount) break;
  }

  let cityListPagesFetched = 0;
  if (selected.length < TARGET_COUNT) {
    console.log(`[${label}] district lists yielded ${selected.length}; checking up to ${MAX_CITY_LIST_PAGES} city-wide list pages`);
    let stagnantCityPages = 0;
    for (let page = 1; page <= MAX_CITY_LIST_PAGES && selected.length < TARGET_COUNT; page += 1) {
      const url = cityListPageUrl(city, page);
      let html;
      try {
        html = await fetchPage(url);
      } catch (error) {
        console.warn(`[${label}] city-wide list page ${page} failed: ${error.message}`);
        break;
      }
      cityListPagesFetched += 1;
      sourceListPages.push(url);
      const ids = parseRestaurantIds(html);
      const previousCount = candidateIds.size;
      ids.forEach((id) => candidateIds.add(id));
      const newIds = [...candidateIds].filter((id) => !parsedIds.has(id));
      await parseNewStores(newIds, parsedStores, parsedIds, city, district);
      const previousValidCount = selected.length;
      selected = selectValidStores(parsedStores);
      stagnantCityPages = selected.length === previousValidCount ? stagnantCityPages + 1 : 0;
      console.log(`[${label}] city-wide page ${page}: ${ids.length} ids, ${selected.length}/${TARGET_COUNT} valid stores`);
      if (ids.length === 0 || candidateIds.size === previousCount || stagnantCityPages >= 5) break;
    }
  }

  let categoryPagesFetched = 0;
  if (selected.length < TARGET_COUNT) {
    const categories = [...categoryUrls].slice(0, MAX_CATEGORY_URLS);
    console.log(`[${label}] list pages yielded ${selected.length}; checking up to ${categories.length} category pages`);
    let stagnantCategories = 0;
    for (const categoryUrl of categories) {
      const categoryStartCandidateCount = candidateIds.size;
      for (let page = 1; page <= MAX_CATEGORY_PAGES && selected.length < TARGET_COUNT; page += 1) {
        const url = page === 1 ? categoryUrl : `${categoryUrl}/${page}`;
        let html;
        try {
          html = await fetchPage(url);
        } catch (error) {
          console.warn(`[${label}] category page failed: ${error.message}`);
          break;
        }
        categoryPagesFetched += 1;
        const ids = parseRestaurantIds(html);
        const previousCount = candidateIds.size;
        ids.forEach((id) => candidateIds.add(id));
        const newIds = [...candidateIds].filter((id) => !parsedIds.has(id));
        await parseNewStores(newIds, parsedStores, parsedIds, city, district);
        selected = selectValidStores(parsedStores);
        console.log(`[${label}] category ${categoryPagesFetched}: ${selected.length}/${TARGET_COUNT}`);
        if (ids.length === 0 || candidateIds.size === previousCount) break;
      }
      if (candidateIds.size === categoryStartCandidateCount) stagnantCategories += 1;
      else stagnantCategories = 0;
      if (stagnantCategories >= 3) break;
    }
  }

  const stats = {
    list_pages_fetched: pagesFetched,
    city_list_pages_fetched: cityListPagesFetched,
    category_pages_fetched: categoryPagesFetched,
    candidate_count: candidateIds.size,
    detail_pages_parsed: parsedStores.length,
    valid_count: selected.length,
  };
  if (selected.length < TARGET_COUNT) {
    const invalidReasons = {};
    for (const store of parsedStores) {
      for (const reason of store._invalidReasons || []) invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
    }
    stats.invalid_reason_counts = invalidReasons;
    console.log(`[${label}] invalid reason counts: ${JSON.stringify(invalidReasons)}`);
  }
  if (selected.length < TARGET_COUNT) {
    if (process.env.FONFOOD_WRITE_PARTIAL === "1") {
      const written = await writeDistrict(city, district, selected, sourceListPages, [...categoryUrls], stats);
      console.warn(`[${label}] wrote partial ${selected.length}/${TARGET_COUNT} restaurants -> ${path.relative(ROOT, written)}`);
      return { status: "partial", count: selected.length, output: written, stats };
    }
    throw new Error(`[${label}] only ${selected.length} valid stores found after ${candidateIds.size} candidates; refusing to write a short file`);
  }
  const written = await writeDistrict(city, district, selected, sourceListPages, [...categoryUrls], stats);
  console.log(`[${label}] wrote ${selected.length} restaurants -> ${path.relative(ROOT, written)}`);
  return { status: "complete", count: selected.length, output: written, stats };
}

function selectedGroups() {
  const requested = process.env.REGIONAL_CITY
    ? [process.env.REGIONAL_CITY]
    : process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  if (requested.length === 0) return cityGroups;
  const keys = new Set(requested.flatMap((value) => value.split(",").map((item) => item.trim()).filter(Boolean)));
  const groups = cityGroups.filter((group) => keys.has(group.key));
  if (groups.length !== keys.size) {
    const available = cityGroups.map((group) => group.key).join(", ");
    throw new Error(`Unknown REGIONAL_CITY. Available: ${available}`);
  }
  return groups;
}

async function main() {
  await fs.mkdir(RESTAURANT_DATA_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const results = [];
  const requestedDistrict = process.env.REGIONAL_DISTRICT;
  for (const city of selectedGroups()) {
    const districts = requestedDistrict
      ? city.districts.filter((district) => district.slug === requestedDistrict || district.name === requestedDistrict)
      : city.districts;
    if (requestedDistrict && districts.length === 0) {
      throw new Error(`Unknown REGIONAL_DISTRICT for ${city.key}: ${requestedDistrict}`);
    }
    console.log(`\n===== ${city.label} (${city.districts.length} districts) =====`);
    for (const district of districts) {
      try {
        results.push({ city: city.label, district: district.name, ...(await collectDistrict(city, district)) });
      } catch (error) {
        console.error(`[${city.label}${district.name}] FAILED: ${error.message}`);
        results.push({ city: city.label, district: district.name, status: "failed", error: error.message });
      }
    }
  }
  const completed = results.filter((result) => result.status === "complete" || result.status === "skipped");
  const failed = results.filter((result) => result.status === "failed");
  console.log(`\nRegional collection summary: ${completed.length} complete/skipped, ${failed.length} failed`);
  for (const result of results) console.log(`${result.city}${result.district}: ${result.status}${result.count ? ` (${result.count})` : ""}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
