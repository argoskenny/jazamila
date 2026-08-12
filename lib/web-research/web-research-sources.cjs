const crypto = require("node:crypto");
const { taxonomy } = require("../domain/deterministic-cuisine-classifier.cjs");
const {
  cleanText,
  normalizeKey,
  normalizePhone,
  uniqueText,
} = require("./web-research-eligibility.cjs");

const SOURCE_TIER_DEFINITIONS = {
  1: "official_website_or_menu",
  2: "official_social",
  3: "address_identifiable_shop_page",
  4: "reliable_restaurant_platform",
  5: "general_article_or_other",
};

const SOURCE_KIND_TO_TIER = {
  official_website: 1,
  official_menu: 1,
  official_social: 2,
  address_listing: 3,
  reliable_platform: 4,
  article: 5,
  other: 5,
};

function normalizeUrl(value) {
  try {
    const url = new globalThis.URL(String(value));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sourceTierFor({ sourceTier, sourceKind } = {}) {
  if (Number.isInteger(Number(sourceTier)) && Number(sourceTier) >= 1 && Number(sourceTier) <= 5) {
    return Number(sourceTier);
  }
  return SOURCE_KIND_TO_TIER[cleanText(sourceKind)] ?? 5;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function auxiliaryCanonical(value) {
  const key = normalizeKey(value);
  const definition = taxonomy.auxiliaryTags.find((candidate) =>
    candidate.aliases.some((alias) => normalizeKey(alias) && key.includes(normalizeKey(alias)))
  );
  return definition?.name ?? null;
}

function identityMatchForContent({ input, content, explicit = {} }) {
  const bodyKey = normalizeKey(content);
  const inputName = normalizeKey(input.name);
  const inputAddress = normalizeKey(input.address);
  const inputPhone = normalizePhone(input.phone);
  const name = explicit.matchedName !== undefined
    ? Boolean(explicit.matchedName)
    : Boolean(inputName && bodyKey.includes(inputName));
  const address = explicit.matchedAddress !== undefined
    ? Boolean(explicit.matchedAddress)
    : Boolean(inputAddress && bodyKey.includes(inputAddress));
  const phone = inputPhone
    ? explicit.matchedPhone !== undefined
      ? Boolean(explicit.matchedPhone)
      : Boolean(normalizePhone(content).includes(inputPhone))
    : true;
  const weights = inputPhone ? { name: 0.4, address: 0.4, phone: 0.2 } : { name: 0.5, address: 0.5 };
  const score = (name ? weights.name : 0) + (address ? weights.address : 0) + (phone ? (weights.phone ?? 0) : 0);
  return { name, address, phone, score };
}

function normalizeSearchHit(hit, query) {
  const url = normalizeUrl(hit?.url ?? hit?.link);
  if (!url || !cleanText(hit?.title)) return null;
  return {
    query,
    url,
    title: cleanText(hit.title),
    snippet: cleanText(hit.snippet),
    sourceTier: sourceTierFor(hit),
    sourceKind: cleanText(hit.sourceKind) || SOURCE_TIER_DEFINITIONS[sourceTierFor(hit)],
  };
}

function normalizeFetchedSource({ hit, page, input, retrievedAt }) {
  const content = cleanText(page?.content ?? page?.text ?? page?.bodyText);
  const url = normalizeUrl(page?.canonicalUrl ?? page?.url ?? hit.url);
  if (!url || !content) return null;
  const sourceTier = sourceTierFor(page ?? hit);
  const sourceKind = cleanText(page?.sourceKind ?? hit.sourceKind) || SOURCE_TIER_DEFINITIONS[sourceTier];
  const explicitIdentity = {
    matchedName: page?.matchedName,
    matchedAddress: page?.matchedAddress,
    matchedPhone: page?.matchedPhone,
  };
  const identityMatch = identityMatchForContent({ input, content, explicit: explicitIdentity });
  const supportedTags = uniqueText(
    (Array.isArray(page?.supportedTags) ? page.supportedTags : [])
      .map(auxiliaryCanonical)
      .filter(Boolean)
  );
  return {
    url,
    title: cleanText(page?.title ?? hit.title),
    sourceTier,
    sourceKind,
    contentHash: sha256(content),
    content,
    retrievedAt,
    matchedName: page?.matchedName ?? (identityMatch.name ? input.name : null),
    matchedAddress: page?.matchedAddress ?? (identityMatch.address ? input.address : null),
    matchedPhone: page?.matchedPhone ?? (identityMatch.phone && input.phone ? input.phone : null),
    identityMatch,
    supportedTags,
    cuisineSignals: uniqueText(page?.cuisineSignals),
    cuisineTypeCodes: uniqueText(page?.cuisineTypeCodes),
    fetched: true,
  };
}

async function collectFetchedEvidence({
  input,
  searchQueries,
  searchImpl,
  fetchImpl,
  maxResultsPerQuery = 5,
  clock = () => new Date(),
}) {
  if (typeof searchImpl !== "function") throw new Error("searchImpl is required");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required");
  const hitsByUrl = new Map();
  const searchErrors = [];
  for (const query of Array.isArray(searchQueries) ? searchQueries : []) {
    try {
      const hits = await searchImpl(query);
      for (const hit of (Array.isArray(hits) ? hits : []).slice(0, maxResultsPerQuery)) {
        const normalized = normalizeSearchHit(hit, query);
        if (normalized && !hitsByUrl.has(normalized.url)) hitsByUrl.set(normalized.url, normalized);
      }
    } catch (error) {
      searchErrors.push({ query, error: error instanceof Error ? error.message : "search failed" });
    }
  }

  const fetchedSources = [];
  const fetchErrors = [];
  for (const hit of hitsByUrl.values()) {
    try {
      const page = await fetchImpl(hit.url);
      const source = normalizeFetchedSource({
        hit,
        page,
        input,
        retrievedAt: new Date(clock()).toISOString(),
      });
      if (source) fetchedSources.push(source);
      else fetchErrors.push({ url: hit.url, error: "page has no fetched content" });
    } catch (error) {
      fetchErrors.push({ url: hit.url, error: error instanceof Error ? error.message : "page fetch failed" });
    }
  }
  return {
    searchHits: [...hitsByUrl.values()],
    fetchedSources,
    searchErrors,
    fetchErrors,
  };
}

function publicEvidence(source) {
  return {
    url: source.url,
    title: source.title,
    sourceTier: source.sourceTier,
    sourceKind: source.sourceKind,
    matchedName: source.matchedName,
    matchedAddress: source.matchedAddress,
    matchedPhone: source.matchedPhone,
    contentHash: source.contentHash,
    supportedTags: source.supportedTags,
    cuisineSignals: source.cuisineSignals,
  };
}

function sourceConflict(fetchedSources) {
  const typeCodes = new Set((Array.isArray(fetchedSources) ? fetchedSources : [])
    .filter((source) => source.identityMatch?.name && source.identityMatch?.address)
    .flatMap((source) => source.cuisineTypeCodes ?? [])
    .map(normalizeKey)
    .filter(Boolean));
  return typeCodes.size > 1;
}

module.exports = {
  SOURCE_KIND_TO_TIER,
  SOURCE_TIER_DEFINITIONS,
  collectFetchedEvidence,
  identityMatchForContent,
  normalizeFetchedSource,
  normalizeSearchHit,
  normalizeUrl,
  publicEvidence,
  sha256,
  sourceConflict,
  sourceTierFor,
};
