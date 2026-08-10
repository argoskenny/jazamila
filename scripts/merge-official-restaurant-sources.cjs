#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { reviewSummaryToArray } = require("./review-summary-utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const RESTAURANT_DATA_DIR = path.join(ROOT, "docs", "res_data");
const POSITIONAL_ARGS = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const TOURISM_PATH = POSITIONAL_ARGS[0] || "/private/tmp/jazamila-tourism/RestaurantList.json";
const FDA_PATH = POSITIONAL_ARGS[1] || "/private/tmp/jazamila-food/97_5.json";
const BUSINESS_PATH = POSITIONAL_ARGS[2] || "/private/tmp/jazamila-business-restaurants.csv";
const TAX_PATH = POSITIONAL_ARGS[3] || "/private/tmp/jazamila-tax/BGMOPEN1.csv";
const TARGET_COUNT = Number(process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || 200);
const SHOULD_WRITE = process.argv.includes("--write");
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

const SOURCE_URLS = {
  tourism: [
    "https://data.gov.tw/dataset/7779",
    "https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Restaurant-json.zip",
  ],
  fda: [
    "https://data.gov.tw/dataset/8938",
    "https://data.fda.gov.tw/data/opendata/export/97/json",
  ],
  business: [
    "https://data.gov.tw/dataset/108355",
    "https://data.gcis.nat.gov.tw/od/file?oid=D6F37400-1426-4C06-B330-2E344F3F73AB",
  ],
  tax: [
    "https://data.gov.tw/dataset/9400",
    "https://eip.fia.gov.tw/data/BGMOPEN1.zip",
  ],
};

const TAX_RESTAURANT_INDUSTRIES = new Map([
  ["561111", "早餐店"],
  ["561112", "便當、自助餐店"],
  ["561113", "麵店、小吃店"],
  ["561114", "連鎖速食店"],
  ["561115", "餐廳"],
  ["561116", "有娛樂節目餐廳"],
  ["561117", "吃到飽餐廳"],
  ["563112", "咖啡館"],
  ["563113", "茶館"],
  ["563114", "飲酒店"],
  ["563115", "手搖飲店"],
  ["563119", "其他飲料店"],
  ["563199", "其他飲料店"],
]);

const CITY_ALIASES = new Map([
  ["台中市", "臺中市"],
  ["台南市", "臺南市"],
  ["台中", "臺中市"],
  ["台南", "臺南市"],
]);

