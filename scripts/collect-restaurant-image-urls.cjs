#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "res_data");
const CACHE_DIR = process.env.FONFOOD_CACHE_DIR || "/private/tmp/jazamila-fonfood-cache";
const SHOULD_WRITE = process.argv.includes("--write");
const USE_NETWORK = process.argv.includes("--network");
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

const SKIP_NETWORK_HOSTS = new Set([
  "data.gov.tw",
  "data.fda.gov.tw",
  "data.gcis.nat.gov.tw",
  "eip.fia.gov.tw",
  "media.taiwan.net.tw",
  "www.google.com",
]);

function clean(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cachePath(url) {
  return path.join(CACHE_DIR, `${crypto.createHash("sha1").update(url).digest("hex")}.html`);
}

function isExplicitlyProhibited(html) {
  return /禁止\s*(?:外部引用|外連|外鏈|盜連|盗链|転載)|(?:do\s+not|no)\s+(?:hotlink|externally\s+(?:link|use))|hotlink(?:ing)?\s*(?:is\s*)?(?:prohibited|disabled|not\s+allowed)/i.test(html);
}

function absoluteUrl(value, sourceUrl) {
  try {
    const url = new URL(String(value), sourceUrl);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function isGenericImage(url) {
  const lower = url.toLowerCase();
  return /(?:\/|%2f)(?:logo|search|arrow|icon|avatar|placeholder|default)[^/]*(?:\.|$)/i.test(lower)
    || lower.includes("/img/logo_")
    || lower.includes("/img/search_");
}

function imageUrlCandidates(html, sourceUrl) {
  const candidates = [];
  const jsonLdBlocks = [];
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed = JSON.parse(decodeEntities(match[1].trim()));
      jsonLdBlocks.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Some pages contain malformed JSON-LD; continue with other image tags.
    }
  }
  for (const block of jsonLdBlocks) {
    if (!block || typeof block !== "object") continue;
    const types = Array.isArray(block["@type"]) ? block["@type"] : [block["@type"]];
    if (!types.some((type) => String(type).toLowerCase() === "restaurant")) continue;
    const images = Array.isArray(block.image) ? block.image : [block.image];
    for (const image of images) {
      const value = typeof image === "string" ? image : image?.url;
      const url = absoluteUrl(value, sourceUrl);
      if (url && !isGenericImage(url)) candidates.push({ url, type: "JSON-LD Restaurant image" });
    }
  }

  for (const match of html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)) {
    const url = absoluteUrl(decodeEntities(match[1]), sourceUrl);
    if (url && !isGenericImage(url)) candidates.push({ url, type: "Open Graph image" });
  }
  return [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()];
}

async function readPage(sourceUrl) {
  const localPath = cachePath(sourceUrl);
  try {
    return { html: await fsp.readFile(localPath, "utf8"), source: "cache" };
  } catch {
    // Fetch only when explicitly requested.
  }
  if (!USE_NETWORK) return null;
  let hostname;
  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
  if (SKIP_NETWORK_HOSTS.has(hostname)) return null;
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "JAZAMILA restaurant image URL collector/1.0",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    await fsp.mkdir(CACHE_DIR, { recursive: true });
    await fsp.writeFile(localPath, html, "utf8");
    return { html, source: "network" };
  } catch {
    return null;
  }
}

function isDirectImageUrl(sourceUrl) {
  return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(sourceUrl);
}

async function collectForRestaurant(restaurant) {
  const sources = Array.isArray(restaurant.sources) ? restaurant.sources : [];
  let sawExplicitProhibition = false;
  for (const sourceUrl of sources) {
    if (!/^https?:\/\//i.test(sourceUrl)) continue;
    if (isDirectImageUrl(sourceUrl) && !isGenericImage(sourceUrl)) {
      return {
        image_url: sourceUrl,
        image_source_url: sourceUrl,
        image_source_type: "direct image source",
        image_usage_status: "no_explicit_prohibition_found",
        image_checked_at: TODAY,
      };
    }
    const page = await readPage(sourceUrl);
    if (!page) continue;
    if (isExplicitlyProhibited(page.html)) {
      sawExplicitProhibition = true;
      continue;
    }
    const candidate = imageUrlCandidates(page.html, sourceUrl)[0];
    if (candidate) {
      return {
        image_url: candidate.url,
        image_source_url: sourceUrl,
        image_source_type: candidate.type,
        image_usage_status: "no_explicit_prohibition_found",
        image_checked_at: TODAY,
      };
    }
  }
  return {
    image_url: null,
    image_source_url: null,
    image_source_type: null,
    image_usage_status: sawExplicitProhibition ? "explicitly_prohibited" : "no_candidate_found",
    image_checked_at: TODAY,
  };
}

async function main() {
  const files = (await fsp.readdir(DATA_DIR))
    .filter((file) => file.endsWith("-restaurants.json"))
    .sort();
  const stats = {
    mode: SHOULD_WRITE ? "write" : "dry-run",
    source_mode: USE_NETWORK ? "cache plus network" : "cache only",
    files: files.length,
    records: 0,
    existing: 0,
    found: 0,
    no_candidate: 0,
    explicitly_prohibited: 0,
  };

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const document = JSON.parse(await fsp.readFile(filePath, "utf8"));
    let changed = false;
    for (const restaurant of document.restaurants || []) {
      stats.records += 1;
      if (restaurant.image_url && restaurant.image_usage_status !== "explicitly_prohibited") {
        stats.existing += 1;
        continue;
      }
      const image = await collectForRestaurant(restaurant);
      if (image.image_url) stats.found += 1;
      else if (image.image_usage_status === "explicitly_prohibited") stats.explicitly_prohibited += 1;
      else stats.no_candidate += 1;
      for (const [key, value] of Object.entries(image)) {
        if (restaurant[key] !== value) {
          restaurant[key] = value;
          changed = true;
        }
      }
    }
    document.collection = {
      ...(document.collection || {}),
      image_collection_note: "每家最多保留一張公開圖片網址；只跳過來源頁面明文禁止外部引用或明確拒絕的來源，不下載圖片。未發現明文禁止不等同於取得圖片著作權授權；收到下架通知時應移除網址。",
    };
    if (changed && SHOULD_WRITE) await fsp.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
