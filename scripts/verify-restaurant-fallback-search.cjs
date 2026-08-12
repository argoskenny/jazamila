#!/usr/bin/env node

/*
 * Fallback operation verification for records that remained uncertain after
 * the official/FonFood/Google pass.  Yahoo is used only as a search index;
 * a blocked or failed query is never treated as evidence that a restaurant
 * has disappeared.
 */

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "res_data");
const REPORT_PATH = path.join(ROOT, "docs", "operation-status-fallback-verification-report.json");
const REMOVALS_PATH = path.join(ROOT, "docs", "operation-status-removals.json");
const CACHE_DIR = process.env.OPERATION_FALLBACK_CACHE_DIR || "/private/tmp/jazamila-operation-fallback-cache";
const DIRECT_RESULT_CACHE_DIR = process.env.OPERATION_DIRECT_RESULT_CACHE_DIR || "/private/tmp/jazamila-operation-direct-results";
const FDA_DATA_PATH = process.env.FDA_DATA_PATH || "/private/tmp/jazamila-fda-restaurant-97/97_5.json";
const FDA_SOURCE_URL = "https://data.fda.gov.tw/data/opendata/export/97/json";
const SHOULD_WRITE = process.argv.includes("--write");
const CACHE_ONLY = process.argv.includes("--cache-only");
const FDA_ONLY = process.argv.includes("--fda-only");
const DIRECT_ONLY = process.argv.includes("--direct-only");
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const FILE_ARGUMENT = process.argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length) || null;
const EXCLUDED_FILES = new Set(
  (process.argv.find((arg) => arg.startsWith("--exclude="))?.slice("--exclude=".length) || "")
    .split(",")
    .map((value) => path.basename(value.trim()))
    .filter(Boolean),
);
const LIMIT_ARGUMENT = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length);
const LIMIT = LIMIT_ARGUMENT ? Math.max(0, Number(LIMIT_ARGUMENT)) : null;
const CONCURRENCY = Math.max(1, Number(process.env.OPERATION_FALLBACK_CONCURRENCY || 1));
const DELAY_MS = Math.max(0, Number(process.env.OPERATION_FALLBACK_DELAY_MS || 1000));
const CACHE_VERSION = 2;
const YAHOO_HOST = "https://tw.search.yahoo.com/search";
const CLOSED_STATUS_PATTERN = /(永久歇業|永久關閉|已歇業|停業中|停止營業|暫停營業|暫時關閉|已搬遷|已不存在)/i;
const BLOCKED_PATTERN = /(captcha|unusual traffic|automated queries|請完成驗證|無法確認您是真人|verify you are human)/i;
const COMMON_SUFFIX_PATTERN = /(餐廳|小吃店|小吃|食堂|店家|商號|有限公司|股份有限公司|分店|門市|店)$/;
let fdaIndex = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clean(value) {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex -- Strip control characters from untrusted source text.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadFdaIndex() {
  if (!fs.existsSync(FDA_DATA_PATH)) return new Map();
  try {
    const records = JSON.parse(fs.readFileSync(FDA_DATA_PATH, "utf8").replace(/^\uFEFF/, ""));
    return new Map(records
      .map((record) => [clean(record["食品業者登錄字號"]), record])
      .filter(([id]) => Boolean(id)));
  } catch (error) {
    console.warn(JSON.stringify({ event: "fda_index_unavailable", path: FDA_DATA_PATH, error: error.message }));
    return new Map();
  }
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
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/臺/g, "台")
    .replace(/[\s\u3000，,。．.、:：;；/\\()（）【】「」『』'"“”‘’《》<>\-—_]/g, "")
    .toLowerCase();
}

function normalizeAddress(value) {
  return normalizeText(value)
    .replace(/台灣/g, "台")
    .replace(/一/g, "1").replace(/二/g, "2").replace(/三/g, "3")
    .replace(/四/g, "4").replace(/五/g, "5").replace(/六/g, "6")
    .replace(/七/g, "7").replace(/八/g, "8").replace(/九/g, "9").replace(/十/g, "10");
}

function extractDistrict(address) {
  return String(address || "").match(/市([^路街巷弄號]{1,8}(?:區|鄉|鎮))/)?.[1] || "";
}

function extractStreetName(address) {
  return String(address || "").match(/([^市區縣鄉鎮路街巷弄]{1,12}(?:路|街|巷|弄))/)?.[1] || "";
}

function extractStreetNumber(address) {
  return String(address || "").match(/(\d+(?:[-之]\d+)?號)/)?.[1]?.replace(/號$/, "") || "";
}

function nameAliases(name) {
  const normalized = normalizeText(name);
  const aliases = new Set([normalized]);
  const districtIndex = normalized.lastIndexOf("區");
  if (districtIndex >= 0 && normalized.slice(districtIndex + 1).length >= 3) aliases.add(normalized.slice(districtIndex + 1));
  let shortened = normalized;
  for (let index = 0; index < 4; index += 1) {
    const next = shortened.replace(COMMON_SUFFIX_PATTERN, "");
    if (next === shortened) break;
    shortened = next;
    if (shortened.length >= 3) aliases.add(shortened);
  }
  return [...aliases].filter((value) => value.length >= 3).sort((a, b) => b.length - a.length);
}

function nameMatchScore(text, name) {
  const body = normalizeText(text);
  const aliases = nameAliases(name);
  for (const alias of aliases) if (body.includes(alias)) return alias === aliases[0] ? 3 : 2;
  return 0;
}

function addressMatchInfo(text, address) {
  const body = normalizeAddress(text);
  const district = normalizeAddress(extractDistrict(address));
  const street = normalizeAddress(extractStreetName(address));
  const number = normalizeAddress(extractStreetNumber(address));
  const full = normalizeAddress(address) && body.includes(normalizeAddress(address));
  const streetAndNumber = street && number && body.includes(street) && body.includes(number);
  const districtAndNumber = district && number && body.includes(district) && body.includes(number);
  const districtOnly = district && body.includes(district);
  return {
    matched: Boolean(full || streetAndNumber || districtAndNumber),
    district_only: Boolean(districtOnly),
  };
}

function unwrapYahooUrl(value) {
  const href = decodeEntities(value);
  const encoded = href.match(/(?:^|\/)RU=([^/]+?)(?:\/RK=|$)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { return encoded; }
  }
  try {
    const parsed = new URL(href, YAHOO_HOST);
    const redirected = parsed.searchParams.get("RU") || parsed.searchParams.get("ru");
    return redirected ? decodeURIComponent(redirected) : parsed.href;
  } catch {
    return href;
  }
}

function parseYahooCards(html) {
  const source = String(html || "");
  const starts = [...source.matchAll(/<div[^>]+class=["'][^"']*\balgo\b[^"']*["'][^>]*>/gi)].map((match) => match.index);
  const cards = [];
  for (let index = 0; index < starts.length; index += 1) {
    const chunk = source.slice(starts[index], starts[index + 1] ?? source.length);
    const title = chunk.match(/<h3[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!title) continue;
    const snippet = chunk.match(/<div[^>]*class=["'][^"']*\bcompText\b[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    const titleText = cleanHtml(title[2]);
    const snippetText = cleanHtml(snippet?.[1] || "");
    cards.push({
      title: titleText,
      snippet: snippetText,
      text: clean(`${titleText} ${snippetText}`),
      url: unwrapYahooUrl(title[1]),
    });
  }
  return cards.slice(0, 20);
}

function cachePath(queryUrl) {
  return path.join(CACHE_DIR, `${crypto.createHash("sha1").update(`${CACHE_VERSION}:${queryUrl}`).digest("hex")}.json`);
}

async function searchYahoo(query, filter) {
  const url = new URL(YAHOO_HOST);
  url.searchParams.set("p", query);
  url.searchParams.set("fr", "sfp");
  const queryUrl = url.href;
  try {
    const cached = JSON.parse(await fsp.readFile(cachePath(queryUrl), "utf8"));
    if (cached.version === CACHE_VERSION) return cached;
  } catch {
    // Cache miss or invalid cache is handled by the normal fetch path.
  }
  const result = {
    version: CACHE_VERSION,
    provider: "yahoo-search",
    query_url: queryUrl,
    filter,
    http_status: null,
    blocked: false,
    error: null,
    results: [],
  };
  if (!CACHE_ONLY) {
    try {
      const response = await fetch(queryUrl, {
        headers: {
          "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        },
      });
      const html = await response.text();
      result.http_status = response.status;
      result.blocked = response.status === 403 || response.status === 429 || BLOCKED_PATTERN.test(html);
      result.error = result.blocked ? "Yahoo 搜尋回傳驗證或封鎖頁" : response.ok ? null : `Yahoo 搜尋 HTTP ${response.status}`;
      if (!result.blocked && response.ok) result.results = parseYahooCards(html);
    } catch (error) {
      result.error = error.message;
    }
  } else {
    result.error = "cache miss in cache-only mode";
  }
  await fsp.mkdir(CACHE_DIR, { recursive: true });
  await fsp.writeFile(cachePath(queryUrl), `${JSON.stringify(result)}\n`, "utf8");
  return result;
}

function preferredShortName(name) {
  let value = clean(name).replace(/^.*區/, "").replace(COMMON_SUFFIX_PATTERN, "").trim();
  return value.length >= 3 ? value : clean(name);
}

function queryVariants(record, cutoff) {
  const name = clean(record.name);
  const shortName = preferredShortName(name);
  const address = clean(record.address);
  const district = clean(extractDistrict(address));
  const street = clean(extractStreetName(address));
  const number = clean(extractStreetNumber(address));
  const values = [
    `${name} ${address} after:${cutoff}`,
    `${shortName} ${district} after:${cutoff}`,
  ];
  if (street && number) values.push(`${shortName} ${street}${number} after:${cutoff}`);
  return [...new Set(values.filter(Boolean))];
}

function findClosure(result, record) {
  const text = clean(`${result.title} ${result.snippet}`);
  const nameScore = nameMatchScore(text, record.name);
  const address = addressMatchInfo(text, record.address);
  if (nameScore < 2 || (!address.matched && !address.district_only && nameScore < 3)) return null;
  const pattern = new RegExp(CLOSED_STATUS_PATTERN.source, "gi");
  for (const match of text.matchAll(pattern)) {
    const start = Math.max(0, match.index - 220);
    const context = text.slice(start, Math.min(text.length, match.index + 260));
    const before = context.slice(0, match.index - start);
    if (/(?:沒有|並沒有|未|不是|並非|尚未|不會|仍未)\s*$/i.test(before)) continue;
    if (/(?:\d+\s*年前|防疫|疫情|暫停營業至|暫時關閉至|恢復營業|再相見|公休|曾經?歇業|過去歇業)/i.test(context)) continue;
    return { marker: match[1], context, result };
  }
  return null;
}

function matchedResults(searchResult, record) {
  const matches = [];
  for (const result of searchResult.results || []) {
    const score = nameMatchScore(result.text, record.name);
    const address = addressMatchInfo(result.text, record.address);
    const matched = score >= 2 && (address.matched || address.district_only || score >= 3);
    if (matched) matches.push({ result, address, score });
  }
  const closure = matches.map(({ result }) => findClosure(result, record)).find(Boolean) || null;
  return { matches, closure };
}

async function searchVariants(record, cutoff, filter) {
  const attempts = [];
  const collected = [];
  const variants = queryVariants(record, cutoff);
  let anyAvailable = false;
  for (const query of variants) {
    const result = await searchYahoo(query, filter);
    attempts.push(result);
    if (!result.blocked && !result.error) {
      anyAvailable = true;
      collected.push(...result.results);
    }
    const aggregate = {
      ...result,
      query_url: attempts[0]?.query_url || result.query_url,
      query_urls: attempts.map((item) => item.query_url),
      results: [...new Map(collected.map((item) => [`${item.url}\n${item.title}`, item])).values()],
      blocked: !anyAvailable,
      complete: false,
      error: anyAvailable ? null : (attempts.find((item) => item.error)?.error || "Yahoo 搜尋不可用"),
    };
    const matched = matchedResults(aggregate, record);
    if (matched.matches.length || matched.closure) return aggregate;
    if (DELAY_MS) await sleep(DELAY_MS);
  }
  const final = attempts[attempts.length - 1] || { query_url: null, results: [] };
  return {
    ...final,
    query_url: attempts[0]?.query_url || final.query_url,
    query_urls: attempts.map((item) => item.query_url),
    results: [...new Map(collected.map((item) => [`${item.url}\n${item.title}`, item])).values()],
    blocked: !anyAvailable,
    complete: attempts.length === variants.length && attempts.every((item) => !item.blocked && !item.error),
    error: anyAvailable ? null : (attempts.find((item) => item.error)?.error || "Yahoo 搜尋不可用"),
  };
}

function parseMinutes(hour, minute, meridiem) {
  let value = Number(hour) * 60 + Number(minute || 0);
  if (!Number.isFinite(value)) return null;
  if ((meridiem === "下午" || meridiem === "晚上" || /^pm$/i.test(meridiem)) && Number(hour) < 12) value += 720;
  if ((meridiem === "上午" || meridiem === "早上" || /^am$/i.test(meridiem)) && Number(hour) === 12) value -= 720;
  return value;
}

function extractHours(text) {
  const normalized = String(text || "")
    .replace(/[–—~～至]/g, "-")
    .replace(/(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2})點半/gi, (_, m, h) => `${m || ""}${h}:30`)
    .replace(/(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2})點/gi, (_, m, h) => `${m || ""}${h}:00`)
    .replace(/(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2})時/gi, (_, m, h) => `${m || ""}${h}:00`);
  const intervals = [];
  const pattern = /(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2}):?(\d{2})\s*-\s*(上午|下午|早上|晚上|AM|PM)?\s*(\d{1,2}):?(\d{2})/gi;
  for (const match of normalized.matchAll(pattern)) {
    const start = parseMinutes(match[2], match[3], match[1]);
    const endRaw = parseMinutes(match[5], match[6], match[4]);
    if (start === null || endRaw === null) continue;
    intervals.push({ start, end: endRaw <= start ? endRaw + 1440 : endRaw });
  }
  if (!intervals.length) return null;
  const open = Math.min(...intervals.map((item) => item.start));
  const close = Math.max(...intervals.map((item) => item.end));
  const format = (value) => `${String(Math.floor((value % 1440) / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const averageOpen = format(open);
  const averageClose = format(close);
  return {
    average_open_time: averageOpen,
    average_close_time: averageClose,
    display: `約 ${averageOpen}–${averageClose}`,
    source: "Yahoo 搜尋結果摘要",
    open_days_considered: 1,
  };
}

function buildHours(record, matches) {
  if (record.business_hours?.average_open_time && record.business_hours?.average_close_time) return record.business_hours;
  for (const item of matches) {
    const hours = extractHours(item.result.text);
    if (hours) return hours;
  }
  return record.business_hours || {
    average_open_time: null,
    average_close_time: null,
    display: null,
    source: null,
    open_days_considered: 0,
    note: "已檢查公開來源，但未找到可可靠解析的營業時間；未以今日是否營業推估。",
  };
}

function dateMonthsAgo(months) {
  const [year, month, day] = TODAY.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

function sourceUrls(results) {
  return [...new Set(results.flatMap((item) => item.query_urls || [item.query_url]).filter(Boolean))];
}

function recordSourceKind(record) {
  const sourceId = String(record.source_id || "");
  if (sourceId.startsWith("ifoodie-")) return "ifoodie";
  if (sourceId.startsWith("googlemaps-")) return "googlemaps";
  if (!sourceId) return "none";
  return "other";
}

function directSourceUrls(record) {
  const kind = recordSourceKind(record);
  const sources = (record.sources || []).filter((value) => /^https?:\/\//i.test(value));
  if (kind === "ifoodie") return sources.filter((value) => /ifoodie\.tw\/restaurant\//i.test(value));
  if (kind === "googlemaps") return sources.filter((value) => /google\.com\/maps\//i.test(value));
  return sources;
}

function extractHtmlTitle(html) {
  return cleanHtml(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function directResultCachePath(record) {
  const key = `${TODAY}:${record.source_id || ""}:${record.id || ""}:${record.name || ""}:${record.address || ""}`;
  return path.join(DIRECT_RESULT_CACHE_DIR, `${crypto.createHash("sha1").update(key).digest("hex")}.json`);
}

async function verifyDirectRecordUncached(record) {
  const urls = directSourceUrls(record);
  const attempted = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        },
      });
      const html = await response.text();
      attempted.push({ url, status: response.status, length: html.length });
      if (!response.ok || html.length < 500) continue;
      const title = extractHtmlTitle(html);
      const firstText = cleanHtml(html.slice(0, 80_000));
      const evidenceText = `${title} ${firstText}`;
      const nameMatch = nameMatchScore(evidenceText, record.name);
      const addressMatch = addressMatchInfo(evidenceText, record.address);
      const isGoogleMaps = /google\.com\/maps\//i.test(url);
      const relevant = nameMatch >= 2 && (addressMatch.matched || addressMatch.district_only || isGoogleMaps || nameMatch >= 3);
      if (!relevant) continue;
      const closure = findClosure({ title, snippet: firstText.slice(0, 20_000), text: evidenceText, url }, record);
      if (closure) return {
        keep: false,
        removal: {
          source_id: record.source_id, id: record.id, name: record.name, address: record.address,
          reason: `既有公開來源頁面明確標示「${closure.marker}」`,
          source: url, checked_at: TODAY, original: record,
        },
      };
      const reason = `已於 ${TODAY} 讀取既有公開店家頁面，頁面仍可取得與店名相符的資料，未發現明確歇業、停業中或永久關閉標記。`;
      return {
        keep: true,
        record: {
          ...record,
          operation_status: "operating",
          operation_status_checked_at: TODAY,
          operation_status_sources: [...new Set([...(record.operation_status_sources || []), url])],
          operation_status_reason: reason,
          operation_status_fallback_checked_at: TODAY,
          operation_status_fallback_provider: "既有公開店家頁面直連",
          operation_status_fallback_freshness: "within_1_month",
          operation_status_fallback_sources: [url],
          business_hours: buildHours(record, [{ result: { text: evidenceText } }]),
          store_status_check: reason,
        },
      };
    } catch (error) {
      attempted.push({ url, error: error.message });
    }
  }
  return {
    keep: true,
    record: buildUncertain(record, attempted.map((item) => ({ query_url: item.url })), "既有公開來源頁面目前無法取得或缺少可辨識店家資料；未依半年無資料規則移除。"),
  };
}

async function verifyDirectRecord(record) {
  const resultPath = directResultCachePath(record);
  try {
    const cached = JSON.parse(await fsp.readFile(resultPath, "utf8"));
    if (cached.version === CACHE_VERSION) return cached.result;
  } catch {
    // Cache miss or invalid cache is handled by the normal direct-verification path.
  }
  if (CACHE_ONLY) {
    return {
      keep: true,
      record: buildUncertain(record, [{ query_url: directSourceUrls(record)[0] }], "直連驗證快取不存在；未在離線套用階段自行判定。"),
    };
  }
  const result = await verifyDirectRecordUncached(record);
  await fsp.mkdir(DIRECT_RESULT_CACHE_DIR, { recursive: true });
  await fsp.writeFile(resultPath, `${JSON.stringify({ version: CACHE_VERSION, result })}\n`, "utf8");
  return result;
}

function buildOperating(record, freshness, results, matches) {
  const urls = sourceUrls(results);
  const freshnessText = freshness === "within_1_month"
    ? "近一個月內"
    : "近六個月內（近一個月未取得更明確的新資料）";
  const reason = `替代搜尋在${freshnessText}找到與店名相符的公開資料，未發現明確歇業、停業中或永久關閉標記。`;
  return {
    ...record,
    operation_status: "operating",
    operation_status_checked_at: TODAY,
    operation_status_sources: [...new Set([...(record.operation_status_sources || []), ...urls])],
    operation_status_reason: reason,
    operation_status_fallback_checked_at: TODAY,
    operation_status_fallback_provider: "Yahoo 搜尋",
    operation_status_fallback_freshness: freshness,
    operation_status_fallback_sources: urls,
    business_hours: buildHours(record, matches),
    store_status_check: `已於 ${TODAY} 使用 Yahoo 替代搜尋檢查；${reason}`,
  };
}

function buildUncertain(record, results, reason) {
  const urls = sourceUrls(results);
  return {
    ...record,
    operation_status: "uncertain",
    operation_status_checked_at: TODAY,
    operation_status_sources: [...new Set([...(record.operation_status_sources || []), ...urls])],
    operation_status_reason: reason,
    operation_status_fallback_checked_at: TODAY,
    operation_status_fallback_provider: "Yahoo 搜尋",
    operation_status_fallback_freshness: "unavailable",
    operation_status_fallback_sources: urls,
    store_status_check: `已於 ${TODAY} 嘗試 Yahoo 替代搜尋，但查詢服務錯誤、驗證或結果不完整；未依半年無資料規則移除。`,
  };
}

function buildFdaOperating(record) {
  const reason = "食藥署最新公開餐飲場所資料仍收錄此食品業者登錄字號；本次未發現撤銷或停業標記，先視為有登錄營運證據。";
  return {
    ...record,
    operation_status: "operating",
    operation_status_checked_at: TODAY,
    operation_status_sources: [...new Set([...(record.operation_status_sources || []), FDA_SOURCE_URL])],
    operation_status_reason: reason,
    operation_status_fallback_checked_at: TODAY,
    operation_status_fallback_provider: "食藥署最新公開資料",
    operation_status_fallback_freshness: "within_1_month",
    operation_status_fallback_sources: [FDA_SOURCE_URL],
    store_status_check: `已於 ${TODAY} 比對食藥署最新公開餐飲場所資料；${reason}`,
  };
}

async function verifyRecord(record) {
  if (DIRECT_ONLY) return verifyDirectRecord(record);
  const fdaId = String(record.source_id || "");
  if (fdaIndex?.has(fdaId.replace(/^fda-/, ""))) return { keep: true, record: buildFdaOperating(record) };
  const recent = await searchVariants(record, dateMonthsAgo(1), "within_1_month");
  const recentMatch = matchedResults(recent, record);
  const resultSets = [recent];
  if (recentMatch.closure) return {
    keep: false,
    removal: {
      source_id: record.source_id, id: record.id, name: record.name, address: record.address,
      reason: `Yahoo 搜尋近一個月結果明確標示「${recentMatch.closure.marker}」`,
      source: recentMatch.closure.result.url || recent.query_url, checked_at: TODAY, original: record,
    },
  };
  if (recentMatch.matches.length) return { keep: true, record: buildOperating(record, "within_1_month", resultSets, recentMatch.matches) };

  const sixMonth = await searchVariants(record, dateMonthsAgo(6), "within_6_months");
  resultSets.push(sixMonth);
  const sixMonthMatch = matchedResults(sixMonth, record);
  if (sixMonthMatch.closure) return {
    keep: false,
    removal: {
      source_id: record.source_id, id: record.id, name: record.name, address: record.address,
      reason: `Yahoo 搜尋近六個月結果明確標示「${sixMonthMatch.closure.marker}」`,
      source: sixMonthMatch.closure.result.url || sixMonth.query_url, checked_at: TODAY, original: record,
    },
  };
  if (sixMonthMatch.matches.length) return { keep: true, record: buildOperating(record, "within_6_months", resultSets, sixMonthMatch.matches) };
  if (!sixMonth.complete || sixMonth.blocked || sixMonth.error) {
    return { keep: true, record: buildUncertain(record, resultSets, "半年查詢有技術錯誤或結果不完整，不能確認為半年內完全無資料。") };
  }
  return {
    keep: false,
    removal: {
      source_id: record.source_id, id: record.id, name: record.name, address: record.address,
      reason: "替代搜尋在近六個月內成功完成查詢，但沒有找到可辨識的店名或地址資料；依規則移除。",
      source: sixMonth.query_url, checked_at: TODAY, original: record,
    },
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

function mergeRemoval(removals, removal) {
  const key = `${removal.source_id || ""}:${removal.id || ""}`;
  const index = removals.findIndex((item) => `${item.source_id || ""}:${item.id || ""}` === key);
  if (index >= 0) removals[index] = removal;
  else removals.push(removal);
}

async function main() {
  const allFiles = (await fsp.readdir(DATA_DIR)).filter((file) => file.endsWith("-restaurants.json")).sort();
  const files = filesToProcess(allFiles);
  const removals = fs.existsSync(REMOVALS_PATH) ? JSON.parse(fs.readFileSync(REMOVALS_PATH, "utf8")) : [];
  const report = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) : { checked_at: TODAY, provider: "yahoo-search", files: {}, totals: {} };
  fdaIndex = loadFdaIndex();
  console.log(JSON.stringify({ event: "fda_index_loaded", path: FDA_DATA_PATH, records: fdaIndex.size }));
  const stats = { files: 0, candidates: 0, checked: 0, kept: 0, removed: 0, fda_matches: 0, recent_matches: 0, six_month_matches: 0, unavailable: 0, hours_found: 0, hours_missing: 0 };
  let remaining = LIMIT;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex];
    const filePath = path.join(DATA_DIR, file);
    const document = JSON.parse(await fsp.readFile(filePath, "utf8"));
    const originalRestaurants = document.restaurants || [];
    const allCandidates = originalRestaurants
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => record.operation_status === "uncertain")
      .filter(({ record }) => !FDA_ONLY || String(record.source_id || "").startsWith("fda-"));
    const filteredCandidates = DIRECT_ONLY
      ? allCandidates.filter(({ record }) => ["ifoodie", "googlemaps", "none"].includes(recordSourceKind(record)))
      : allCandidates;
    const candidates = remaining === null ? filteredCandidates : filteredCandidates.slice(0, remaining);
    if (!candidates.length) continue;
    stats.files += 1;
    stats.candidates += candidates.length;
    if (remaining !== null) remaining -= candidates.length;
    const results = new Map();
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const candidate = candidates[cursor++];
        if (!candidate) return;
        const result = await verifyRecord(candidate.record);
        results.set(candidate.index, result);
        stats.checked += 1;
        if (result.keep) {
          stats.kept += 1;
          if (String(candidate.record.source_id || "").startsWith("fda-") && fdaIndex.has(String(candidate.record.source_id).replace(/^fda-/, ""))) stats.fda_matches += 1;
          else if (result.record.operation_status_fallback_freshness === "within_1_month") stats.recent_matches += 1;
          else if (result.record.operation_status_fallback_freshness === "within_6_months") stats.six_month_matches += 1;
          else stats.unavailable += 1;
          if (result.record.business_hours?.average_open_time && result.record.business_hours?.average_close_time) stats.hours_found += 1;
          else stats.hours_missing += 1;
        } else {
          stats.removed += 1;
          mergeRemoval(removals, result.removal);
        }
        if (stats.checked % 25 === 0 || stats.checked === stats.candidates) console.log(JSON.stringify({ event: "fallback_progress", file, file_index: fileIndex + 1, files: files.length, checked: stats.checked, candidates: stats.candidates, removed: stats.removed }));
        if (DELAY_MS) await sleep(DELAY_MS);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    const nextRestaurants = originalRestaurants.reduce((list, record, index) => {
      const result = results.get(index);
      if (!result || result.keep) list.push(result?.record || record);
      return list;
    }, []);
    const fileStats = {
      checked: candidates.length,
      kept: candidates.filter(({ index }) => results.get(index)?.keep).length,
      removed: candidates.filter(({ index }) => !results.get(index)?.keep).length,
      recent_matches: candidates.filter(({ index }) => results.get(index)?.record?.operation_status_fallback_freshness === "within_1_month").length,
      six_month_matches: candidates.filter(({ index }) => results.get(index)?.record?.operation_status_fallback_freshness === "within_6_months").length,
      unavailable: candidates.filter(({ index }) => results.get(index)?.record?.operation_status_fallback_freshness === "unavailable").length,
      before: originalRestaurants.length,
      after: nextRestaurants.length,
    };
    const nextDocument = {
      ...document,
      collection: {
        ...(document.collection || {}),
        operation_status_checked_at: TODAY,
        operation_status_provider: "Yahoo 搜尋替代 Google；食藥署最新資料、官方資料與公開店家頁面",
        operation_status_fallback_checked_at: TODAY,
        operation_status_fallback_note: "Google 搜尋受限時使用 Yahoo 搜尋。近一個月找到店名相符資料且未見停業標記先通過；近六個月找到資料但非近一個月保留；成功完成半年查詢且完全找不到可辨識資料才移除。搜尋驗證或技術錯誤時不作移除。",
        record_count: nextRestaurants.length,
        record_count_before_fallback_search: originalRestaurants.length,
        record_count_after_fallback_search: nextRestaurants.length,
        record_count_after_operation_check: nextRestaurants.length,
      },
      restaurants: nextRestaurants,
    };
    if (SHOULD_WRITE) await writeJsonAtomic(filePath, nextDocument);
    report.files[file] = { checked_at: TODAY, provider: "yahoo-search", ...fileStats };
    report.totals = Object.values(report.files).reduce((sum, value) => {
      sum.files = (sum.files || 0) + 1;
      for (const key of ["checked", "kept", "removed", "recent_matches", "six_month_matches", "unavailable"]) sum[key] = (sum[key] || 0) + (value[key] || 0);
      return sum;
    }, {});
    if (SHOULD_WRITE) {
      await writeJsonAtomic(REPORT_PATH, report);
      await writeJsonAtomic(REMOVALS_PATH, removals);
    }
    console.log(JSON.stringify({ event: "fallback_file_complete", file, file_index: fileIndex + 1, files: files.length, ...fileStats }));
    if (remaining === 0) break;
  }
  console.log(JSON.stringify({ event: "fallback_complete", mode: SHOULD_WRITE ? "write" : "dry-run", ...stats }));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