function canonicalCity(value) {
  const text = String(value || "").trim();
  return CITY_ALIASES.get(text) || text.replace(/^台(?=中市|南市)/, "臺");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/台(?=中市|南市)/g, "臺")
    .toLowerCase()
    .replace(/[\s\u3000，,。．.、:：;；/\\()（）【】「」『』'"“”‘’《》<>\-—_]/g, "");
}

function clean(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function dedupeKey(name, address) {
  return `${normalize(name)}||${normalize(address)}`;
}

function cityDistrictMatch(address, city, district) {
  const canonicalAddress = clean(address).replace(/台(?=中市|南市)/g, "臺");
  return canonicalAddress.includes(city) && canonicalAddress.includes(district);
}

function fullAddress(city, district, streetAddress) {
  const street = clean(streetAddress);
  if (!street) return "";
  const prefix = `${city}${district}`;
  if (street.includes(city) && street.includes(district)) return street;
  return `${prefix}${street}`;
}

function inferCuisine(name, description = "") {
  const text = `${name} ${description}`;
  const rules = [
    [/早餐|早點|蛋餅|吐司/, "早餐"],
    [/早午餐/, "早午餐"],
    [/咖啡|café|cafe/i, "咖啡"],
    [/蛋糕|甜點|糕餅|麵包|烘焙|伴手禮|餅/, "甜點／烘焙"],
    [/茶飲|飲料|手搖|果汁|冰店|冰品/, "茶飲／冰品"],
    [/火鍋|鍋物/, "火鍋"],
    [/燒肉|燒烤|串燒|炭烤/, "燒烤／燒肉"],
    [/牛排/, "牛排"],
    [/海鮮|漁港|魚料理|蝦|蟹/, "海鮮料理"],
    [/壽司|居酒屋|拉麵|日式|日本料理|丼飯/, "日式料理"],
    [/韓式|韓國|石鍋拌飯/, "韓式料理"],
    [/義式|義大利|披薩|pizzeria/i, "義式料理"],
    [/法式|法國料理/, "法式料理"],
    [/泰式|泰國料理/, "泰式料理"],
    [/客家/, "客家料理"],
    [/牛肉麵|麵店|麵線|米粉|米苔目|粿|餃子|水餃/, "麵食／小吃"],
    [/便當|自助餐|飯店|滷肉飯|雞肉飯|小吃|肉圓|臭豆腐|豆花/, "台式小吃"],
    [/素食|蔬食/, "素食"],
    [/餐酒館|酒吧/, "餐酒館"],
    [/餐廳|餐館|食堂|食坊|食店|料理|飲食店/, "中式／台式料理"],
  ];
  const matches = [];
  for (const [pattern, label] of rules) if (pattern.test(text)) matches.push(label);
  return [...new Set(matches)].slice(0, 3).length ? [...new Set(matches)].slice(0, 3) : ["其他餐飲"];
}

function estimatePrice(cuisineTypes, name = "") {
  const text = `${cuisineTypes.join(" ")} ${name}`;
  let min = 150;
  let max = 600;
  if (/(早餐|甜點|烘焙|茶飲|冰品|麵食|小吃|便當|咖啡)/.test(text)) {
    min = 60;
    max = 400;
  } else if (/(牛排|燒肉|海鮮|餐酒館|法式|無菜單)/.test(text)) {
    min = 400;
    max = 1800;
  } else if (/(火鍋|日式|韓式|義式)/.test(text)) {
    min = 250;
    max = 1000;
  }
  return {
    min,
    max,
    display: `約 NT$${min}–${max}/人`,
    basis: "官方公開資料未提供完整菜單價位，依店名與料理分類估算；實際以店家最新菜單為準",
  };
}

function unavailableRating(sourceLabel) {
  return {
    platform: "未提供",
    score: null,
    review_count: null,
    source_snapshot: `${sourceLabel}（${TODAY}）未提供可驗證的網路評分快照`,
    food_diary_count: null,
    review_summary: reviewSummaryToArray(`${sourceLabel}提供店家基本資料，但未提供可解析的網路評分、評論數或評論摘要。`),
  };
}

function officialRecord({ sourceId, name, address, phone, cuisineTypes, sourceUrls, sourceLabel, statusText }) {
  return {
    source_id: sourceId,
    name,
    address,
    phone: phone || null,
    physical_store: true,
    price_range_twd_per_person: estimatePrice(cuisineTypes, name),
    cuisine_types: cuisineTypes,
    online_rating: unavailableRating(sourceLabel),
    store_status_check: statusText,
    sources: [...new Set(sourceUrls)],
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(text) {
  const row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  return row;
}

function readTourismRecords() {
  const document = JSON.parse(fs.readFileSync(TOURISM_PATH, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(document) ? document : document.Restaurants || [];
}

function readFdaRecords() {
  const document = JSON.parse(fs.readFileSync(FDA_PATH, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(document) ? document : document.Data || [];
}

function readBusinessRecords() {
  const rows = parseCsv(fs.readFileSync(BUSINESS_PATH, "utf8").replace(/^\uFEFF/, ""));
  return rows.slice(1).map(([businessId, name, address, status]) => ({
    businessId: clean(businessId),
    name: clean(name),
    address: clean(address),
    status: clean(status),
  }));
}

async function readTaxRecords(scopes) {
  const recordsByScope = new Map(scopes.map(({ city, district }) => [`${city}||${district}`, []]));
  const input = fs.createReadStream(TAX_PATH);
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let isHeader = true;
  for await (const line of lines) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    const row = parseCsvLine(line);
    if (row.length < 16) continue;
    const name = clean(row[3]);
    const address = clean(row[0]).replace(/台(?=中市|南市)/g, "臺");
    const businessId = clean(row[1]);
    if (!name || !address || !businessId) continue;
    const industry = [8, 10, 12, 14]
      .map((index) => ({ code: clean(row[index]), name: clean(row[index + 1]) }))
      .find(({ code }) => TAX_RESTAURANT_INDUSTRIES.has(code));
    if (!industry) continue;
    for (const scope of scopes) {
      if (!cityDistrictMatch(address, scope.city, scope.district)) continue;
      const key = `${scope.city}||${scope.district}`;
      recordsByScope.get(key).push({ businessId, name, address, industryCode: industry.code, industryName: industry.name });
      break;
    }
  }
  return recordsByScope;
}

function createTourismCandidates(records, city, district) {
  const result = [];
  const seen = new Set();
  for (const record of records) {
    if (Number(record.ServiceStatus) !== 1) continue;
    const sourceAddress = [record.PostalAddress?.City, record.PostalAddress?.Town, record.PostalAddress?.StreetAddress].filter(Boolean).join("");
    if (!cityDistrictMatch(sourceAddress, city, district)) continue;
    const address = fullAddress(city, district, sourceAddress);
    const name = clean(record.RestaurantName);
    if (!name || !cityDistrictMatch(address, city, district)) continue;
    const key = dedupeKey(name, address);
    if (seen.has(key)) continue;
    seen.add(key);
    const phone = clean(record.Telephones?.find((item) => item?.Tel)?.Tel || "");
    result.push(officialRecord({
      sourceId: `tourism-${clean(record.RestaurantID)}`,
      name,
      address,
      phone,
      cuisineTypes: inferCuisine(name, record.Description),
      sourceUrls: [...SOURCE_URLS.tourism, ...(record.MapURLs || []), ...(record.WebsiteURL ? [record.WebsiteURL] : [])],
      sourceLabel: "交通部觀光署觀光資訊資料庫餐飲資料",
      statusText: "觀光署公開資料的 ServiceStatus 為營運中，資料列有店址；出發前仍建議確認當日營業。",
    }));
  }
  return result;
}

function createFdaCandidates(records, city, district) {
  const result = [];
  const seen = new Set();
  for (const record of records) {
    if (clean(record["登錄項目"]) !== "餐飲場所") continue;
    const name = clean(record["公司或商業登記名稱"]);
    const address = clean(record["業者地址"]).replace(/台(?=中市|南市)/g, "臺");
    if (!name || !cityDistrictMatch(address, city, district)) continue;
    const key = dedupeKey(name, address);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(officialRecord({
      sourceId: `fda-${clean(record["食品業者登錄字號"])}`,
      name,
      address,
      phone: null,
      cuisineTypes: inferCuisine(name),
      sourceUrls: SOURCE_URLS.fda,
      sourceLabel: "衛生福利部食品藥物管理署食品業者登錄資料",
      statusText: "食品業者登錄項目為「餐飲場所」且列有店址；該資料未提供即時歇業狀態，出發前仍建議確認。",
    }));
  }
  return result;
}

function createBusinessCandidates(records, city, district) {
  const result = [];
  const seen = new Set();
  for (const record of records) {
    if (record.status !== "核准設立") continue;
    const name = record.name;
    const address = record.address.replace(/台(?=中市|南市)/g, "臺");
    if (!name || !cityDistrictMatch(address, city, district)) continue;
    const key = dedupeKey(name, address);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(officialRecord({
      sourceId: `business-${record.businessId}`,
      name,
      address,
      phone: null,
      cuisineTypes: inferCuisine(name),
      sourceUrls: SOURCE_URLS.business,
      sourceLabel: "經濟部商業發展署餐廳餐館商業登記資料",
      statusText: "商業登記狀態為「核准設立」且列有營業地址；官方資料未提供即時營業與電話，出發前仍建議確認。",
    }));
  }
  return result;
}

function createTaxCandidates(records, city, district) {
  const result = [];
  const seen = new Set();
  for (const record of records) {
    if (!TAX_RESTAURANT_INDUSTRIES.has(record.industryCode)) continue;
    if (!cityDistrictMatch(record.address, city, district)) continue;
    const key = dedupeKey(record.name, record.address);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(officialRecord({
      sourceId: `tax-${record.businessId}`,
      name: record.name,
      address: record.address,
      phone: null,
      cuisineTypes: inferCuisine(record.name, record.industryName),
      sourceUrls: SOURCE_URLS.tax,
      sourceLabel: "財政部全國營業（稅籍）登記資料",
      statusText: `稅籍資料集僅收錄營業中資料，行業分類為「${record.industryName || TAX_RESTAURANT_INDUSTRIES.get(record.industryCode)}」（${record.industryCode}），並列有營業地址；電話、評分與實際營業時間仍建議出發前確認。`,
    }));
  }
  return result;
}

function idParts(file) {
  const match = path.basename(file).match(/^(.*)-([^-]+)-restaurants\.json$/);
  if (!match) return null;
  return { prefix: match[1], slug: match[2] };
}

function mergeIntoFile(file, tourismRecords, fdaRecords, businessRecords, taxRecords) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  const collection = document.collection || {};
  const rawRestaurants = Array.isArray(document.restaurants) ? document.restaurants : [];
  const city = canonicalCity(collection.city);
  const district = clean(collection.district);
  const baseRestaurants = rawRestaurants
    .filter((item) => !/^(?:tourism|fda|business|tax)-/.test(String(item.source_id || "")))
    .filter((item) => cityDistrictMatch(item.address, city, district));
  if (collection.status === "complete" && baseRestaurants.length >= TARGET_COUNT && baseRestaurants.length === rawRestaurants.length) {
    return { file, base: baseRestaurants.length, added: 0, count: baseRestaurants.length, status: "skipped" };
  }
  const existingRestaurants = baseRestaurants;
  const seen = new Set(existingRestaurants.map((item) => dedupeKey(item.name, item.address)));
  const tourismCandidates = createTourismCandidates(tourismRecords, city, district);
  const fdaCandidates = createFdaCandidates(fdaRecords, city, district);
  const businessCandidates = createBusinessCandidates(businessRecords, city, district);
  const taxCandidates = createTaxCandidates(taxRecords, city, district);
  const sources = [
    ["tourism", tourismCandidates],
    ["fda", fdaCandidates],
    ["business", businessCandidates],
    ["tax", taxCandidates],
  ];
  const additions = [];
  const addedBySource = {};
  for (const [source, candidates] of sources) {
    for (const candidate of candidates) {
      if (existingRestaurants.length + additions.length >= TARGET_COUNT) break;
      const key = dedupeKey(candidate.name, candidate.address);
      if (seen.has(key)) continue;
      seen.add(key);
      additions.push(candidate);
      addedBySource[source] = (addedBySource[source] || 0) + 1;
    }
  }
  const fileParts = idParts(file);
  const idPrefix = `${fileParts?.prefix || "regional"}-${fileParts?.slug || "district"}`;
  const restaurants = existingRestaurants.concat(additions).map((item, index) => ({
    ...item,
    id: `${idPrefix}-${String(index + 1).padStart(3, "0")}`,
  }));
  const existingStats = collection.collection_stats || {};
  const updated = {
    ...document,
    collection: {
      ...collection,
      title: `${city}${district}實體餐廳資料${restaurants.length >= TARGET_COUNT ? "（含官方資料補充）" : "（多來源補充）"}`,
      scope: `${collection.scope || `收集地址屬於${district}且有店面的餐廳。`} 不足筆數再以觀光署餐飲資料、食藥署「餐飲場所」登錄資料、經濟部核准設立餐廳餐館資料及財政部營業稅籍餐飲分類資料補充；官方資料未提供網路評分時保留 null 與來源說明。`,
      collected_at: TODAY,
      status: restaurants.length >= TARGET_COUNT ? "complete" : "partial",
      target_count: TARGET_COUNT,
      record_count: restaurants.length,
      source_platform: "FonFood public restaurant pages; Tourism Administration restaurant data; FDA food business registration data; MOEA restaurant business registration data; Ministry of Finance active tax registration data",
      rating_note: "FonFood 店家保留來源頁面的 Google 評價快照；官方補充資料沒有網路評分時以 null 表示，並在 source_snapshot 與 review_summary 說明，未自行推估。",
      review_note: "review_summary 僅保存來源頁面可公開解析的摘要；官方補充資料未提供評論時以明確說明表示，不把登記資料誤當成評論。",
      price_note: "價位是每人約略消費範圍（新台幣）；優先取 FonFood 公開菜單，官方補充資料沒有菜單時依店名與料理分類估算，實際仍以店家最新菜單為準。",
      source_list_pages: [...new Set([...(collection.source_list_pages || []), ...SOURCE_URLS.tourism, ...SOURCE_URLS.fda, ...SOURCE_URLS.business, ...SOURCE_URLS.tax])],
      collection_stats: {
        ...existingStats,
        fonfood_base_count: existingRestaurants.length,
        official_candidates: {
          tourism: tourismCandidates.length,
          fda_food_service: fdaCandidates.length,
          business_registered: businessCandidates.length,
          tax_registered_food_service: taxCandidates.length,
        },
        official_added: addedBySource,
        official_added_total: additions.length,
        valid_count: restaurants.length,
      },
    },
    restaurants,
  };
  if (SHOULD_WRITE) fs.writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  return {
    file,
    base: existingRestaurants.length,
    added: additions.length,
    addedBySource,
    count: restaurants.length,
    status: updated.collection.status,
    candidates: {
      tourism: tourismCandidates.length,
      fda: fdaCandidates.length,
      business: businessCandidates.length,
    },
  };
}

async function main() {
  for (const required of [TOURISM_PATH, FDA_PATH, BUSINESS_PATH, TAX_PATH]) {
    if (!fs.existsSync(required)) throw new Error(`Missing source file: ${required}`);
  }
  const tourismRecords = readTourismRecords();
  const fdaRecords = readFdaRecords();
  const businessRecords = readBusinessRecords();
  const files = fs.readdirSync(RESTAURANT_DATA_DIR)
    .filter((file) => file.endsWith("-restaurants.json") && !file.startsWith("taipei-") && file !== "ximending-restaurants.json")
    .map((file) => path.join(RESTAURANT_DATA_DIR, file))
    .filter((file) => {
      const document = JSON.parse(fs.readFileSync(file, "utf8"));
      return Boolean(document.collection?.city && document.collection?.district);
    })
    .sort();
  const scopes = files.map((file) => {
    const document = JSON.parse(fs.readFileSync(file, "utf8"));
    return { city: canonicalCity(document.collection.city), district: clean(document.collection.district) };
  });
  const taxRecordsByScope = await readTaxRecords(scopes);
  const results = files.map((file, index) => {
    const scope = scopes[index];
    return mergeIntoFile(file, tourismRecords, fdaRecords, businessRecords, taxRecordsByScope.get(`${scope.city}||${scope.district}`) || []);
  });
  const added = results.filter((item) => item.added > 0);
  console.log(JSON.stringify({
    source_counts: { tourism: tourismRecords.length, fda: fdaRecords.length, business: businessRecords.length, tax_scoped: [...taxRecordsByScope.values()].reduce((sum, records) => sum + records.length, 0) },
    files: results.length,
    files_with_additions: added.length,
    added_total: results.reduce((sum, item) => sum + item.added, 0),
    complete_after_merge: results.filter((item) => item.status === "complete").length,
    partial_after_merge: results.filter((item) => item.status === "partial").length,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
