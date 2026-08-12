const { normalizeUrl } = require("./web-research-sources.cjs");

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

function textFromHtml(html) {
  return cleanText(decodeHtml(String(html)
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")));
}

function titleFromHtml(html) {
  return cleanText(decodeHtml(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? ""));
}

function searchItems(body) {
  if (Array.isArray(body)) return body;
  return body?.results
    ?? body?.organic_results
    ?? body?.webPages?.value
    ?? body?.items
    ?? [];
}

function normalizeSearchResponse(body) {
  return searchItems(body).map((item) => ({
    url: item?.url ?? item?.link ?? item?.displayLink,
    title: item?.title ?? item?.name,
    snippet: item?.snippet ?? item?.description ?? item?.content,
    sourceTier: item?.sourceTier,
    sourceKind: item?.sourceKind,
  })).filter((item) => normalizeUrl(item.url) && cleanText(item.title));
}

function headersFor(apiKey) {
  return {
    accept: "application/json",
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
}

function createHttpSearchImpl({ endpoint = process.env.WEB_SEARCH_ENDPOINT, apiKey = process.env.WEB_SEARCH_API_KEY, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required");
  if (!endpoint) throw new Error("WEB_SEARCH_ENDPOINT or endpoint is required");
  return async function search(query) {
    const url = new globalThis.URL(endpoint);
    url.searchParams.set("q", String(query));
    const response = await fetchImpl(url, { headers: headersFor(apiKey) });
    if (!response || !response.ok) throw new Error(`search provider returned HTTP ${response?.status ?? "unknown"}`);
    return normalizeSearchResponse(await response.json());
  };
}

function createHttpPageFetcher({ fetchImpl = globalThis.fetch, userAgent = "JAZAMILA-cuisine-research/1.0" } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required");
  return async function fetchPage(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) throw new Error("page URL must be http or https");
    const response = await fetchImpl(normalized, {
      headers: { accept: "text/html, text/plain;q=0.9", "user-agent": userAgent },
    });
    if (!response || !response.ok) throw new Error(`page provider returned HTTP ${response?.status ?? "unknown"}`);
    const html = await response.text();
    const content = textFromHtml(html).slice(0, 200000);
    return {
      url: normalized,
      title: titleFromHtml(html),
      content,
      sourceKind: "other",
    };
  };
}

module.exports = {
  createHttpPageFetcher,
  createHttpSearchImpl,
  decodeHtml,
  normalizeSearchResponse,
  textFromHtml,
  titleFromHtml,
};
