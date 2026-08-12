const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const DATASET_PREFIX = "res-data:v2:";
const LEGACY_DATASET_PREFIXES = ["res-data:v1:"];
const DEFAULT_MAX_PRICE_TWD = 10_000;
const DEFAULT_BATCH_SIZE = 100;
const MAX_REVIEW_SUMMARIES_PER_RESTAURANT = 4;
const REPEATED_REVIEW_SUMMARY_RESTAURANT_THRESHOLD = 2;

const REVIEW_SUMMARY_NOISE_PATTERNS = [
  /未提供.{0,20}(?:網路)?(?:評分|評論|摘要)/u,
  /(?:食品業者登錄|營業\(稅籍\)登記|商業登記|觀光資訊資料庫).{0,30}基本資料/u,
  /(?:愛食記|iFoodie).{0,20}列表顯示.{0,30}(?:分|評論)/iu,
  /^(?:評分相對本批|評分中等|目前可見的iFoodie)/iu,
  /^(?:上一篇|下一篇|回上一頁|返回列表|延伸閱讀|相關文章|更多文章)/u,
  /(?:copyright|版權所有|網站導覽|隱私權政策)/iu,
  /https?:\/\//iu,
];

const CITY_METADATA = {
  "台北市": { code: "taipei", legacyRegion: 1 },
  "新北市": { code: "newtaipei", legacyRegion: 2 },
  "桃園市": { code: "taoyuan", legacyRegion: 3 },
  "臺中市": { code: "taichung", legacyRegion: 4 },
  "臺南市": { code: "tainan", legacyRegion: 5 },
  "高雄市": { code: "kaohsiung", legacyRegion: 6 },
  "基隆市": { code: "keelung", legacyRegion: 7 },
  "新竹市": { code: "hsinchu-city", legacyRegion: 8 },
  "嘉義市": { code: "chiayi-city", legacyRegion: 9 },
};

