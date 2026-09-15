const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { setTimeout: sleep } = require("node:timers/promises");

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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberFrom(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function mapWithConcurrency(items, worker, concurrency) {
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

function sectionHtml(html, heading) {
  const marker = `<h2 class="sectionTitle">${heading}</h2>`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const remainder = html.slice(start + marker.length);
  const end = remainder.indexOf("</section>");
  return end >= 0 ? remainder.slice(0, end) : remainder.slice(0, 20000);
}

function extractPriceValues(html, cleanText) {
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

function extractPopularFoods(html, cleanText) {
  const block = html.match(/<div class="foodNameBlock">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] || "";
  const foods = [];
  for (const match of block.matchAll(/<span[^>]+class=["'][^"']*item[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)) {
    const food = cleanText(match[1]).replace(/^\d+\.\s*/, "");
    if (food) foods.push(food);
  }
  return unique(foods);
}

function extractReviewExcerpt(html, cleanText) {
  const match = html.match(/<div class="summary">([\s\S]*?)<\/div>/i);
  if (!match) return "";
  const summary = cleanText(match[1]).replace(/\(詳全文\)$/, "");
  return summary.length > 100 ? `${summary.slice(0, 100)}…` : summary;
}

function createPageFetcher({ cacheDir, requestDelayMs }) {
  let nextRequestAt = 0;
  return async function fetchPage(url) {
    const cacheFile = path.join(cacheDir, `${crypto.createHash("sha1").update(url).digest("hex")}.html`);
    try {
      return await fs.readFile(cacheFile, "utf8");
    } catch {
      // Cache miss; fetch below.
    }

    const wait = Math.max(0, nextRequestAt - Date.now());
    if (wait > 0) await sleep(wait);
    nextRequestAt = Date.now() + requestDelayMs;

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
  };
}

module.exports = {
  createPageFetcher,
  decodeEntities,
  unique,
  numberFrom,
  mapWithConcurrency,
  sectionHtml,
  extractPriceValues,
  estimatePriceRange,
  extractPopularFoods,
  extractReviewExcerpt,
};
