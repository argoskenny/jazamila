import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { clampPage } from "@/lib/pagination";
import { foodTypes, getSections, labelFor, regions } from "@/lib/domain/sections";
import type { ListFilters, Restaurant, RestaurantCriteria, RestaurantView } from "@/lib/domain/types";
import { restaurantAdminSchema } from "@/lib/validation/forms";

const perPage = 10;
const defaultPublicListLimit = 500;

type PrismaRestaurant = Prisma.RestaurantGetPayload<object> & {
  city?: { name: string } | null;
  district?: { name: string } | null;
  tags?: Array<{ position: number; tag: { name: string } }>;
};

const publicRestaurantInclude = {
  city: { select: { name: true } },
  district: { select: { name: true } },
  tags: {
    orderBy: { position: "asc" as const },
    include: { tag: { select: { name: true } } }
  }
};

const cuisineTagTerms: Record<number, string[]> = {
  1: ["日式", "日本", "壽司", "拉麵", "丼飯", "居酒屋", "和食"],
  2: ["美式", "漢堡", "美國"],
  3: ["義式", "義大利", "披薩", "燉飯", "pasta"],
  4: ["小吃"]
};

function cuisinePredicates(cuisineId: number): Prisma.RestaurantWhereInput[] {
  const legacyFoodType: Prisma.RestaurantWhereInput = cuisineId === 4
    ? { AND: [{ foodType: 4 }, { importKey: null }] }
    : { foodType: cuisineId };

  return [
    legacyFoodType,
    ...(cuisineTagTerms[cuisineId] ?? []).map((term) => ({
      tags: { some: { tag: { name: { contains: term } } } }
    }))
  ];
}