function cleanText(value) {
  const withoutControls = [...String(value ?? "").normalize("NFKC")]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("");
  return withoutControls
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalCity(value) {
  return cleanText(value).replace(/台(?=中市|南市)/g, "臺");
}

function normalizeNameKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[\s，,。．.、；;：:「」『』（）()【】《》〈〉“”‘’'"!?！？\-–—_／/\\]/g, "");
}

function normalizeAddressKey(value) {
  return canonicalCity(value)
    .toLowerCase()
    .replace(/^\d{3,5}(?=[^0-9])/, "")
    // House-number separators are meaningful: 31-1 must never collapse into 311.
    .replace(/[\s，,。．.、；;：:「」『』（）()【】《》〈〉“”‘’'"!?！？–—_]/g, "");
}

function normalizeDisplayAddress(value, cityName, districtName) {
  const city = canonicalCity(cityName);
  const district = cleanText(districtName);
  let remainder = cleanText(value)
    .replace(/^\d{3,5}(?=[^0-9])\s*/u, "")
    .replace(/[，,]\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const cityVariants = [...new Set([city, city.replace(/^臺/u, "台"), city.replace(/^台/u, "臺")])].filter(Boolean);
  const prefixes = [...cityVariants, district].sort((left, right) => right.length - left.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (prefix && remainder.startsWith(prefix)) {
        remainder = remainder.slice(prefix.length).trim();
        changed = true;
        break;
      }
    }
  }
  remainder = remainder.replace(/(?:臺灣|台灣)\s*\d{3,5}$/u, "").trim();
  return `${city}${district}${remainder}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableImportKey(datasetId) {
  const normalizedId = cleanText(datasetId);
  if (!normalizedId) throw new Error("dataset id is required for a stable import key");
  return `${DATASET_PREFIX}${hash(normalizedId)}`;
}

function nameAddressKey(name, address) {
  return hash(`${normalizeNameKey(name)}\n${normalizeAddressKey(address)}`);
}

function isOwnedImportKey(importKey) {
  return typeof importKey === "string"
    && [DATASET_PREFIX, ...LEGACY_DATASET_PREFIXES].some((prefix) => importKey.startsWith(prefix));
}

function restaurantIdentityKey(address, phone) {
  const addressKey = normalizeAddressKey(address);
  const phoneKey = normalizePhoneDigits(phone);
  return addressKey && phoneKey ? `${addressKey}|${phoneKey}` : null;
}

function normalizeTag(value) {
  return cleanText(value);
}

function normalizeTagKey(value) {
  return normalizeNameKey(value);
}

function reviewSummaryNoiseReason(value) {
  const summary = cleanText(value);
  const compact = normalizeNameKey(summary);
  if (!summary || compact.length < 8) return "lowSignal";
  if (REVIEW_SUMMARY_NOISE_PATTERNS.some((pattern) => pattern.test(summary))) return "boilerplate";
  return null;
}

function cleanCandidateReviewSummaries(candidates) {
  const stats = {
    inputSummaries: 0,
    outputSummaries: 0,
    removedNoRating: 0,
    removedBoilerplate: 0,
    removedLowSignal: 0,
    removedRestaurantName: 0,
    removedDuplicateWithinRestaurant: 0,
    removedDuplicateAcrossSources: 0,
    removedGloballyRepeated: 0,
    removedOverLimit: 0,
    restaurantsWithSummaries: 0,
  };
  const reusable = [];
  const restaurantsBySummary = new Map();

  for (const candidate of candidates) {
    const summaries = [];
    const seen = new Set();
    for (const value of candidate.reviewSummary) {
      stats.inputSummaries += 1;
      const summary = cleanText(value);
      const key = normalizeNameKey(summary);
      if (!key || seen.has(key)) {
        stats.removedDuplicateWithinRestaurant += 1;
        continue;
      }
      seen.add(key);
      if (candidate.data.ratingScore === null) {
        stats.removedNoRating += 1;
        continue;
      }
      if (key === candidate.nameKey) {
        stats.removedRestaurantName += 1;
        continue;
      }
      const reason = reviewSummaryNoiseReason(summary);
      if (reason === "boilerplate") {
        stats.removedBoilerplate += 1;
        continue;
      }
      if (reason === "lowSignal") {
        stats.removedLowSignal += 1;
        continue;
      }
      summaries.push({ key, summary });
      const restaurantKeys = restaurantsBySummary.get(key) ?? new Set();
      restaurantKeys.add(candidate.nameAddressKey);
      restaurantsBySummary.set(key, restaurantKeys);
    }
    reusable.push({ candidate, summaries });
  }

  const globallyRepeated = new Set(
    [...restaurantsBySummary.entries()]
      .filter(([, restaurantKeys]) => restaurantKeys.size >= REPEATED_REVIEW_SUMMARY_RESTAURANT_THRESHOLD)
      .map(([key]) => key)
  );

  for (const { candidate, summaries } of reusable) {
    const retained = [];
    for (const { key, summary } of summaries) {
      if (globallyRepeated.has(key)) {
        stats.removedGloballyRepeated += 1;
        continue;
      }
      if (retained.length >= MAX_REVIEW_SUMMARIES_PER_RESTAURANT) {
        stats.removedOverLimit += 1;
        continue;
      }
      retained.push(summary);
    }
    candidate.reviewSummary = retained;
    candidate.data.reviewSummaryJson = JSON.stringify(retained);
  }

  return stats;
}

function normalizePhoneDigits(value) {
  return cleanText(value).replace(/\D/g, "");
}

function splitLegacyPhone(value) {
  const raw = cleanText(value);
  const digits = normalizePhoneDigits(raw);
  if (!digits) return { phone: null, areaNum: null, telNum: null };
  if (digits.startsWith("09")) return { phone: raw, areaNum: null, telNum: digits };

  const areaCodes = ["0826", "0836", "037", "049", "089", "082", "02", "03", "04", "05", "06", "07", "08"];
  const areaNum = areaCodes.find((code) => digits.startsWith(code) && digits.length > code.length) ?? null;
  return {
    phone: raw,
    areaNum,
    telNum: areaNum ? digits.slice(areaNum.length) : digits,
  };
}

function normalizeTime(value) {
  const text = cleanText(value);
  if (!text) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour === 24 && minute === 0) return "24:00";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeToLegacyInt(value) {
  if (!value) return 0;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 100 + minute;
}

function normalizeUrl(value) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isKnownInvalidImageUrl(value) {
  const text = cleanText(value);
  if (!text) return false;
  try {
    const url = new URL(text);
    const invalidToken = /^(?:undefined|null|none|n\/a)$/iu;
    return url.pathname
      .split("/")
      .filter(Boolean)
      .some((segment) => {
        try {
          return invalidToken.test(decodeURIComponent(segment));
        } catch {
          return invalidToken.test(segment);
        }
      });
  } catch {
    return false;
  }
}

function legacyPrice(min, max) {
  const midpoint = (min + max) / 2;
  if (midpoint < 100) return Math.max(10, Math.round(midpoint / 10) * 10);
  return Math.round(midpoint / 100) * 100;
}

function legacyFoodType(tags) {
  const text = tags.join(" ");
  if (/(日式|日本|壽司|拉麵|丼飯|居酒屋|和食)/u.test(text)) return 1;
  if (/(美式|漢堡|美國)/u.test(text)) return 2;
  if (/(義式|義大利|披薩|燉飯|pasta)/iu.test(text)) return 3;
  if (tags.some((tag) => tag.includes("小吃"))) return 4;
  return 0;
}

function collectedAtUnix(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return 0;
  const timestamp = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}

function deriveDistrictCode(file, cityCode) {
  const basename = path.basename(file, ".json").replace(/-restaurants$/, "");
  const prefix = `${cityCode}-`;
  return basename.startsWith(prefix) ? basename.slice(prefix.length) : basename;
}

function loadDocuments(dataDir) {
  const files = fs.readdirSync(dataDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const documents = [];
  const fileErrors = [];

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
      const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!document || !document.collection || !Array.isArray(document.restaurants)) {
        throw new Error("expected collection object and restaurants array");
      }
      documents.push({ file, filePath, document });
    } catch (error) {
      fileErrors.push({ file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { files, documents, fileErrors };
}

function buildLocationCatalog(documents, existingLookup = {}) {
  const existingRegionIds = new Map(
    (existingLookup.regions ?? [])
      .filter((region) => Number(region.id) > 0)
      .map((region) => [canonicalCity(region.label), Number(region.id)])
  );
  const existingSections = new Map();
  for (const [regionId, sections] of Object.entries(existingLookup.sectionsByRegion ?? {})) {
    existingSections.set(
      Number(regionId),
      new Map(sections.map((section) => [cleanText(section.label), Number(section.id)]))
    );
  }

  const cityMap = new Map();
  for (const { file, document } of documents) {
    const name = canonicalCity(document.collection.city);
    const districtName = cleanText(document.collection.district);
    const metadata = CITY_METADATA[name];
    if (!metadata || !districtName) continue;
    if (!cityMap.has(metadata.code)) {
      cityMap.set(metadata.code, {
        code: metadata.code,
        name,
        legacyRegion: existingRegionIds.get(name) ?? metadata.legacyRegion,
        districts: new Map(),
      });
    }
    const city = cityMap.get(metadata.code);
    const districtCode = deriveDistrictCode(file, metadata.code);
    city.districts.set(districtCode, { code: districtCode, name: districtName });
  }

  const cities = [...cityMap.values()]
    .sort((left, right) => left.legacyRegion - right.legacyRegion)
    .map((city) => {
      const existing = existingSections.get(city.legacyRegion) ?? new Map();
      const used = new Set(existing.values());
      let next = 1;
      const districts = [...city.districts.values()]
        .sort((left, right) => left.code.localeCompare(right.code))
        .map((district) => {
          let legacySection = existing.get(district.name);
          if (!legacySection) {
            while (used.has(next)) next += 1;
            legacySection = next;
          }
          used.add(legacySection);
          return { ...district, legacySection };
        })
        .sort((left, right) => left.legacySection - right.legacySection);
      return { code: city.code, name: city.name, legacyRegion: city.legacyRegion, districts };
    });

  return { cities };
}

function inferLocation(address, catalog) {
  const normalizedAddress = canonicalCity(address).split(/\((?:通訊地|營登)[：:]?/u, 1)[0];
  const matchedCities = catalog.cities.filter((city) => normalizedAddress.includes(city.name));
  if (matchedCities.length !== 1) {
    return { error: matchedCities.length === 0 ? "LOCATION_UNRESOLVED" : "LOCATION_CONFLICT" };
  }
  const city = matchedCities[0];
  const matchedDistricts = city.districts.filter((district) => normalizedAddress.includes(district.name));
  if (matchedDistricts.length === 0) return { error: "LOCATION_UNRESOLVED" };
  const longestLength = Math.max(...matchedDistricts.map((district) => district.name.length));
  const mostSpecific = matchedDistricts.filter((district) => district.name.length === longestLength);
  if (mostSpecific.length !== 1) return { error: "LOCATION_CONFLICT" };
  return { city, district: mostSpecific[0] };
}

function issueFor({ status, severity, reasonCode, source, importKey = null, details, payload }) {
  const sourceId = cleanText(source.sourceId) || null;
  const issueKey = hash([reasonCode, source.file, sourceId ?? "", importKey ?? ""].join("|"));
  return {
    issueKey,
    status,
    severity,
    reasonCode,
    sourceFile: source.file,
    sourceId,
    importKey,
    details,
    payloadJson: JSON.stringify(payload ?? null),
  };
}

function validateRecord(raw, source, catalog, options) {
  const name = cleanText(raw?.name);
  const sourceAddress = cleanText(raw?.address);
  const datasetId = cleanText(raw?.id);
  const externalSourceId = cleanText(raw?.source_id) || null;
  const trackingSourceId = externalSourceId || datasetId || null;
  const tentativeKey = datasetId ? stableImportKey(datasetId) : null;
  const reject = (reasonCode, details) => ({
    issue: issueFor({
      status: "rejected",
      severity: "high",
      reasonCode,
      source: { ...source, sourceId: trackingSourceId },
      importKey: tentativeKey,
      details,
      payload: raw,
    }),
  });

  if (!datasetId) return reject("MISSING_DATASET_ID", "來源資料缺少資料集內的穩定 id；source_id 只供追蹤且不作唯一鍵。");
  if (!name) return reject("MISSING_NAME", "餐廳名稱為必要欄位。");
  if (!sourceAddress) return reject("MISSING_ADDRESS", "餐廳地址為必要欄位。");

  const inferred = inferLocation(sourceAddress, catalog);
  if (inferred.error) {
    return reject(inferred.error, inferred.error === "LOCATION_CONFLICT"
      ? "地址同時命中多個城市或行政區，無法可靠選擇。"
      : "地址無法對應到本批資料的城市與行政區 reference。"
    );
  }
  const address = normalizeDisplayAddress(sourceAddress, inferred.city.name, inferred.district.name);
  const importKey = stableImportKey(datasetId);

  const priceMin = raw?.price_range_twd_per_person?.min;
  const priceMax = raw?.price_range_twd_per_person?.max;
  if (!Number.isInteger(priceMin) || !Number.isInteger(priceMax) || priceMin < 0 || priceMax < priceMin) {
    return reject("INVALID_PRICE_RANGE", "價位上下限必須是非負整數，且 max 不得小於 min。");
  }
  if (priceMax > options.maxPriceTwd) {
    return reject("PRICE_OUTLIER", `價位上限 ${priceMax} 超過匯入門檻 ${options.maxPriceTwd} 元。`);
  }

  const pendingIssues = [];
  const rating = raw?.online_rating ?? {};
  let ratingScore = rating.score;
  let ratingReviewCount = rating.review_count;
  if (ratingScore !== null && ratingScore !== undefined && (!Number.isFinite(ratingScore) || ratingScore < 0 || ratingScore > 5)) {
    pendingIssues.push(issueFor({
      status: "pending_review",
      severity: "medium",
      reasonCode: "INVALID_RATING",
      source: { ...source, sourceId: trackingSourceId },
      importKey,
      details: `評分 ${String(ratingScore)} 不在 0–5，已改存 null。`,
      payload: raw,
    }));
    ratingScore = null;
  }
  if (ratingReviewCount !== null && ratingReviewCount !== undefined && (!Number.isInteger(ratingReviewCount) || ratingReviewCount < 0)) {
    pendingIssues.push(issueFor({
      status: "pending_review",
      severity: "medium",
      reasonCode: "INVALID_REVIEW_COUNT",
      source: { ...source, sourceId: trackingSourceId },
      importKey,
      details: `評論數 ${String(ratingReviewCount)} 不是非負整數，已改存 null。`,
      payload: raw,
    }));
    ratingReviewCount = null;
  }

  const openTime = normalizeTime(raw?.business_hours?.average_open_time);
  const closeTime = normalizeTime(raw?.business_hours?.average_close_time);
  if (openTime === undefined || closeTime === undefined) {
    pendingIssues.push(issueFor({
      status: "pending_review",
      severity: "medium",
      reasonCode: "INVALID_BUSINESS_HOURS",
      source: { ...source, sourceId: trackingSourceId },
      importKey,
      details: "營業時間不是有效的 HH:MM；無效欄位已改存 null。",
      payload: raw,
    }));
  }

  const knownInvalidImageUrl = isKnownInvalidImageUrl(raw?.image_url);
  let externalImageUrl = knownInvalidImageUrl ? null : normalizeUrl(raw?.image_url);
  if (!knownInvalidImageUrl && externalImageUrl === undefined) {
    pendingIssues.push(issueFor({
      status: "pending_review",
      severity: "low",
      reasonCode: "INVALID_IMAGE_URL",
      source: { ...source, sourceId: trackingSourceId },
      importKey,
      details: "圖片網址不是有效的 HTTP(S) URL，已改存 null。",
      payload: raw,
    }));
    externalImageUrl = null;
  }
  if (raw?.image_usage_status && raw.image_usage_status !== "no_explicit_prohibition_found") {
    externalImageUrl = null;
  }

  const tags = Array.isArray(raw?.cuisine_types)
    ? raw.cuisine_types.map(normalizeTag).filter(Boolean)
    : [];
  const uniqueTags = [];
  const seenTags = new Set();
  for (const tag of tags) {
    const key = normalizeTagKey(tag);
    if (!key || seenTags.has(key)) continue;
    seenTags.add(key);
    uniqueTags.push(tag);
  }

  const reviewSummary = Array.isArray(rating.review_summary)
    ? rating.review_summary.map(cleanText).filter(Boolean)
    : [];
  const phone = splitLegacyPhone(raw?.phone);
  const collectionCity = canonicalCity(source.collection.city);
  const collectionDistrict = cleanText(source.collection.district);
  const locationCorrected = inferred.city.name !== collectionCity || inferred.district.name !== collectionDistrict;
  const sourceRef = { file: source.file, id: datasetId, sourceId: externalSourceId };

  return {
    candidate: {
      importKey,
      datasetId,
      nameAddressKey: nameAddressKey(name, address),
      nameKey: normalizeNameKey(name),
      phoneKey: normalizePhoneDigits(raw?.phone),
      tags: uniqueTags,
      reviewSummary,
      sourceRefs: [sourceRef],
      locationCorrected,
      invalidImageUrlRemoved: knownInvalidImageUrl,
      raw,
      data: {
        importKey,
        sourceId: externalSourceId,
        sourceFile: source.file,
        sourceRefsJson: JSON.stringify([sourceRef]),
        name,
        address,
        areaNum: phone.areaNum,
        telNum: phone.telNum,
        phone: phone.phone,
        region: inferred.city.legacyRegion,
        section: inferred.district.legacySection,
        cityCode: inferred.city.code,
        districtCode: inferred.district.code,
        foodType: legacyFoodType(uniqueTags),
        price: legacyPrice(priceMin, priceMax),
        priceMin,
        priceMax,
        openTime: timeToLegacyInt(openTime === undefined ? null : openTime),
        closeTime: timeToLegacyInt(closeTime === undefined ? null : closeTime),
        businessOpenTime: openTime === undefined ? null : openTime,
        businessCloseTime: closeTime === undefined ? null : closeTime,
        ratingPlatform: cleanText(rating.platform) || null,
        ratingScore: ratingScore ?? null,
        ratingReviewCount: ratingReviewCount ?? null,
        reviewSummaryJson: JSON.stringify(reviewSummary),
        externalImageUrl,
        note: uniqueTags.length > 0 ? `料理與特色：${uniqueTags.join("、")}` : null,
        imageUrl: null,
        originalImage: externalImageUrl,
        updatedAtUnix: collectedAtUnix(source.collection.collected_at),
        postId: 0,
        closed: 0,
      },
    },
    pendingIssues,
  };
}

function candidateQuality(candidate) {
  const data = candidate.data;
  return (candidate.locationCorrected ? 0 : 20)
    + (data.phone ? 5 : 0)
    + (data.externalImageUrl ? 4 : 0)
    + (data.ratingScore !== null ? 3 : 0)
    + (data.businessOpenTime && data.businessCloseTime ? 2 : 0)
    + Math.min(data.ratingReviewCount ?? 0, 100_000) / 100_000;
}

function mergeCandidateGroup(group) {
  const ordered = [...group].sort((left, right) => {
    const quality = candidateQuality(right) - candidateQuality(left);
    if (quality !== 0) return quality;
    return left.datasetId.localeCompare(right.datasetId);
  });
  const merged = JSON.parse(JSON.stringify(ordered[0]));
  const tagMap = new Map();
  const summaries = new Map();
  const sourceRefs = new Map();
  for (const candidate of ordered) {
    for (const tag of candidate.tags) tagMap.set(normalizeTagKey(tag), tagMap.get(normalizeTagKey(tag)) ?? tag);
    for (const summary of candidate.reviewSummary) summaries.set(normalizeNameKey(summary), summary);
    for (const ref of candidate.sourceRefs) sourceRefs.set(ref.id, sourceRefs.get(ref.id) ?? ref);
  }
  merged.tags = [...tagMap.values()];
  merged.reviewSummary = [...summaries.values()];
  merged.sourceRefs = [...sourceRefs.values()].sort((left, right) => `${left.file}|${left.id}`.localeCompare(`${right.file}|${right.id}`));
  merged.datasetId = [...sourceRefs.keys()].sort((left, right) => left.localeCompare(right))[0];
  merged.importKey = stableImportKey(merged.datasetId);
  merged.data.importKey = merged.importKey;
  merged.data.sourceRefsJson = JSON.stringify(merged.sourceRefs);
  merged.data.reviewSummaryJson = JSON.stringify(merged.reviewSummary);
  merged.data.note = merged.tags.length > 0 ? `料理與特色：${merged.tags.join("、")}` : null;
  merged.data.foodType = legacyFoodType(merged.tags);
  merged.data.updatedAtUnix = Math.max(...ordered.map((candidate) => candidate.data.updatedAtUnix));

  const ratingSource = ordered
    .filter((candidate) => candidate.data.ratingScore !== null)
    .sort((left, right) => (right.data.ratingReviewCount ?? -1) - (left.data.ratingReviewCount ?? -1))[0];
  if (ratingSource) {
    merged.data.ratingPlatform = ratingSource.data.ratingPlatform;
    merged.data.ratingScore = ratingSource.data.ratingScore;
    merged.data.ratingReviewCount = ratingSource.data.ratingReviewCount;
  }
  for (const field of ["phone", "areaNum", "telNum", "externalImageUrl", "originalImage", "businessOpenTime", "businessCloseTime"]) {
    const source = ordered.find((candidate) => candidate.data[field] !== null);
    if (source) merged.data[field] = source.data[field];
  }
  merged.data.openTime = timeToLegacyInt(merged.data.businessOpenTime);
  merged.data.closeTime = timeToLegacyInt(merged.data.businessCloseTime);
  return merged;
}

function prepareImport({ documents, existingLookup = {}, maxPriceTwd = DEFAULT_MAX_PRICE_TWD, dedupeDecisions = [] }) {
  const catalog = buildLocationCatalog(documents, existingLookup);
  const candidates = [];
  const issues = [];
  const optionalMissing = { phone: 0, image: 0, rating: 0, businessHours: 0 };
  let sourceRecords = 0;
  let locationCorrections = 0;
  let invalidImageUrlsRemoved = 0;
  const seenDatasetIds = new Set();

  for (const { file, document } of documents) {
    const source = { file, collection: document.collection };
    for (const raw of document.restaurants) {
      sourceRecords += 1;
      const datasetId = cleanText(raw?.id);
      if (datasetId && seenDatasetIds.has(datasetId)) {
        issues.push(issueFor({
          status: "rejected",
          severity: "high",
          reasonCode: "DUPLICATE_DATASET_ID",
          source: { ...source, sourceId: cleanText(raw?.source_id) || datasetId },
          importKey: stableImportKey(datasetId),
          details: `資料集 id ${datasetId} 重複；為避免 import_key 指向不同餐廳，本筆已隔離。`,
          payload: raw,
        }));
        continue;
      }
      if (datasetId) seenDatasetIds.add(datasetId);
      if (!raw.phone) optionalMissing.phone += 1;
      if (!raw.image_url) optionalMissing.image += 1;
      if (raw.online_rating?.score === null || raw.online_rating?.score === undefined) optionalMissing.rating += 1;
      if (!raw.business_hours?.average_open_time || !raw.business_hours?.average_close_time) optionalMissing.businessHours += 1;
      const result = validateRecord(raw, source, catalog, { maxPriceTwd });
      if (result.issue) {
        issues.push(result.issue);
        continue;
      }
      if (result.candidate.locationCorrected) locationCorrections += 1;
      if (result.candidate.invalidImageUrlRemoved) invalidImageUrlsRemoved += 1;
      candidates.push(result.candidate);
      issues.push(...result.pendingIssues);
    }
  }

  const reviewSummaryQuality = cleanCandidateReviewSummaries(candidates);

  const grouped = new Map();
  for (const candidate of candidates) {
    const group = grouped.get(candidate.nameAddressKey) ?? [];
    group.push(candidate);
    grouped.set(candidate.nameAddressKey, group);
  }
  const nameAddressRestaurants = [...grouped.values()].map(mergeCandidateGroup);
  const decisionByIdentity = new Map(dedupeDecisions.map((decision) => [decision.identityKey, decision]));
  const strictGroups = new Map();
  for (const restaurant of nameAddressRestaurants) {
    const identityKey = restaurantIdentityKey(restaurant.data.address, restaurant.data.phone);
    const groupKey = identityKey ?? `import:${restaurant.importKey}`;
    const group = strictGroups.get(groupKey) ?? [];
    group.push(restaurant);
    strictGroups.set(groupKey, group);
  }
  let strictIdentityDuplicateGroups = 0;
  let strictIdentityDuplicatesRemoved = 0;
  let researchedIdentityGroups = 0;
  let verifiedIdentityGroups = 0;
  let fallbackIdentityGroups = 0;
  const restaurants = [...strictGroups.entries()].map(([groupKey, group]) => {
    if (group.length === 1 || groupKey.startsWith("import:")) return group[0];
    strictIdentityDuplicateGroups += 1;
    strictIdentityDuplicatesRemoved += group.length - 1;
    const merged = mergeCandidateGroup(group);
    const decision = decisionByIdentity.get(groupKey);
    const sourceNames = [...new Set(group.map((candidate) => candidate.data.name))];
    if (decision?.canonicalName) {
      researchedIdentityGroups += 1;
      if (decision.resolution === "verified") verifiedIdentityGroups += 1;
      else fallbackIdentityGroups += 1;
      merged.data.name = cleanText(decision.canonicalName);
      merged.nameKey = normalizeNameKey(merged.data.name);
    }
    issues.push(issueFor({
      status: "resolved",
      severity: "medium",
      reasonCode: "IDENTITY_DUPLICATE_MERGED",
      source: { file: merged.data.sourceFile, sourceId: merged.data.sourceId },
      importKey: merged.importKey,
      details: `同地址同電話合併 ${group.length} 筆：${sourceNames.join("；")} → ${merged.data.name}`,
      payload: {
        identityKey: groupKey,
        address: merged.data.address,
        phone: merged.data.phone,
        sourceNames,
        canonicalName: merged.data.name,
        verificationUrl: decision?.verificationUrl ?? null,
        verifiedAt: decision?.verifiedAt ?? null,
        confidence: decision?.confidence ?? null,
        resolution: decision?.resolution ?? null,
      },
    }));
    return merged;
  });
  reviewSummaryQuality.removedDuplicateAcrossSources = candidates
    .reduce((total, candidate) => total + candidate.reviewSummary.length, 0)
    - restaurants.reduce((total, restaurant) => total + restaurant.reviewSummary.length, 0);
  for (const restaurant of restaurants) {
    if (restaurant.reviewSummary.length > MAX_REVIEW_SUMMARIES_PER_RESTAURANT) {
      reviewSummaryQuality.removedOverLimit += restaurant.reviewSummary.length - MAX_REVIEW_SUMMARIES_PER_RESTAURANT;
      restaurant.reviewSummary = restaurant.reviewSummary.slice(0, MAX_REVIEW_SUMMARIES_PER_RESTAURANT);
      restaurant.data.reviewSummaryJson = JSON.stringify(restaurant.reviewSummary);
    }
    reviewSummaryQuality.outputSummaries += restaurant.reviewSummary.length;
    if (restaurant.reviewSummary.length > 0) reviewSummaryQuality.restaurantsWithSummaries += 1;
  }
  const duplicatesRemoved = candidates.length - restaurants.length;

  const possibleDuplicates = new Map();
  for (const restaurant of restaurants) {
    if (!restaurant.phoneKey) continue;
    const key = `${restaurant.nameKey}|${restaurant.phoneKey}`;
    const group = possibleDuplicates.get(key) ?? [];
    group.push(restaurant);
    possibleDuplicates.set(key, group);
  }
  const pendingDuplicateGroups = [...possibleDuplicates.values()]
    .filter((group) => group.length > 1 && new Set(group.map((candidate) => candidate.importKey)).size > 1);
  for (const group of pendingDuplicateGroups) {
    const peerSummary = group.map((candidate) => `${candidate.data.name}｜${candidate.data.address}`).join("；");
    for (const candidate of group) {
      issues.push(issueFor({
        status: "pending_review",
        severity: "medium",
        reasonCode: "POTENTIAL_DUPLICATE",
        source: { file: candidate.data.sourceFile, sourceId: candidate.data.sourceId },
        importKey: candidate.importKey,
        details: `同名且電話相同、地址不同，未自動合併：${peerSummary}`,
        payload: candidate.raw,
      }));
    }
  }

  const rejectedIssues = issues.filter((issue) => issue.status === "rejected");
  const pendingIssues = issues.filter((issue) => issue.status === "pending_review");
  const pendingImportKeys = new Set(pendingIssues.map((issue) => issue.importKey).filter(Boolean));
  const issuesByCode = Object.fromEntries(
    [...new Set(issues.map((issue) => issue.reasonCode))]
      .sort()
      .map((reasonCode) => [reasonCode, issues.filter((issue) => issue.reasonCode === reasonCode).length])
  );
  const tagKeys = new Set(restaurants.flatMap((restaurant) => restaurant.tags.map(normalizeTagKey)));
  const explicitSmallEatRestaurants = restaurants.filter((restaurant) =>
    restaurant.tags.some((tag) => tag.includes("小吃"))
  ).length;
  const legacySmallEatRestaurants = restaurants.filter((restaurant) => restaurant.data.foodType === 4).length;
  const smallEatClassification = {
    explicitTagRestaurants: explicitSmallEatRestaurants,
    legacyCodeRestaurants: legacySmallEatRestaurants,
    legacyCodeWithoutExplicitTag: restaurants.filter((restaurant) =>
      restaurant.data.foodType === 4 && !restaurant.tags.some((tag) => tag.includes("小吃"))
    ).length,
  };

  return {
    catalog,
    restaurants,
    issues,
    summary: {
      sourceFiles: documents.length,
      sourceRecords,
      acceptedRawRecords: candidates.length,
      acceptedUniqueRestaurants: restaurants.length,
      duplicatesRemoved,
      nameAddressDuplicatesRemoved: candidates.length - nameAddressRestaurants.length,
      strictIdentityDuplicateGroups,
      strictIdentityDuplicatesRemoved,
      strictIdentityDecisionCoverage: {
        researchedGroups: researchedIdentityGroups,
        verifiedGroups: verifiedIdentityGroups,
        fallbackGroups: fallbackIdentityGroups + strictIdentityDuplicateGroups - researchedIdentityGroups,
      },
      rejectedRecords: rejectedIssues.length,
      pendingReviewRecords: pendingImportKeys.size,
      pendingReviewIssues: pendingIssues.length,
      pendingDuplicateGroups: pendingDuplicateGroups.length,
      locationCorrections,
      invalidImageUrlsRemoved,
      optionalMissing,
      reviewSummaryQuality,
      smallEatClassification,
      cities: catalog.cities.length,
      districts: catalog.cities.reduce((sum, city) => sum + city.districts.length, 0),
      tags: tagKeys.size,
      issuesByCode,
    },
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function parseManualOverrideFields(value) {
  if (!value) return new Set();
  try {
    const parsed = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((field) => typeof field === "string") : []);
  } catch {
    return new Set();
  }
}

function parseSourceRecordIds(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((ref) => cleanText(ref?.id)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function preserveManualOverrides(data, manualOverrideFields) {
  const dependencies = {
    areaNum: ["areaNum", "phone"],
    telNum: ["telNum", "phone"],
    region: ["region", "cityId"],
    section: ["section", "districtId"],
    address: ["address"],
    foodType: ["foodType"],
    price: ["price", "priceMin", "priceMax"],
    note: ["note"],
    imageUrl: ["imageUrl", "originalImage", "externalImageUrl"],
    closed: ["closed"],
    name: ["name"],
    cuisineTypeId: ["cuisineTypeId"],
  };
  for (const field of manualOverrideFields) {
    for (const dependentField of dependencies[field] ?? [field]) delete data[dependentField];
  }
  return data;
}

function relationTagKey(relation) {
  return normalizeTagKey(relation?.tag?.normalizedName ?? relation?.tag?.name ?? relation?.sourceName);
}

async function mergeImportedRestaurantTags({ prisma, prepared, restaurantIds, tagIds }) {
  if (restaurantIds.length === 0) return 0;
  const ids = restaurantIds.map((entry) => entry.id);
  const existingRelations = await prisma.restaurantTag.findMany({
    where: { restaurantId: { in: ids } },
    include: { tag: true },
  });
  const cuisineTypesByRestaurant = new Map(
    (await prisma.restaurant.findMany({
      where: { id: { in: ids } },
      select: { id: true, cuisineType: { select: { normalizedName: true, status: true } } },
    })).map((restaurant) => [restaurant.id, restaurant.cuisineType])
  );
  const relationsByRestaurant = new Map();
  for (const relation of existingRelations) {
    const relations = relationsByRestaurant.get(relation.restaurantId) ?? [];
    relations.push(relation);
    relationsByRestaurant.set(relation.restaurantId, relations);
  }
  let writes = 0;
  for (const restaurant of prepared.restaurants) {
    const restaurantId = restaurantIds.find((entry) => entry.importKey === restaurant.importKey)?.id;
    if (!restaurantId) continue;
    const sourceTags = [];
    const seenSourceTags = new Set();
    for (const tagName of restaurant.tags) {
      const normalizedName = normalizeTagKey(tagName);
      if (!normalizedName || seenSourceTags.has(normalizedName)) continue;
      seenSourceTags.add(normalizedName);
      sourceTags.push({ name: tagName, normalizedName });
    }
    const relations = relationsByRestaurant.get(restaurantId) ?? [];
    const relationByKey = new Map(relations.map((relation) => [relationTagKey(relation), relation]));
    for (let position = 0; position < sourceTags.length; position += 1) {
      const sourceTag = sourceTags[position];
      const tagId = tagIds.get(sourceTag.normalizedName);
      if (!tagId) continue;
      const cuisineType = cuisineTypesByRestaurant.get(restaurantId);
      const isPrimaryCuisineTag = cuisineType?.status === "active"
        && normalizeTagKey(cuisineType.normalizedName) === sourceTag.normalizedName;
      const existing = relationByKey.get(sourceTag.normalizedName);
      if (!existing) {
        await prisma.restaurantTag.create({
          data: {
            restaurantId,
            tagId,
            position,
            owner: "source",
            sourceName: sourceTag.name,
            isPublic: !isPrimaryCuisineTag,
          },
        });
        writes += 1;
        continue;
      }
      const protectedByClassifier = existing.owner === "ai" || existing.owner === "manual";
      await prisma.restaurantTag.update({
        where: { restaurantId_tagId: { restaurantId, tagId: existing.tagId } },
        data: protectedByClassifier
          ? { sourceName: sourceTag.name }
          : { position, owner: "source", sourceName: sourceTag.name, isPublic: !isPrimaryCuisineTag },
      });
      writes += 1;
    }
    for (const existing of relations) {
      const key = relationTagKey(existing);
      if (existing.owner !== "source" || seenSourceTags.has(key)) continue;
      await prisma.restaurantTag.update({
        where: { restaurantId_tagId: { restaurantId, tagId: existing.tagId } },
        data: {
          owner: "source",
          sourceName: existing.sourceName || existing.tag?.name || null,
          isPublic: false,
        },
      });
      writes += 1;
    }
  }
  return writes;
}

async function applyImportTransaction({ prisma, prepared, replace, prune, batchSize }) {
  const writes = {
    createdRestaurants: 0,
    updatedRestaurants: 0,
    migratedImportKeys: 0,
    preservedImportKeys: 0,
    prunedRestaurants: 0,
    restaurantTags: 0,
    importIssues: prepared.issues.length,
  };

  if (replace) {
    await prisma.restaurant.deleteMany();
  }

  const cityIds = new Map();
  const districtIds = new Map();
  for (const city of prepared.catalog.cities) {
    const savedCity = await prisma.city.upsert({
      where: { code: city.code },
      update: { name: city.name, legacyRegion: city.legacyRegion },
      create: { code: city.code, name: city.name, legacyRegion: city.legacyRegion },
    });
    cityIds.set(city.code, savedCity.id);
    for (const district of city.districts) {
      const savedDistrict = await prisma.district.upsert({
        where: { cityId_code: { cityId: savedCity.id, code: district.code } },
        update: { name: district.name, legacySection: district.legacySection },
        create: {
          cityId: savedCity.id,
          code: district.code,
          name: district.name,
          legacySection: district.legacySection,
        },
      });
      districtIds.set(`${city.code}|${district.code}`, savedDistrict.id);
    }
  }

  const tagDisplay = new Map();
  for (const restaurant of prepared.restaurants) {
    for (const tag of restaurant.tags) tagDisplay.set(normalizeTagKey(tag), tagDisplay.get(normalizeTagKey(tag)) ?? tag);
  }
  const existingTags = await prisma.tag.findMany();
  const tagIds = new Map(existingTags.map((tag) => [tag.normalizedName, tag.id]));
  const newTags = [...tagDisplay.entries()]
    .filter(([normalizedName]) => !tagIds.has(normalizedName))
    .map(([normalizedName, name]) => ({ normalizedName, name }));
  for (const batch of chunk(newTags, batchSize)) await prisma.tag.createMany({ data: batch });
  for (const tag of await prisma.tag.findMany()) tagIds.set(tag.normalizedName, tag.id);

  const existingImported = await prisma.restaurant.findMany({
    where: { importKey: { not: null } },
    select: { id: true, importKey: true, sourceRefsJson: true, manualOverrideFields: true },
  });
  const existingOwned = existingImported.filter((restaurant) => isOwnedImportKey(restaurant.importKey));
  const existingByKey = new Map(
    existingOwned.map((restaurant) => [restaurant.importKey, restaurant])
  );
  const existingByDatasetId = new Map();
  for (const restaurant of existingOwned) {
    for (const datasetId of parseSourceRecordIds(restaurant.sourceRefsJson)) {
      const group = existingByDatasetId.get(datasetId) ?? [];
      group.push(restaurant);
      existingByDatasetId.set(datasetId, group);
    }
  }
  const assignments = new Map();
  const claimedExistingIds = new Set();
  const preparedKeyAliases = new Map();
  for (const restaurant of prepared.restaurants) {
    let existing = existingByKey.get(restaurant.importKey);
    if (!existing) {
      const matches = [...new Map(restaurant.sourceRefs
        .flatMap((ref) => existingByDatasetId.get(ref.id) ?? [])
        .map((row) => [row.id, row])).values()]
        .filter((row) => !claimedExistingIds.has(row.id));
      if (matches.length === 1) existing = matches[0];
    }
    if (existing && !claimedExistingIds.has(existing.id)) {
      if (existing.importKey?.startsWith(DATASET_PREFIX) && existing.importKey !== restaurant.importKey) {
        preparedKeyAliases.set(restaurant.importKey, existing.importKey);
        restaurant.importKey = existing.importKey;
        restaurant.data.importKey = existing.importKey;
        writes.preservedImportKeys += 1;
      }
      assignments.set(restaurant.importKey, existing);
      claimedExistingIds.add(existing.id);
    }
  }
  for (const issue of prepared.issues) {
    if (issue.importKey && preparedKeyAliases.has(issue.importKey)) {
      issue.importKey = preparedKeyAliases.get(issue.importKey);
    }
  }
  const currentKeys = new Set(prepared.restaurants.map((restaurant) => restaurant.importKey));
  if (prune) {
    const staleIds = existingOwned
      .filter((restaurant) => !claimedExistingIds.has(restaurant.id))
      .map((restaurant) => restaurant.id);
    for (const ids of chunk(staleIds, batchSize)) {
      const result = await prisma.restaurant.deleteMany({ where: { id: { in: ids } } });
      writes.prunedRestaurants += result.count;
    }
  }

  const toDatabaseData = (restaurant, manualOverrideFields = new Set()) => {
    const { cityCode, districtCode, ...data } = restaurant.data;
    return preserveManualOverrides({
      ...data,
      cityId: cityIds.get(cityCode),
      districtId: districtIds.get(`${cityCode}|${districtCode}`),
    }, manualOverrideFields);
  };
  const newRestaurants = prepared.restaurants.filter((restaurant) => !assignments.has(restaurant.importKey));
  const changedRestaurants = prepared.restaurants.filter((restaurant) => assignments.has(restaurant.importKey));
  for (const restaurant of changedRestaurants) {
    const existing = assignments.get(restaurant.importKey);
    if (existing.importKey !== restaurant.importKey) {
      await prisma.restaurant.update({
        where: { id: existing.id },
        data: { importKey: `res-data:migrating:${existing.id}:${hash(restaurant.importKey).slice(0, 12)}` },
      });
      writes.migratedImportKeys += 1;
    }
  }
  for (const batch of chunk(newRestaurants, batchSize)) {
    const result = await prisma.restaurant.createMany({ data: batch.map((restaurant) => toDatabaseData(restaurant)) });
    writes.createdRestaurants += result.count;
  }
  for (const batch of chunk(changedRestaurants, Math.min(batchSize, 50))) {
    await Promise.all(batch.map((restaurant) => {
      const existing = assignments.get(restaurant.importKey);
      return prisma.restaurant.update({
        where: { id: existing.id },
        data: toDatabaseData(restaurant, parseManualOverrideFields(existing.manualOverrideFields)),
      });
    }));
    writes.updatedRestaurants += batch.length;
  }

  const importedRows = await prisma.restaurant.findMany({
    where: { importKey: { not: null } },
    select: { id: true, importKey: true },
  });
  const restaurantIds = new Map(
    importedRows
      .filter((restaurant) => currentKeys.has(restaurant.importKey))
      .map((restaurant) => [restaurant.importKey, restaurant.id])
  );
  const currentRestaurantIds = [...restaurantIds.entries()].map(([importKey, id]) => ({ importKey, id }));
  writes.restaurantTags = await mergeImportedRestaurantTags({
    prisma,
    prepared,
    restaurantIds: currentRestaurantIds,
    tagIds,
  });

  await prisma.restaurantImportIssue.deleteMany();
  const updatedAtUnix = Math.floor(Date.now() / 1000);
  for (const batch of chunk(prepared.issues, batchSize)) {
    await prisma.restaurantImportIssue.createMany({
      data: batch.map((issue) => ({ ...issue, updatedAtUnix })),
    });
  }

  writes.databaseImportedRestaurants = await prisma.restaurant.count({
    where: { importKey: { startsWith: DATASET_PREFIX } },
  });
  return writes;
}

async function applyImport({ prisma, prepared, replace = false, prune = false, batchSize = DEFAULT_BATCH_SIZE }) {
  return prisma.$transaction(
    (transaction) => applyImportTransaction({
      prisma: transaction,
      prepared,
      replace,
      prune,
      batchSize,
    }),
    { maxWait: 30_000, timeout: 180_000 }
  );
}

function lookupDataFromCatalog(catalog, foodTypes) {
  return {
    regions: [
      { id: 0, label: "都可以" },
      ...catalog.cities.map((city) => ({ id: city.legacyRegion, label: city.name })),
    ],
    sectionsByRegion: Object.fromEntries(catalog.cities.map((city) => [
      String(city.legacyRegion),
      city.districts.map((district) => ({ id: district.legacySection, label: district.name })),
    ])),
    foodTypes,
  };
}

module.exports = {
  CITY_METADATA,
  DATASET_PREFIX,
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_PRICE_TWD,
  MAX_REVIEW_SUMMARIES_PER_RESTAURANT,
  REPEATED_REVIEW_SUMMARY_RESTAURANT_THRESHOLD,
  applyImport,
  buildLocationCatalog,
  canonicalCity,
  cleanText,
  inferLocation,
  isKnownInvalidImageUrl,
  legacyFoodType,
  legacyPrice,
  loadDocuments,
  lookupDataFromCatalog,
  mergeImportedRestaurantTags,
  normalizeAddressKey,
  normalizeDisplayAddress,
  normalizeNameKey,
  normalizeTime,
  prepareImport,
  restaurantIdentityKey,
  reviewSummaryNoiseReason,
  stableImportKey,
  validateRecord,
};
