#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "res_data");
const REPORT_PATH = path.join(ROOT, "docs", "operation-status-verification-report.json");
const REMOVALS_PATH = path.join(ROOT, "docs", "operation-status-removals.json");
const FONFOOD_CACHE_DIR = process.env.FONFOOD_CACHE_DIR || "/private/tmp/jazamila-fonfood-cache";
const OPERATION_CACHE_DIR = process.env.OPERATION_CACHE_DIR || "/private/tmp/jazamila-operation-cache";
const SHOULD_WRITE = process.argv.includes("--write");
const SKIP_GOOGLE = process.argv.includes("--skip-google");
const CACHE_ONLY = process.argv.includes("--cache-only");
const USE_GOOGLE_MAPS = process.argv.includes("--google-maps");
const USE_GOOGLE_SEARCH = !USE_GOOGLE_MAPS;
const REQUEST_CONCURRENCY = Math.max(1, Number(process.env.OPERATION_GOOGLE_CONCURRENCY || 2));
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.OPERATION_GOOGLE_DELAY_MS || 1000));
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const FILE_ARGUMENT = process.argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length) || null;
const EXCLUDED_FILES = new Set((process.argv.find((arg) => arg.startsWith("--exclude="))?.slice("--exclude=".length) || "").split(",").map((value) => path.basename(value.trim())).filter(Boolean));
const GOOGLE_CACHE_VERSION = USE_GOOGLE_SEARCH ? 4 : 2;

const CLOSED_STATUS_PATTERN = /(永久歇業|永久關閉|已歇業|暫停營業|停業中|停止營業|暫時關閉|已搬遷|已不存在)/i;
const NOT_FOUND_PATTERN = /(找不到結果|找不到這個地點|沒有找到|未找到|沒有營業資訊)/i;
const GOOGLE_SEARCH_HOST = "https://www.google.com.tw/search";
const GOOGLE_SEARCH_QUERY_SUFFIX = "(永久歇業 OR 永久關閉 OR 已歇業 OR 暫停營業 OR 停業中 OR 停止營業 OR 暫時關閉 OR 已搬遷 OR 已不存在)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clean(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
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