function toInt(value: string | number | undefined, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeLocation(location: string | undefined): { location: string; regionId: number; sectionId: number } {
  if (!location || location === "0") {
    return { location: "0", regionId: 0, sectionId: 0 };
  }

  const [region, section] = location.split("X");
  const regionId = toInt(region);
  const sectionId = toInt(section);

  if (regionId === 0) {
    return { location: "0", regionId: 0, sectionId: 0 };
  }

  return { location: `${regionId}X${sectionId}`, regionId, sectionId };
}

export function parseListFilters(
  segments: string[] | undefined,
  searchParams: Record<string, string | string[] | undefined> = {}
): ListFilters {
  const [locationSegment, typeSegment, maxSegment, minSegment, pageSegment] = segments ?? [];
  const location = normalizeLocation(locationSegment);
  const keywordParam = searchParams.search_keyword;
  const keyword = Array.isArray(keywordParam) ? keywordParam[0] ?? "" : keywordParam ?? "";

  return {
    location: location.location,
    regionId: location.regionId,
    sectionId: location.sectionId,
    foodType: toInt(typeSegment),
    maxPrice: toInt(maxSegment),
    minPrice: toInt(minSegment),
    page: Math.max(1, toInt(pageSegment, 1)),
    keyword: keyword.trim()
  };
}

function criteriaWhere(criteria: RestaurantCriteria): Prisma.RestaurantWhereInput {
  const where: Prisma.RestaurantWhereInput = {
    closed: { not: 1 }
  };
  const selectedFoodTypes = criteria.foodTypes?.filter((foodType) => foodType > 0) ?? [];
  const conditions: Prisma.RestaurantWhereInput[] = [];

  if (criteria.regionId) {
    conditions.push({
      OR: [{ region: criteria.regionId }, { city: { legacyRegion: criteria.regionId } }]
    });
  }
  if (criteria.sectionId) {
    conditions.push({
      OR: [{ section: criteria.sectionId }, { district: { legacySection: criteria.sectionId } }]
    });
  }

  const cuisineIds = selectedFoodTypes.length > 0 ? selectedFoodTypes : criteria.foodType ? [criteria.foodType] : [];
  if (cuisineIds.length > 0) {
    conditions.push({
      OR: cuisineIds.flatMap(cuisinePredicates)
    });
  }

  const hasUpperBound = criteria.maxPrice > 0 && criteria.maxPrice < 1100;
  if (hasUpperBound || criteria.minPrice > 0) {
    const rangeConditions: Prisma.RestaurantWhereInput[] = [];
    if (hasUpperBound) rangeConditions.push({ priceMin: { lte: criteria.maxPrice } });
    if (criteria.minPrice > 0) rangeConditions.push({ priceMax: { gte: criteria.minPrice } });

    const legacyPrice: Prisma.IntFilter = {};
    if (hasUpperBound) legacyPrice.lte = criteria.maxPrice;
    if (criteria.minPrice > 0) legacyPrice.gte = criteria.minPrice;

    conditions.push({
      OR: [
        { AND: rangeConditions },
        { priceMin: null, priceMax: null, price: legacyPrice }
      ]
    });
  }

  if (criteria.excludeIds?.length) conditions.push({ id: { notIn: criteria.excludeIds } });
  if (conditions.length > 0) where.AND = conditions;

  return where;
}

function listWhere(filters: ListFilters): Prisma.RestaurantWhereInput {
  const where = criteriaWhere(filters);

  if (filters.keyword) {
    where.OR = [
      { name: { contains: filters.keyword } },
      { address: { contains: filters.keyword } },
      { note: { contains: filters.keyword } },
      { city: { name: { contains: filters.keyword } } },
      { district: { name: { contains: filters.keyword } } },
      { tags: { some: { tag: { name: { contains: filters.keyword } } } } }
    ];
  }

  return where;
}

function fromPrismaRestaurant(restaurant: PrismaRestaurant): Restaurant {
  return {
    id: Number(restaurant.id),
    res_name: restaurant.name,
    res_area_num: restaurant.areaNum ?? "",
    res_tel_num: restaurant.telNum ?? "",
    res_region: restaurant.region,
    res_section: restaurant.section,
    res_address: restaurant.address ?? "",
    res_foodtype: restaurant.foodType,
    res_price: restaurant.price,
    res_open_time: Number(restaurant.openTime),
    res_close_time: Number(restaurant.closeTime),
    res_note: restaurant.note ?? "",
    res_img_url: restaurant.imageUrl ?? "",
    res_img_ori_url: restaurant.originalImage ?? "",
    res_updatetime: restaurant.updatedAtUnix === null ? 0 : Number(restaurant.updatedAtUnix),
    res_post_id: Number(restaurant.postId),
    res_close: restaurant.closed
  };
}

export const defaultRestaurantImagePath = "/assets/img/jazamila/generated/restaurant-default.jpg";

export function summarizeRestaurantTags(tags: string[], foodTypeLabel: string, visibleLimit = 3) {
  const featureTags = tags.filter((tag) => tag !== foodTypeLabel);
  const visibleTags = featureTags.slice(0, visibleLimit);
  return {
    visibleTags,
    hiddenCount: Math.max(0, featureTags.length - visibleTags.length)
  };
}

function imagePathForRestaurant(restaurant: Restaurant): string {
  const filename = restaurant.res_img_url.trim().split(/[\\/]/).pop() ?? "";
  if (!filename || filename === "." || filename === "..") return defaultRestaurantImagePath;
  return `/assets/pics/${encodeURIComponent(filename)}`;
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function formatPriceRange(priceMin: number | null | undefined, priceMax: number | null | undefined, fallback: number) {
  if (priceMin != null && priceMax != null) {
    if (priceMin === priceMax) return `每人約 ${priceMin.toLocaleString("zh-TW")} 元`;
    return `每人 ${priceMin.toLocaleString("zh-TW")}–${priceMax.toLocaleString("zh-TW")} 元`;
  }
  if (priceMin != null) return `每人 ${priceMin.toLocaleString("zh-TW")} 元起`;
  if (priceMax != null) return `每人 ${priceMax.toLocaleString("zh-TW")} 元內`;
  return fallback > 0 ? `${fallback.toLocaleString("zh-TW")} 元左右` : "價格彈性";
}

function formatBusinessHours(openTime: string | null | undefined, closeTime: string | null | undefined) {
  if (openTime && closeTime) return `平均 ${openTime}–${closeTime}`;
  if (openTime) return `平均 ${openTime} 開始營業`;
  if (closeTime) return `平均營業至 ${closeTime}`;
  return "營業時間未提供";
}

export function toRestaurantView(restaurant: Restaurant): RestaurantView {
  const tel = restaurant.res_tel_num
    ? restaurant.res_area_num
      ? `(${restaurant.res_area_num}) ${restaurant.res_tel_num}`
      : restaurant.res_tel_num
    : "未提供";

  return {
    ...restaurant,
    regionLabel: labelFor(regions, restaurant.res_region, "未知縣市"),
    sectionLabel: labelFor(getSections(restaurant.res_region), restaurant.res_section, "未知區域"),
    foodTypeLabel: labelFor(foodTypes, restaurant.res_foodtype, "未分類"),
    telLabel: tel,
    priceLabel: restaurant.res_price > 0 ? `${restaurant.res_price} 元左右` : "價格彈性",
    imagePath: imagePathForRestaurant(restaurant),
    fallbackImagePath: defaultRestaurantImagePath,
    cityLabel: labelFor(regions, restaurant.res_region, "未知縣市"),
    districtLabel: labelFor(getSections(restaurant.res_region), restaurant.res_section, ""),
    tags: [],
    ratingPlatform: "",
    ratingScore: null,
    ratingReviewCount: null,
    reviewSummaries: [],
    businessHoursLabel: "營業時間未提供",
    phoneHref: restaurant.res_tel_num ? `tel:${`${restaurant.res_area_num}${restaurant.res_tel_num}`.replace(/[^\d+]/g, "")}` : null,
    mapHref: restaurant.res_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.res_address)}` : null
  };
}

export function toRestaurantViewFromPrisma(restaurant: PrismaRestaurant): RestaurantView {
  const legacy = fromPrismaRestaurant(restaurant);
  const base = toRestaurantView(legacy);
  const fallbackImagePath = defaultRestaurantImagePath;
  const externalImageUrl = restaurant.externalImageUrl?.trim();
  const tags = restaurant.tags?.map((relation) => relation.tag.name).filter(Boolean) ?? [];
  const phone = restaurant.phone?.trim() || base.telLabel;
  const phoneDigits = phone === "未提供" ? "" : phone.replace(/[^\d+]/g, "");

  return {
    ...base,
    telLabel: phone,
    phoneHref: phoneDigits ? `tel:${phoneDigits}` : null,
    priceLabel: formatPriceRange(restaurant.priceMin, restaurant.priceMax, legacy.res_price),
    imagePath: externalImageUrl && /^https?:\/\//i.test(externalImageUrl) ? externalImageUrl : base.imagePath,
    fallbackImagePath,
    cityLabel: restaurant.city?.name || base.regionLabel,
    districtLabel: restaurant.district?.name || base.sectionLabel,
    foodTypeLabel: legacy.res_foodtype > 0 ? base.foodTypeLabel : tags[0] || "其他餐飲",
    tags,
    ratingPlatform: restaurant.ratingPlatform ?? "",
    ratingScore: restaurant.ratingScore,
    ratingReviewCount: restaurant.ratingReviewCount,
    reviewSummaries: parseStringArray(restaurant.reviewSummaryJson),
    businessHoursLabel: formatBusinessHours(restaurant.businessOpenTime, restaurant.businessCloseTime)
  };
}

export async function listRestaurants(filters: ListFilters) {
  const where = listWhere(filters);
  const totalRows = await prisma.restaurant.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const page = clampPage(filters.page, totalPages);
  const restaurants = await prisma.restaurant.findMany({
    where,
    include: publicRestaurantInclude,
    orderBy: { id: "asc" },
    skip: (page - 1) * perPage,
    take: perPage
  });

  return {
    restaurants: restaurants.map(toRestaurantViewFromPrisma),
    totalRows,
    totalPages,
    page,
    perPage
  };
}

export function buildListPath(filters: ListFilters, page: number): string {
  const query = filters.keyword ? `?search_keyword=${encodeURIComponent(filters.keyword)}` : "";
  return `/listdata/${filters.location}/${filters.foodType}/${filters.maxPrice}/${filters.minPrice}/${page}${query}`;
}

export function describeFilters(filters: ListFilters): string {
  const parts: string[] = [];
  if (filters.location !== "0") {
    const region = labelFor(regions, filters.regionId, "");
    const section = filters.sectionId ? labelFor(getSections(filters.regionId), filters.sectionId, "") : "";
    parts.push(`地點為${region}${section}`);
  }
  if (filters.foodType) parts.push(`美食類型為${labelFor(foodTypes, filters.foodType, "")}`);
  if (filters.maxPrice || filters.minPrice) {
    const max = filters.maxPrice === 0 ? "無上限" : `${filters.maxPrice}元`;
    parts.push(`平均價位由${filters.minPrice}元至${max}`);
  }
  if (filters.keyword) parts.push(`關鍵字為${filters.keyword}`);
  return `${parts.length ? parts.join("，") : "所有"}的餐廳`;
}

export async function getRestaurantDetail(id: number): Promise<RestaurantView | null> {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      id,
      closed: { not: 1 }
    },
    include: publicRestaurantInclude
  });
  return restaurant ? toRestaurantViewFromPrisma(restaurant) : null;
}

export async function getRestaurantForAdmin(id: number): Promise<RestaurantView | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id }
  });
  return restaurant ? toRestaurantViewFromPrisma(restaurant) : null;
}

export async function pickRestaurant(criteria: RestaurantCriteria): Promise<RestaurantView | null> {
  const where = criteriaWhere(criteria);
  const candidateCount = await prisma.restaurant.count({ where });
  if (candidateCount === 0) return null;

  const [selected] = await prisma.restaurant.findMany({
    where,
    include: publicRestaurantInclude,
    orderBy: { id: "asc" },
    skip: Math.floor(Math.random() * candidateCount),
    take: 1
  });

  return selected ? toRestaurantViewFromPrisma(selected) : null;
}

export async function listAllRestaurants(): Promise<RestaurantView[]> {
  const restaurants = await prisma.restaurant.findMany({
    include: publicRestaurantInclude,
    orderBy: { id: "asc" }
  });
  return restaurants.map(toRestaurantViewFromPrisma);
}

export async function listPublicRestaurants({ limit = defaultPublicListLimit } = {}): Promise<RestaurantView[]> {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      closed: { not: 1 }
    },
    include: publicRestaurantInclude,
    orderBy: { id: "asc" },
    take: Math.min(Math.max(1, limit), defaultPublicListLimit)
  });
  return restaurants.map(toRestaurantViewFromPrisma);
}

export async function createRestaurant(input: Omit<Restaurant, "id">): Promise<RestaurantView> {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: input.res_name,
      areaNum: input.res_area_num,
      telNum: input.res_tel_num,
      region: input.res_region,
      section: input.res_section,
      address: input.res_address,
      foodType: input.res_foodtype,
      price: input.res_price,
      openTime: input.res_open_time,
      closeTime: input.res_close_time,
      note: input.res_note,
      imageUrl: input.res_img_url,
      originalImage: input.res_img_ori_url ?? "",
      updatedAtUnix: input.res_updatetime ?? 0,
      postId: input.res_post_id ?? 0,
      closed: input.res_close ?? 0
    }
  });
  return toRestaurantViewFromPrisma(restaurant);
}

export async function updateRestaurant(
  id: number,
  input: Partial<Omit<Restaurant, "id">>
): Promise<RestaurantView | null> {
  try {
    const existing = await prisma.restaurant.findUnique({ where: { id } });
    if (!existing) return null;
    const city = input.res_region === undefined
      ? null
      : await prisma.city.findUnique({ where: { legacyRegion: input.res_region } });
    const district = city && input.res_section !== undefined
      ? await prisma.district.findUnique({
          where: { cityId_legacySection: { cityId: city.id, legacySection: input.res_section } }
        })
      : null;
    const phoneArea = input.res_area_num ?? existing.areaNum ?? "";
    const phoneNumber = input.res_tel_num ?? existing.telNum ?? "";
    const adminData = {
      name: input.res_name,
      areaNum: input.res_area_num,
      telNum: input.res_tel_num,
      region: input.res_region,
      section: input.res_section,
      address: input.res_address,
      foodType: input.res_foodtype,
      price: input.res_price,
      note: input.res_note,
      imageUrl: input.res_img_url,
      closed: input.res_close
    } as const;
    let manualOverrideFields: string | null | undefined;
    if (existing.importKey) {
      let previous: string[] = [];
      try {
        const parsed = JSON.parse(existing.manualOverrideFields ?? "[]");
        if (Array.isArray(parsed)) previous = parsed.filter((field): field is string => typeof field === "string");
      } catch {
        previous = [];
      }
      const changed = Object.entries(adminData)
        .filter(([, value]) => value !== undefined)
        .filter(([field, value]) => existing[field as keyof typeof existing] !== value)
        .map(([field]) => field);
      manualOverrideFields = JSON.stringify([...new Set([...previous, ...changed])].sort());
    }
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...adminData,
        phone: input.res_area_num !== undefined || input.res_tel_num !== undefined
          ? phoneNumber ? `${phoneArea} ${phoneNumber}`.trim() : null
          : undefined,
        cityId: city?.id,
        districtId: district?.id,
        updatedAtUnix: input.res_updatetime,
        manualOverrideFields
      }
    });
    return toRestaurantViewFromPrisma(restaurant);
  } catch {
    return null;
  }
}

export function restaurantFromForm(input: Record<string, FormDataEntryValue>): Omit<Restaurant, "id"> {
  return {
    res_name: String(input.res_name ?? ""),
    res_area_num: String(input.res_area_num ?? "02").padStart(2, "0"),
    res_tel_num: String(input.res_tel_num ?? ""),
    res_region: toInt(String(input.res_region ?? "0")),
    res_section: toInt(String(input.res_section ?? "0")),
    res_address: String(input.res_address ?? ""),
    res_foodtype: toInt(String(input.res_foodtype ?? "0")),
    res_price: toInt(String(input.res_price ?? "0")),
    res_open_time: 0,
    res_close_time: 0,
    res_note: String(input.res_note ?? ""),
    res_img_url: String(input.res_img_url ?? "preview_1380970870.jpg"),
    res_img_ori_url: "",
    res_updatetime: Math.floor(Date.now() / 1000),
    res_post_id: 0,
    res_close: 0
  };
}

export function restaurantFromAdminForm(input: unknown): Omit<Restaurant, "id"> {
  const data = restaurantAdminSchema.parse(input);
  const areaNum = data.res_area_num || "02";

  return {
    res_name: data.res_name,
    res_area_num: areaNum.padStart(2, "0"),
    res_tel_num: data.res_tel_num,
    res_region: data.res_region,
    res_section: data.res_section,
    res_address: data.res_address,
    res_foodtype: data.res_foodtype,
    res_price: data.res_price,
    res_open_time: 0,
    res_close_time: 0,
    res_note: data.res_note,
    res_img_url: data.res_img_url,
    res_img_ori_url: "",
    res_updatetime: Math.floor(Date.now() / 1000),
    res_post_id: 0,
    res_close: data.res_close
  };
}