function cleanHtml(value) {
  return clean(decodeEntities(String(value ?? ""))
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/臺/g, "台")
    .replace(/[\s\u3000，,。．.、:：;；/\\()（）【】「」『』'"“”‘’《》<>\-—_]/g, "")
    .toLowerCase();
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

function cachePathForUrl(url) {
  return path.join(OPERATION_CACHE_DIR, `${crypto.createHash("sha1").update(`${GOOGLE_CACHE_VERSION}:${url}`).digest("hex")}.json`);
}

function fonfoodCachePath(url) {
  return path.join(FONFOOD_CACHE_DIR, `${crypto.createHash("sha1").update(url).digest("hex")}.html`);
}

function parseClock(value) {
  const match = String(value ?? "").match(/(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2})\s*[:：]\s*(\d{2})/i);
  if (!match) return null;
  let hour = Number(match[2]);
  const minute = Number(match[3]);
  if (minute > 59 || hour > 24) return null;
  const meridiem = String(match[1] || "").toLowerCase();
  if ((meridiem === "下午" || meridiem === "晚上" || meridiem === "pm") && hour < 12) hour += 12;
  if ((meridiem === "上午" || meridiem === "早上" || meridiem === "am") && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function formatClock(minutes) {
  let value = Math.round(Number(minutes));
  if (!Number.isFinite(value)) return null;
  value %= 1440;
  if (value < 0) value += 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function parseIntervals(value) {
  const text = String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/[：]/g, ":")
    .replace(/[–—~～至]/g, "-")
    .replace(/\s+/g, " ");
  const intervals = [];
  const pattern = /(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2}:\d{2})\s*-\s*(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2}:\d{2})/gi;
  for (const match of text.matchAll(pattern)) {
    const start = parseClock(`${match[1] || ""}${match[2]}`);
    const end = parseClock(`${match[3] || ""}${match[4]}`);
    if (start === null || end === null) continue;
    let normalizedEnd = end;
    if (normalizedEnd <= start) normalizedEnd += 1440;
    intervals.push({ start, end: normalizedEnd });
  }
  return intervals;
}

function summarizeDailyIntervals(days) {
  const daily = days
    .map((day) => {
      const intervals = Array.isArray(day) ? day : [];
      if (intervals.length === 0) return null;
      return {
        open: Math.min(...intervals.map((interval) => interval.start)),
        close: Math.max(...intervals.map((interval) => interval.end)),
      };
    })
    .filter(Boolean);
  if (daily.length === 0) return null;
  const open = daily.reduce((sum, day) => sum + day.open, 0) / daily.length;
  const close = daily.reduce((sum, day) => sum + day.close, 0) / daily.length;
  const averageOpen = formatClock(open);
  const averageClose = formatClock(close);
  if (!averageOpen || !averageClose) return null;
  return {
    average_open_time: averageOpen,
    average_close_time: averageClose,
    display: `約 ${averageOpen}–${averageClose}`,
    open_days_considered: daily.length,
  };
}

function summarizeTextHours(text) {
  const intervals = parseIntervals(text);
  if (intervals.length === 0) {
    if (/24\s*小時|24\s*hours?/i.test(String(text))) {
      return {
        average_open_time: "00:00",
        average_close_time: "23:59",
        display: "約 00:00–23:59",
        open_days_considered: 1,
      };
    }
    return null;
  }
  return summarizeDailyIntervals([intervals]);
}

function extractFonfoodHours(html) {
  const match = String(html).match(/<h3>\s*營業時間：?\s*<\/h3>[\s\S]*?<\/td>\s*<\/tr>/i);
  if (!match) return null;
  const section = match[0].replace(/^[\s\S]*?<td[^>]*>/i, "").replace(/<\/td>[\s\S]*$/i, "");
  const text = cleanHtml(section);
  const dayMatches = [...text.matchAll(/(?:星期|週)([一二三四五六日天])\s*[:：]?\s*([^\n]+)/g)];
  const days = dayMatches.length > 0
    ? dayMatches.map((day) => parseIntervals(day[2]))
    : [parseIntervals(text)];
  const summary = summarizeDailyIntervals(days);
  return summary ? { ...summary, source: "FonFood 公開店家頁面" } : null;
}

function extractGoogleHours(body, source = "Google Maps 公開店家頁面（可解析時段）") {
  const text = clean(body).replace(/[–—~～]/g, "-");
  const dayMatches = [...text.matchAll(/星期[一二三四五六日天]\s*/g)];
  const rows = dayMatches.map((match, index) => {
    const end = dayMatches[index + 1]?.index ?? text.length;
    return parseIntervals(text.slice(match.index + match[0].length, end));
  }).filter((intervals) => intervals.length > 0);
  const summary = summarizeDailyIntervals(rows.length ? rows : [parseIntervals(text)]);
  return summary ? { ...summary, source } : null;
}

function extractTourismHours(record) {
  const summary = summarizeTextHours(record?.ServiceTimeInfo || "");
  return summary ? { ...summary, source: "交通部觀光署觀光資訊資料庫 ServiceTimeInfo" } : null;
}

function extractDistrict(address) {
  const match = String(address || "").match(/市([^路街巷弄號]{1,8}(?:區|鄉|鎮))/);
  return match ? match[1] : "";
}

function extractStreetNumber(address) {
  const match = String(address || "").match(/(\d+(?:[-之]\d+)?號)/);
  return match ? match[1].replace(/號$/, "") : "";
}

function extractStreetName(address) {
  const match = String(address || "").match(/([^市區縣鄉鎮路街巷弄]{1,12}(?:路|街|巷|弄))/);
  return match ? match[1] : "";
}

function googleNameMatches(body, name) {
  const normalizedBody = normalizeText(body);
  const normalizedName = normalizeText(name);
  if (!normalizedName || normalizedName.length < 2) return false;
  if (normalizedBody.includes(normalizedName)) return true;
  const tokens = normalizedName
    .match(/[\u4e00-\u9fff]{2,}|[a-z0-9]{3,}/gi)
    ?.filter((token) => !/^(餐廳|食堂|小吃|咖啡|火鍋|料理|店家|美食|商行|有限公司|股份有限公司)$/i.test(token)) || [];
  return tokens.some((token) => normalizedBody.includes(token));
}

function googleAddressMatches(body, address, allowIncomplete = false) {
  const normalizedBody = normalizeText(body);
  const district = extractDistrict(address);
  const street = extractStreetName(address);
  const streetNumber = extractStreetNumber(address);
  const districtMatch = !district || normalizedBody.includes(normalizeText(district));
  const numberMatch = !streetNumber || normalizedBody.includes(normalizeText(streetNumber));
  const streetMatch = !street || normalizedBody.includes(normalizeText(street));
  if (districtMatch && streetMatch && numberMatch) return true;
  return allowIncomplete && streetMatch && numberMatch;
}

function sourceKind(restaurant) {
  const id = String(restaurant?.source_id || "");
  if (/^tourism-/.test(id)) return "tourism";
  if (/^fda-/.test(id)) return "fda";
  if (/^business-/.test(id)) return "business";
  if (/^tax-/.test(id)) return "tax";
  if (/^ifoodie-/.test(id)) return "ifoodie";
  if (/^googlemaps-/.test(id)) return "googlemaps";
  if (/^\d+$/.test(id)) return "fonfood";
  return "other";
}

function sourceUrlForGoogle(restaurant) {
  const direct = (restaurant.sources || []).find((source) => /google\.com\/maps\//i.test(source));
  if (direct) return direct;
  const query = `${restaurant.name || ""} ${restaurant.address || ""}`.trim();
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=zh-TW`;
}

function sourceUrlForGoogleSearch(restaurant) {
  const query = [
    `"${clean(restaurant.name)}"`,
    `"${clean(restaurant.address)}"`,
    GOOGLE_SEARCH_QUERY_SUFFIX,
  ].join(" ");
  return `${GOOGLE_SEARCH_HOST}?hl=zh-TW&gl=tw&num=10&q=${encodeURIComponent(query)}`;
}

function loadOfficialIndexes() {
  const indexes = {
    tourism: new Map(),
    business: new Map(),
    tax: new Set(),
  };
  const tourismPath = "/private/tmp/jazamila-tourism/RestaurantList.json";
  if (fs.existsSync(tourismPath)) {
    const document = JSON.parse(fs.readFileSync(tourismPath, "utf8").replace(/^\uFEFF/, ""));
    for (const record of (Array.isArray(document) ? document : document.Restaurants || [])) {
      indexes.tourism.set(`tourism-${clean(record.RestaurantID)}`, record);
    }
  }
  const businessPath = "/private/tmp/jazamila-business-restaurants.csv";
  if (fs.existsSync(businessPath)) {
    const rows = parseCsv(fs.readFileSync(businessPath, "utf8").replace(/^\uFEFF/, ""));
    const header = rows[0] || [];
    const indexesByName = Object.fromEntries(header.map((value, index) => [value, index]));
    for (const row of rows.slice(1)) {
      const id = clean(row[indexesByName["統一編號"]]);
      if (id) indexes.business.set(`business-${id}`, {
        status: clean(row[indexesByName["登記狀態"]]),
      });
    }
  }
  const taxPath = "/private/tmp/jazamila-tax/BGMOPEN1.csv";
  if (fs.existsSync(taxPath)) {
    const rows = parseCsv(fs.readFileSync(taxPath, "utf8").replace(/^\uFEFF/, ""));
    const header = rows[0] || [];
    const idIndex = header.indexOf("統一編號");
    if (idIndex >= 0) {
      for (const row of rows.slice(1)) {
        const id = clean(row[idIndex]);
        if (id) indexes.tax.add(`tax-${id}`);
      }
    }
  }
  return indexes;
}

async function readCachedFonfood(restaurant) {
  const sourceUrl = (restaurant.sources || []).find((source) => /fonfood\.com\/store\//i.test(source));
  if (!sourceUrl) return { html: "", source: null, sourceUrl: null };
  const cachePath = fonfoodCachePath(sourceUrl);
  try {
    return { html: await fsp.readFile(cachePath, "utf8"), source: "cache", sourceUrl };
  } catch {
    return { html: "", source: null, sourceUrl };
  }
}

function initialGoogleResult(queryUrl) {
  return {
    version: GOOGLE_CACHE_VERSION,
    provider: USE_GOOGLE_SEARCH ? "google-search" : "google-maps",
    query_url: queryUrl,
    page_url: null,
    page_title: null,
    body: "",
    panel_body: "",
    search_results: [],
    matched_name: false,
    matched_address: false,
    status: "not_found",
    status_marker: null,
    closure_context: null,
    hours: null,
    error: null,
    checked_at: TODAY,
  };
}

function isNegatedClosure(context, markerIndex) {
  const before = String(context).slice(0, markerIndex);
  return /(?:沒有|並沒有|未|不是|並非|尚未|不會|不算|仍未)\s*$/i.test(before)
    || /(?:正常營業|持續營業|繼續營業|仍在營業)\s*(?:中|的)?\s*$/i.test(before);
}

function isHistoricalTemporaryClosure(context) {
  return /(?:\d+\s*年前|防疫|疫情|暫停營業至|暫時關閉至|恢復營業|再相見|公休一日|休息[一二三四五六七日天]天)/i.test(context);
}

function findClosureInText(text, restaurant, { allowTemporary = false, maxContext = 320 } = {}) {
  const value = clean(text);
  const pattern = new RegExp((allowTemporary ? CLOSED_STATUS_PATTERN : /(永久歇業|永久關閉|已歇業|停業中|停止營業|已搬遷|已不存在)/i).source, "gi");
  for (const match of value.matchAll(pattern)) {
    const contextStart = Math.max(0, match.index - maxContext);
    const contextEnd = Math.min(value.length, match.index + maxContext);
    const context = value.slice(contextStart, contextEnd);
    const relativeIndex = match.index - contextStart;
    if (isNegatedClosure(context, relativeIndex)) continue;
    if (isHistoricalTemporaryClosure(context)) continue;
    if (googleNameMatches(context, restaurant.name) && googleAddressMatches(context, restaurant.address, true)) {
      return {
        marker: match[1],
        context,
      };
    }
  }
  return null;
}

function panelStatusArea(panelBody) {
  const text = clean(panelBody);
  const end = text.search(/網路上的評論|查看所有 Google 評論|評論\s*撰寫評論|關於此資料/);
  return text.slice(0, end >= 0 ? end : 2600);
}

function findGoogleSearchClosure(result, restaurant) {
  const panel = panelStatusArea(result.panel_body || "");
  if (googleNameMatches(panel, restaurant.name) && googleAddressMatches(panel, restaurant.address, true)) {
    const panelClosure = findClosureInText(panel, restaurant, { allowTemporary: true, maxContext: 1000 });
    if (panelClosure) return panelClosure;
  }
  for (const block of result.search_results || []) {
    const closure = findClosureInText(block, restaurant, { allowTemporary: false, maxContext: 260 });
    if (closure) return closure;
  }
  return findClosureInText(result.body || "", restaurant, { allowTemporary: false, maxContext: 260 });
}

function parseGoogleSearchResult(result, restaurant) {
  const body = String(result.body || "");
  const panel = panelStatusArea(result.panel_body || "");
  const matchedPanelName = googleNameMatches(panel, restaurant.name);
  const matchedPanelAddress = googleAddressMatches(panel, restaurant.address, true);
  const matchedName = matchedPanelName || googleNameMatches(body, restaurant.name);
  const matchedAddress = matchedPanelAddress || googleAddressMatches(body, restaurant.address);
  const matchedEntity = matchedPanelName && matchedPanelAddress;
  const closure = findGoogleSearchClosure(result, restaurant);
  const hours = matchedEntity
    ? extractGoogleHours(result.panel_body, "Google 搜尋結果（店家資訊面板）")
    : null;
  return {
    ...result,
    matched_name: matchedName,
    matched_address: matchedAddress,
    status: closure
      ? "closed"
      : matchedEntity
        ? "operating"
        : NOT_FOUND_PATTERN.test(body)
          ? "not_found"
          : "uncertain",
    status_marker: closure?.marker || null,
    closure_context: closure?.context || null,
    reason: closure
      ? `Google 搜尋結果在與店名及地址相符的內容中明確標示「${closure.marker}」`
      : matchedEntity
        ? "Google 搜尋結果顯示與店名及地址相符的店家資訊；未發現明確歇業標記。"
        : null,
    hours,
  };
}

async function readGoogleCache(queryUrl, restaurant) {
  try {
    const cached = JSON.parse(await fsp.readFile(cachePathForUrl(queryUrl), "utf8"));
    if (cached.version !== GOOGLE_CACHE_VERSION) return null;
    if (USE_GOOGLE_SEARCH) return parseGoogleSearchResult(cached, restaurant);
    const statusAreaEnd = String(cached.body || "").search(/提出修改建議|新增遺漏的資訊|關於此資料/);
    const statusArea = String(cached.body || "").slice(0, statusAreaEnd >= 0 ? statusAreaEnd : 1800);
    cached.status_marker = statusArea.match(CLOSED_STATUS_PATTERN)?.[1] || null;
    if (cached.matched_address) cached.status = cached.status_marker ? "closed" : "operating";
    return cached;
  } catch {
    return null;
  }
}

async function writeGoogleCache(queryUrl, result) {
  await fsp.mkdir(OPERATION_CACHE_DIR, { recursive: true });
  await fsp.writeFile(cachePathForUrl(queryUrl), `${JSON.stringify(result)}\n`, "utf8");
}

async function checkGoogleMapsPage(page, restaurant) {
  const queryUrl = sourceUrlForGoogle(restaurant);
  const cached = await readGoogleCache(queryUrl, restaurant);
  if (cached) return cached;
  const result = initialGoogleResult(queryUrl);
  if (CACHE_ONLY) {
    result.error = "cache miss in cache-only mode";
    return result;
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(queryUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(450 + REQUEST_DELAY_MS);
      let body = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      const toggle = page.locator('[aria-label="顯示本週營業時間"]').first();
      if (await toggle.count()) {
        await toggle.click().catch(() => {});
        await page.waitForTimeout(120);
      }
      const expandedRows = await page.locator("table tr").allInnerTexts().catch(() => []);
      if (expandedRows.length) body = `${body}\n${expandedRows.join("\n")}`;
      const title = await page.title().catch(() => "");
      const pageUrl = page.url();
      const hasDetailsPanel = /提出修改建議|新增遺漏的資訊|關於此資料|永久歇業|永久關閉/i.test(body);
      const matchedAddress = hasDetailsPanel && googleAddressMatches(body, restaurant.address);
      const statusAreaEnd = body.search(/提出修改建議|新增遺漏的資訊|關於此資料/);
      const statusArea = body.slice(0, statusAreaEnd >= 0 ? statusAreaEnd : 1800);
      const marker = statusArea.match(CLOSED_STATUS_PATTERN)?.[1] || null;
      const hours = extractGoogleHours(body);
      result.page_url = pageUrl;
      result.page_title = title;
      result.body = body.slice(0, 16_000);
      result.matched_address = matchedAddress;
      result.status_marker = marker;
      result.hours = hours;
      result.status = matchedAddress && marker ? "closed" : matchedAddress ? "operating" : NOT_FOUND_PATTERN.test(body) ? "not_found" : "uncertain";
      result.error = null;
      if (body.length >= 50 || attempt === 3) break;
    } catch (error) {
      result.error = error.message;
      if (attempt < 3) await sleep(900 * attempt);
    }
  }
  await writeGoogleCache(queryUrl, result);
  return result;
}

async function checkGoogleSearch(page, restaurant) {
  const queryUrl = sourceUrlForGoogleSearch(restaurant);
  const cached = await readGoogleCache(queryUrl, restaurant);
  if (cached) return cached;
  const result = initialGoogleResult(queryUrl);
  if (CACHE_ONLY) {
    result.error = "cache miss in cache-only mode";
    return result;
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(queryUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(900);
      const body = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      const panelBody = await page.locator("#rhs").first().innerText({ timeout: 5_000 }).catch(() => "");
      const searchResults = await page.locator("#search .MjjYud").allInnerTexts().catch(() => []);
      const title = await page.title().catch(() => "");
      const pageUrl = page.url();
      result.page_url = pageUrl;
      result.page_title = title;
      result.body = body.slice(0, 16_000);
      result.panel_body = panelBody.slice(0, 8_000);
      result.search_results = searchResults.map((value) => clean(value).slice(0, 4_000)).filter(Boolean).slice(0, 20);
      if (/\/sorry\//i.test(pageUrl) || /無法存取 Google 搜尋|請完成驗證/i.test(body)) {
        result.status = "uncertain";
        result.error = "Google 搜尋回傳反自動化或驗證頁面";
      } else {
        Object.assign(result, parseGoogleSearchResult(result, restaurant));
        result.error = null;
      }
      if (body.length >= 200 || attempt === 3) break;
    } catch (error) {
      result.error = error.message;
      if (attempt < 3) await sleep(900 * attempt);
    }
  }
  await writeGoogleCache(queryUrl, result);
  return parseGoogleSearchResult(result, restaurant);
}

async function checkGooglePage(page, restaurant) {
  return USE_GOOGLE_SEARCH
    ? checkGoogleSearch(page, restaurant)
    : checkGoogleMapsPage(page, restaurant);
}

function officialStatus(restaurant, indexes) {
  const kind = sourceKind(restaurant);
  if (kind === "tourism") {
    const record = indexes.tourism.get(String(restaurant.source_id));
    return record
      ? { status: Number(record.ServiceStatus) === 1 ? "operating" : "closed", reason: `觀光署 ServiceStatus=${record.ServiceStatus}`, hours: extractTourismHours(record), source: "交通部觀光署觀光資訊資料庫" }
      : null;
  }
  if (kind === "business") {
    const record = indexes.business.get(String(restaurant.source_id));
    if (!record) return null;
    const active = record.status === "核准設立";
    return { status: active ? "operating" : "closed", reason: `商業登記狀態為「${record.status}」`, hours: null, source: "經濟部商業登記資料" };
  }
  if (kind === "tax") {
    const active = indexes.tax.has(String(restaurant.source_id));
    return { status: active ? "operating" : "uncertain", reason: active ? "財政部目前稅籍資料仍收錄此統一編號" : "目前稅籍資料未找到此統一編號", hours: null, source: "財政部全國營業（稅籍）登記資料" };
  }
  return null;
}

function sourcePageStatus(restaurant, fonfoodPage) {
  if (sourceKind(restaurant) !== "fonfood") return null;
  if (!fonfoodPage.html) return null;
  const hasStore = /<div[^>]+id=["']store["'][^>]*>/i.test(fonfoodPage.html);
  const hasAddress = /<h3>\s*地址：/i.test(fonfoodPage.html);
  if (!hasStore || !hasAddress) return null;
  return {
    status: "operating",
    reason: "FonFood 公開店家頁仍可取得店家主頁與店址；未把食記內文的歇業文字當作店家狀態。",
    source: "FonFood 公開店家頁面",
    hours: extractFonfoodHours(fonfoodPage.html),
  };
}

function mergeHours(...candidates) {
  return candidates.find((candidate) => candidate && candidate.average_open_time && candidate.average_close_time) || null;
}

function buildBusinessHours(hours) {
  if (!hours) {
    return {
      average_open_time: null,
      average_close_time: null,
      display: null,
      source: null,
      open_days_considered: 0,
      note: "已檢查公開來源，但未找到可可靠解析的營業時間；未以今日是否營業推估。",
    };
  }
  return {
    average_open_time: hours.average_open_time,
    average_close_time: hours.average_close_time,
    display: hours.display,
    source: hours.source,
    open_days_considered: hours.open_days_considered,
  };
}

function buildCheckedRecord(restaurant, status, hours, evidence) {
  const next = {
    ...restaurant,
    operation_status: status.status,
    operation_status_checked_at: TODAY,
    operation_status_sources: evidence.sources,
    operation_status_reason: status.reason,
    business_hours: buildBusinessHours(hours),
  };
  if (status.status === "operating") {
    next.store_status_check = `已於 ${TODAY} 檢查公開來源，未發現已歇業、停業中或永久關閉標記；本次未以今日是否營業作為判斷。`;
  } else {
    next.store_status_check = `已於 ${TODAY} 檢查公開來源，但無法取得足夠的現況營運證據；保留供後續人工確認。`;
  }
  return next;
}

async function verifyRestaurant(page, restaurant, indexes) {
  const kind = sourceKind(restaurant);
  const fonfoodPage = await readCachedFonfood(restaurant);
  const sourceStatus = sourcePageStatus(restaurant, fonfoodPage);
  const official = officialStatus(restaurant, indexes);
  let google = null;
  if (!SKIP_GOOGLE && (kind === "fonfood" || kind === "fda" || kind === "ifoodie" || kind === "googlemaps" || kind === "other" || !official)) {
    google = await checkGooglePage(page, restaurant);
  }

  if (google?.status === "closed") {
    const provider = USE_GOOGLE_SEARCH ? "Google 搜尋結果" : "Google Maps";
    return {
      keep: false,
      record: null,
      removal: {
        source_id: restaurant.source_id,
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        reason: `${provider}在與店名及地址相符的內容中明確標示「${google.status_marker}」`,
        source: google.page_url || google.query_url,
        checked_at: TODAY,
        original: restaurant,
      },
      evidence: google,
    };
  }

  if (official?.status === "closed") {
    return {
      keep: false,
      record: null,
      removal: {
        source_id: restaurant.source_id,
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        reason: official.reason,
        source: official.source,
        checked_at: TODAY,
        original: restaurant,
      },
      evidence: official,
    };
  }

  const currentEvidence = [official, sourceStatus, google?.status === "operating" ? google : null].filter(Boolean);
  const status = currentEvidence.some((item) => item.status === "operating")
    ? { status: "operating", reason: currentEvidence[0].reason || "公開來源仍列有店家", }
    : { status: "uncertain", reason: "未發現明確歇業標記，但公開來源不足以確認目前仍營業。" };
  const hours = mergeHours(sourceStatus?.hours, official?.hours, google?.hours);
  const sources = [...new Set([
    official?.source,
    sourceStatus?.source,
    google?.page_url || google?.query_url,
  ].filter(Boolean))];
  return {
    keep: true,
    record: buildCheckedRecord(restaurant, status, hours, { sources }),
    removal: null,
    evidence: { official, sourceStatus, google },
  };
}

function filesToProcess(allFiles) {
  if (!FILE_ARGUMENT) return allFiles.filter((file) => !EXCLUDED_FILES.has(file));
  const basename = path.basename(FILE_ARGUMENT);
  if (!allFiles.includes(basename)) throw new Error(`找不到指定 JSON 檔案：${basename}`);
  if (EXCLUDED_FILES.has(basename)) throw new Error(`指定檔案同時被排除：${basename}`);
  return [basename];
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  await fsp.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fsp.rename(temporaryPath, filePath);
}

async function main() {
  const allFiles = (await fsp.readdir(DATA_DIR)).filter((file) => file.endsWith("-restaurants.json")).sort();
  const files = filesToProcess(allFiles);
  const indexes = loadOfficialIndexes();
  const report = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) : {
    checked_at: TODAY,
    mode: SHOULD_WRITE ? "write" : "dry-run",
    files: {},
    totals: { files: 0, checked: 0, kept: 0, removed: 0, uncertain: 0, hours_found: 0, hours_missing: 0 },
  };
  const removals = fs.existsSync(REMOVALS_PATH) ? JSON.parse(fs.readFileSync(REMOVALS_PATH, "utf8")) : [];
  let browser = null;
  let context = null;
  const pages = [];
  if (!SKIP_GOOGLE && !CACHE_ONLY) {
    browser = await chromium.launch({
      headless: true,
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--no-sandbox", "--disable-gpu", ...(USE_GOOGLE_SEARCH ? ["--disable-blink-features=AutomationControlled"] : [])],
    });
    context = await browser.newContext({
      locale: "zh-TW",
      viewport: { width: 1280, height: 1000 },
      ...(USE_GOOGLE_SEARCH ? { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" } : {}),
    });
    for (let index = 0; index < REQUEST_CONCURRENCY; index += 1) {
      const page = await context.newPage();
      if (USE_GOOGLE_SEARCH) await page.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
      pages.push(page);
    }
  }
  const stats = { files: 0, checked: 0, kept: 0, removed: 0, uncertain: 0, hours_found: 0, hours_missing: 0 };
  try {
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      const filePath = path.join(DATA_DIR, file);
      const document = JSON.parse(await fsp.readFile(filePath, "utf8"));
      const originalRestaurants = document.restaurants || [];
      const verifiedRestaurants = [];
      const fileRemovals = [];
      const fileStats = { checked: 0, kept: 0, removed: 0, uncertain: 0, hours_found: 0, hours_missing: 0 };
      let cursor = 0;
      const worker = async (page) => {
        while (true) {
          const index = cursor;
          cursor += 1;
          if (index >= originalRestaurants.length) return;
          const restaurant = originalRestaurants[index];
          const result = await verifyRestaurant(page, restaurant, indexes);
          if (result.keep) {
            verifiedRestaurants[index] = result.record;
            fileStats.kept += 1;
            stats.kept += 1;
            if (result.record.operation_status === "uncertain") {
              fileStats.uncertain += 1;
              stats.uncertain += 1;
            }
            if (result.record.business_hours.average_open_time) {
              fileStats.hours_found += 1;
              stats.hours_found += 1;
            } else {
              fileStats.hours_missing += 1;
              stats.hours_missing += 1;
            }
          } else {
            fileRemovals.push(result.removal);
            fileStats.removed += 1;
            stats.removed += 1;
          }
          fileStats.checked += 1;
          stats.checked += 1;
          if (fileStats.checked % 25 === 0 || fileStats.checked === originalRestaurants.length) {
            console.log(JSON.stringify({ event: "progress", file, file_index: fileIndex + 1, files: files.length, checked: fileStats.checked, total: originalRestaurants.length, removed: fileStats.removed, hours_found: fileStats.hours_found }));
          }
          if (REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS);
        }
      };
      if (pages.length) {
        await Promise.all(pages.map((page) => worker(page)));
      } else {
        await worker(null);
      }
      const nextRestaurants = verifiedRestaurants.filter(Boolean);
      const nextDocument = {
        ...document,
        collection: {
          ...(document.collection || {}),
          operation_status_checked_at: TODAY,
          operation_status_provider: SKIP_GOOGLE ? "官方資料與公開店家頁面" : USE_GOOGLE_SEARCH ? "Google 搜尋、官方資料與公開店家頁面" : "Google Maps、官方資料與公開店家頁面",
          operation_status_note: "已逐筆檢查公開來源；永久歇業、永久關閉、暫停營業、停業中等明確狀態已移除。已打烊僅代表檢查當日狀態，不作為歇業判斷。若店家已搬遷且原地址停止營業，原地址資料會移除。營業時間為可取得來源的平均開門與關門時間；雙段營業取最早開門與最晚關門。",
          record_count: nextRestaurants.length,
          record_count_before_operation_check: originalRestaurants.length,
          record_count_after_operation_check: nextRestaurants.length,
        },
        restaurants: nextRestaurants,
      };
      if (SHOULD_WRITE) await writeJsonAtomic(filePath, nextDocument);
      fileStats.removed_records = fileRemovals;
      report.files[file] = {
        checked_at: TODAY,
        provider: SKIP_GOOGLE ? "official-and-public-pages" : USE_GOOGLE_SEARCH ? "google-search" : "google-maps",
        ...fileStats,
        before: originalRestaurants.length,
        after: nextRestaurants.length,
      };
      stats.files += 1;
      removals.push(...fileRemovals);
      report.totals = {
        files: Object.keys(report.files).length,
        checked: Object.values(report.files).reduce((sum, value) => sum + value.checked, 0),
        kept: Object.values(report.files).reduce((sum, value) => sum + value.kept, 0),
        removed: Object.values(report.files).reduce((sum, value) => sum + value.removed, 0),
        uncertain: Object.values(report.files).reduce((sum, value) => sum + value.uncertain, 0),
        hours_found: Object.values(report.files).reduce((sum, value) => sum + value.hours_found, 0),
        hours_missing: Object.values(report.files).reduce((sum, value) => sum + value.hours_missing, 0),
      };
      if (SHOULD_WRITE) {
        await writeJsonAtomic(REPORT_PATH, report);
        await writeJsonAtomic(REMOVALS_PATH, removals);
      }
      console.log(JSON.stringify({ event: "file_complete", file, file_index: fileIndex + 1, files: files.length, ...fileStats, before: originalRestaurants.length, after: nextRestaurants.length }));
    }
  } finally {
    await Promise.all(pages.map((page) => page.close().catch(() => {})));
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
  console.log(JSON.stringify({ event: "complete", mode: SHOULD_WRITE ? "write" : "dry-run", ...stats, report: report.totals }));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
