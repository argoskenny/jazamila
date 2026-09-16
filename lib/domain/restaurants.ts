import type { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { clampPage } from "@/lib/pagination";
import { foodTypes, getSections, labelFor, regions } from "@/lib/domain/sections";
import {
  cuisineTypeForLegacyFoodType,
  cuisineTypeOptionFor,
  type CuisineTypeRecord
} from "@/lib/domain/cuisine-types";
import type { AuxiliaryTagOption, CuisineTypeOption, ListFilters, Restaurant, RestaurantCriteria, RestaurantView } from "@/lib/domain/types";
import { restaurantAdminSchema } from "@/lib/validation/forms";

import { parseListFilters, buildListPath, filterCuisineTokens, priceRangeError } from "@/lib/domain/list-filters";
export { parseListFilters, buildListPath };

const perPage = 10;

type PrismaRestaurant = Prisma.RestaurantGetPayload<object> & {
  city?: { name: string } | null;
  district?: { name: string } | null;
  cuisineType?: { id: number; code: string; name: string; normalizedName: string; status: string } | null;
  tags?: Array<{
    position: number;
    owner?: string;
    sourceName?: string | null;
    kind?: string;
    isPublic?: boolean;
    visibilityReason?: string | null;
    tag: { id?: number; name: string; normalizedName?: string };
  }>;
};

const publicRestaurantInclude = {
  city: { select: { name: true } },
  district: { select: { name: true } },
  cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
  tags: {
    where: { isPublic: true, kind: "auxiliary" },
    orderBy: { position: "asc" as const },
    include: { tag: { select: { id: true, name: true, normalizedName: true } } }
  }
};

const adminRestaurantInclude = {
  city: { select: { name: true } },
  district: { select: { name: true } },
  cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
  tags: {
    orderBy: { position: "asc" as const },
    include: { tag: { select: { id: true, name: true, normalizedName: true } } }
  }
};

function activeCuisineTypePredicate(code: string): Prisma.RestaurantWhereInput {
  return { cuisineType: { is: { status: "active", code } } };
}

function cuisinePredicates(cuisineId: number): Prisma.RestaurantWhereInput[] {
  const legacyType = cuisineTypeForLegacyFoodType(cuisineId);
  const legacyFallback: Prisma.RestaurantWhereInput = cuisineId === 4
    ? { AND: [{ cuisineTypeId: null }, { foodType: 4 }, { importKey: null }] }
    : { AND: [{ cuisineTypeId: null }, { foodType: cuisineId }] };

  return [
    ...(legacyType ? [activeCuisineTypePredicate(legacyType.code)] : []),
    legacyFallback
  ];
}

function cuisineCodePredicates(codes: string[]): Prisma.RestaurantWhereInput[] {
  return codes.filter(Boolean).map(activeCuisineTypePredicate);
}

function criteriaWhere(criteria: RestaurantCriteria): Prisma.RestaurantWhereInput {
  if (priceRangeError(criteria.minPrice, criteria.maxPrice)) return { id: -1 };
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
  const cuisineCodes = criteria.cuisineTypeCodes?.map((code) => String(code).trim()).filter(Boolean) ?? [];
  if (cuisineIds.length > 0 || cuisineCodes.length > 0) {
    conditions.push({
      OR: [...cuisineIds.flatMap(cuisinePredicates), ...cuisineCodePredicates(cuisineCodes)]
    });
  }

  const hasUpperBound = criteria.maxPrice > 0 && criteria.maxPrice !== 1100;
  if (hasUpperBound || criteria.minPrice > 0) {
    const rangeConditions: Prisma.RestaurantWhereInput[] = [];
    if (hasUpperBound) rangeConditions.push({ OR: [{ priceMin: { lte: criteria.maxPrice } }, { priceMin: null, priceMax: { not: null } }] });
    if (criteria.minPrice > 0) rangeConditions.push({ OR: [{ priceMax: { gte: criteria.minPrice } }, { priceMax: null, priceMin: { not: null } }] });

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

  if (criteria.keyword?.trim()) {
    const keyword = criteria.keyword.trim();
    conditions.push({ OR: [
      { name: { contains: keyword } }, { address: { contains: keyword } }, { note: { contains: keyword } },
      { city: { name: { contains: keyword } } }, { district: { name: { contains: keyword } } },
      { tags: { some: { isPublic: true, kind: "auxiliary", tag: { name: { contains: keyword } } } } }
    ] });
  }
  if (criteria.excludeIds?.length) conditions.push({ id: { notIn: criteria.excludeIds } });
  if (conditions.length > 0) where.AND = conditions;

  return where;
}

function listWhere(filters: ListFilters): Prisma.RestaurantWhereInput {
  const tokens = filterCuisineTokens(filters);
  return criteriaWhere({ ...filters,
    foodType: 0,
    foodTypes: tokens.filter((v) => v.startsWith("legacy:")).map((v) => Number(v.slice(7))),
    cuisineTypeCodes: tokens.filter((v) => v.startsWith("code:")).map((v) => v.slice(5))
  });
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
    cuisine_type_id: restaurant.cuisineTypeId ?? null,
    res_price: restaurant.price,
    res_price_min: restaurant.priceMin,
    res_price_max: restaurant.priceMax,
    external_image_url: restaurant.externalImageUrl,
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

function imagePathForValue(imageUrl: string | null | undefined): string {
  const filename = (imageUrl ?? "").trim().split(/[\\/]/).pop() ?? "";
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

function normalizedTagName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("zh-TW");
}

function auditSnapshot(restaurant: PrismaRestaurant) {
  return {
    cuisineTypeId: restaurant.cuisineTypeId ?? null,
    foodType: restaurant.foodType,
    tags: (restaurant.tags ?? []).map((relation) => ({
      tagId: Number(relation.tag.id),
      name: relation.tag.name,
      normalizedName: relation.tag.normalizedName ?? normalizedTagName(relation.tag.name),
      position: relation.position,
      owner: relation.owner ?? "source",
      sourceName: relation.sourceName ?? null,
      kind: relation.kind ?? "auxiliary",
      isPublic: relation.isPublic !== false,
      visibilityReason: relation.visibilityReason ?? null,
    }))
  };
}

function auditFingerprint(snapshot: ReturnType<typeof auditSnapshot>) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

async function writeAdminClassificationAudit(
  tx: Prisma.TransactionClient,
  restaurantId: number,
  before: ReturnType<typeof auditSnapshot>,
  after: ReturnType<typeof auditSnapshot>,
  action: string
) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const batchId = `admin-classification-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await tx.cuisineApplyBatch.create({
    data: { id: batchId, status: "applied", source: "admin-ui", createdBy: "manual" }
  });
  await tx.cuisineApplyChange.create({
    data: {
      batchId,
      restaurantId,
      inputFingerprint: auditFingerprint(before),
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(after),
      decisionJson: JSON.stringify({ version: "admin-classification-v1", action }),
      actionStatus: "applied",
      protectedFieldsJson: JSON.stringify(["cuisineTypeId", "tags"])
    }
  });
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
    cuisineTypeId: null,
    cuisineTypeCode: null,
    cuisineTypeLabel: labelFor(foodTypes, restaurant.res_foodtype, "未分類"),
    telLabel: tel,
    priceLabel: restaurant.res_price > 0 ? `${restaurant.res_price} 元左右` : "價格彈性",
    imagePath: imagePathForValue(restaurant.res_img_url),
    fallbackImagePath: defaultRestaurantImagePath,
    cityLabel: labelFor(regions, restaurant.res_region, "未知縣市"),
    districtLabel: labelFor(getSections(restaurant.res_region), restaurant.res_section, ""),
    tags: [],
    auxiliaryTags: [],
    auxiliaryTagIds: [],
    hiddenSourceTags: [],
    ratingPlatform: "",
    ratingScore: null,
    ratingReviewCount: null,
    reviewSummaries: [],
    businessHoursLabel: "營業時間未提供",
    phoneHref: restaurant.res_tel_num ? `tel:${`${restaurant.res_area_num}${restaurant.res_tel_num}`.replace(/[^\d+]/g, "")}` : null,
    mapHref: restaurant.res_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.res_address)}` : null
  };
}

function sourceLinksFor(value: string | null): Array<{ label: string; url: string }> {
  try {
    const refs = JSON.parse(value ?? "[]");
    if (!Array.isArray(refs)) return [];
    return refs.flatMap((ref) => {
      const url = typeof ref === "string" ? ref : ref?.url;
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return [];
      try { return [{ label: new URL(url).hostname, url }]; } catch { return []; }
    }).slice(0, 4);
  } catch { return []; }
}

export function toRestaurantViewFromPrisma(restaurant: PrismaRestaurant): RestaurantView {
  const legacy = fromPrismaRestaurant(restaurant);
  const base = toRestaurantView(legacy);
  const fallbackImagePath = defaultRestaurantImagePath;
  const externalImageUrl = restaurant.externalImageUrl?.trim();
  const auxiliaryTags = restaurant.tags
    ?.filter((relation) => relation.isPublic !== false && (relation.kind ?? "auxiliary") === "auxiliary")
    ?.filter((relation) => !(
      restaurant.cuisineType?.status === "active" &&
      relation.tag.normalizedName &&
      relation.tag.normalizedName === restaurant.cuisineType.normalizedName
    ))
    .map((relation) => relation.tag.name)
    .filter(Boolean) ?? [];
  const hiddenSourceTags = restaurant.tags
    ?.filter((relation) => relation.isPublic === false || (relation.kind ?? "auxiliary") !== "auxiliary")
    .map((relation) => ({
      id: Number(relation.tag.id ?? relation.position),
      name: relation.tag.name,
      owner: relation.owner ?? "source",
      sourceName: relation.sourceName ?? null,
      kind: relation.kind ?? "auxiliary",
      reason: relation.visibilityReason ?? ((relation.kind ?? "auxiliary") === "legacy_cuisine" ? "與 canonical 料理類型重複" : "不公開"),
    })) ?? [];
  const auxiliaryTagIds = restaurant.tags
    ?.filter((relation) => relation.isPublic !== false && (relation.kind ?? "auxiliary") === "auxiliary")
    .map((relation) => Number(relation.tag.id))
    .filter((id) => Number.isInteger(id)) ?? [];
  const phone = restaurant.phone?.trim() || base.telLabel;
  const phoneDigits = phone === "未提供" ? "" : phone.replace(/[^\d+]/g, "");
  const cuisineTypeLabel = restaurant.cuisineType?.name || (legacy.res_foodtype > 0 ? base.foodTypeLabel : "未分類");

  return {
    ...base,
    telLabel: phone,
    phoneHref: phoneDigits ? `tel:${phoneDigits}` : null,
    sourceLinks: sourceLinksFor(restaurant.sourceRefsJson),
    priceLabel: formatPriceRange(restaurant.priceMin, restaurant.priceMax, legacy.res_price),
    imagePath: externalImageUrl && /^https?:\/\//i.test(externalImageUrl) ? externalImageUrl : base.imagePath,
    fallbackImagePath,
    cityLabel: restaurant.city?.name || base.regionLabel,
    districtLabel: restaurant.district?.name || base.sectionLabel,
    foodTypeLabel: cuisineTypeLabel,
    cuisineTypeId: restaurant.cuisineTypeId ?? null,
    cuisineTypeCode: restaurant.cuisineType?.code ?? null,
    cuisineTypeLabel,
    tags: auxiliaryTags,
    auxiliaryTags,
    auxiliaryTagIds,
    hiddenSourceTags,
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
    orderBy: filters.sort === "price_asc" ? [{ price: "asc" }, { id: "asc" }]
      : filters.sort === "price_desc" ? [{ price: "desc" }, { id: "asc" }]
      : filters.sort === "rating" ? [{ ratingScore: { sort: "desc", nulls: "last" } }, { ratingReviewCount: "desc" }, { id: "asc" }]
      : filters.sort === "reviews" ? [{ ratingReviewCount: { sort: "desc", nulls: "last" } }, { id: "asc" }]
      : { id: "asc" },
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
    where: { id },
    include: adminRestaurantInclude
  });
  return restaurant ? toRestaurantViewFromPrisma(restaurant) : null;
}

export async function getActiveCuisineTypeOptions(): Promise<CuisineTypeOption[]> {
  const types = await prisma.cuisineType.findMany({
    where: { status: "active" },
    select: { id: true, code: true, name: true, normalizedName: true, status: true, createdBy: true, legacyFoodType: true },
    orderBy: [{ legacyFoodType: "asc" }, { id: "asc" }]
  });
  return types.map((type) => cuisineTypeOptionFor(type as CuisineTypeRecord));
}

export async function getAuxiliaryTagOptions(): Promise<AuxiliaryTagOption[]> {
  const tags = await prisma.tag.findMany({
    where: { restaurants: { some: { kind: "auxiliary" } } },
    select: { id: true, name: true, normalizedName: true },
    orderBy: [{ normalizedName: "asc" }, { id: "asc" }]
  });
  return tags;
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

export async function listPublicRestaurantIds(): Promise<number[]> {
  const restaurants = await prisma.restaurant.findMany({
    where: { closed: { not: 1 } },
    select: { id: true },
    orderBy: { id: "asc" }
  });
  return restaurants.map((restaurant) => restaurant.id);
}

export async function listPublicRestaurantApiRows(pagination?: { page: number; perPage: number }) {
  const restaurants = await prisma.restaurant.findMany({
    where: { closed: { not: 1 } },
    select: {
      id: true,
      name: true,
      region: true,
      section: true,
      price: true,
      foodType: true,
      address: true,
      imageUrl: true,
      externalImageUrl: true,
      cuisineType: { select: { name: true } }
    },
    ...(pagination ? { skip: (pagination.page - 1) * pagination.perPage, take: pagination.perPage } : {}),
    orderBy: { id: "asc" }
  });

  return restaurants.map((restaurant) => {
    const externalImageUrl = restaurant.externalImageUrl?.trim();
    return {
      id: restaurant.id,
      res_name: restaurant.name,
      res_region: labelFor(regions, restaurant.region, "未知縣市"),
      res_section: labelFor(getSections(restaurant.region), restaurant.section, "未知區域"),
      res_price: restaurant.price,
      res_foodtype: restaurant.cuisineType?.name ?? labelFor(foodTypes, restaurant.foodType, "未分類"),
      res_address: restaurant.address ?? "",
      imagePath: externalImageUrl && /^https?:\/\//i.test(externalImageUrl)
        ? externalImageUrl
        : imagePathForValue(restaurant.imageUrl)
    };
  });
}

export async function listPublicRestaurantApiPage(page: number, perPage: number) {
  const total = await prisma.restaurant.count({ where: { closed: { not: 1 } } });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = clampPage(page, pages);
  const restaurants = await listPublicRestaurantApiRows({ page: currentPage, perPage });
  return { restaurants, total, page: currentPage, pages, perPage };
}

async function resolveLocation(
  tx: Prisma.TransactionClient,
  region: number,
  section: number
): Promise<{ cityId: number | null; districtId: number | null }> {
  const city = region > 0
    ? await tx.city.findUnique({ where: { legacyRegion: region } })
    : null;
  if (region > 0 && !city) throw new Error("無效的縣市");
  if (region === 0 && section > 0) throw new Error("地區必須隸屬於有效縣市");

  const district = city && section > 0
    ? await tx.district.findUnique({
        where: { cityId_legacySection: { cityId: city.id, legacySection: section } }
      })
    : null;
  if (section > 0 && !district) throw new Error("地區與縣市不相符");

  return { cityId: city?.id ?? null, districtId: district?.id ?? null };
}

async function createRestaurantInTransaction(
  tx: Prisma.TransactionClient,
  input: Omit<Restaurant, "id">
) {
  const selectedCuisineType = input.cuisine_type_id && input.cuisine_type_id > 0
    ? await tx.cuisineType.findFirst({ where: { id: input.cuisine_type_id, status: "active" } })
    : null;
  if (input.cuisine_type_id && input.cuisine_type_id > 0 && !selectedCuisineType) {
    throw new Error("只能選擇 active CuisineType");
  }
  const location = await resolveLocation(tx, input.res_region, input.res_section);
  const phone = input.res_tel_num
    ? `${input.res_area_num} ${input.res_tel_num}`.trim()
    : null;

  return tx.restaurant.create({
    data: {
      name: input.res_name,
      areaNum: input.res_area_num,
      telNum: input.res_tel_num,
      region: input.res_region,
      section: input.res_section,
      address: input.res_address,
      foodType: selectedCuisineType ? selectedCuisineType.legacyFoodType ?? 0 : input.res_foodtype,
      cuisineTypeId: selectedCuisineType?.id ?? null,
      price: input.res_price,
      priceMin: input.res_price_min,
      priceMax: input.res_price_max,
      externalImageUrl: input.external_image_url,
      openTime: input.res_open_time,
      closeTime: input.res_close_time,
      note: input.res_note,
      imageUrl: input.res_img_url,
      originalImage: input.res_img_ori_url ?? "",
      updatedAtUnix: input.res_updatetime ?? 0,
      postId: input.res_post_id ?? 0,
      closed: input.res_close ?? 0,
      phone,
      cityId: location.cityId,
      districtId: location.districtId
    },
    include: adminRestaurantInclude
  });
}

async function updateRestaurantInTransaction(
  tx: Prisma.TransactionClient,
  id: number,
  input: Partial<Omit<Restaurant, "id">>
){
  const beforeRestaurant = await tx.restaurant.findUnique({ where: { id }, include: adminRestaurantInclude });
  if (!beforeRestaurant) return null;

  const changesRegion = input.res_region !== undefined;
  const changesSection = input.res_section !== undefined;
  if (changesRegion !== changesSection) {
    throw new Error("縣市與地區必須同時更新");
  }
  const location = changesRegion && changesSection
    ? await resolveLocation(tx, input.res_region!, input.res_section!)
    : null;
  const phoneArea = input.res_area_num ?? beforeRestaurant.areaNum ?? "";
  const phoneNumber = input.res_tel_num ?? beforeRestaurant.telNum ?? "";
  const selectedCuisineType = input.cuisine_type_id === undefined || input.cuisine_type_id === null || input.cuisine_type_id === 0
    ? input.cuisine_type_id === undefined ? undefined : null
    : await tx.cuisineType.findFirst({ where: { id: input.cuisine_type_id, status: "active" } });
  if (input.cuisine_type_id && input.cuisine_type_id > 0 && !selectedCuisineType) {
    throw new Error("只能選擇 active CuisineType");
  }

  const adminData = {
    name: input.res_name,
    areaNum: input.res_area_num,
    telNum: input.res_tel_num,
    region: input.res_region,
    section: input.res_section,
    address: input.res_address,
    foodType: input.cuisine_type_id === undefined
      ? input.res_foodtype
      : selectedCuisineType?.legacyFoodType ?? 0,
    cuisineTypeId: input.cuisine_type_id === undefined ? undefined : selectedCuisineType?.id ?? null,
    price: (input.res_price_min != null || input.res_price_max != null)
      && input.res_price_min === beforeRestaurant.priceMin && input.res_price_max === beforeRestaurant.priceMax
      ? beforeRestaurant.price : input.res_price,
    priceMin: input.res_price_min !== undefined ? input.res_price_min
      : input.res_price !== undefined && input.res_price !== beforeRestaurant.price ? input.res_price : undefined,
    priceMax: input.res_price_max !== undefined ? input.res_price_max
      : input.res_price !== undefined && input.res_price !== beforeRestaurant.price ? input.res_price : undefined,
    externalImageUrl: input.external_image_url !== undefined ? input.external_image_url || null
      : input.res_img_url !== undefined && input.res_img_url !== (beforeRestaurant.imageUrl ?? "") ? null : undefined,
    note: input.res_note,
    imageUrl: input.res_img_url === "" && beforeRestaurant.imageUrl == null
      ? beforeRestaurant.imageUrl
      : input.res_img_url,
    closed: input.res_close
  } as const;
  const changedFields = Object.entries(adminData)
    .filter(([, value]) => value !== undefined)
    .filter(([field, value]) => beforeRestaurant[field as keyof typeof beforeRestaurant] !== value)
    .map(([field]) => field);
  const manualOverrideFields = changedFields.length === 0
    ? beforeRestaurant.manualOverrideFields
    : JSON.stringify([...new Set([...parseStringArray(beforeRestaurant.manualOverrideFields), ...changedFields])].sort());
  const before = auditSnapshot(beforeRestaurant as PrismaRestaurant);

  await tx.restaurant.update({
    where: { id },
    data: {
      ...adminData,
      phone: phoneArea !== (beforeRestaurant.areaNum ?? "") || phoneNumber !== (beforeRestaurant.telNum ?? "")
        ? phoneNumber ? `${phoneArea} ${phoneNumber}`.trim() : null
        : undefined,
      cityId: location?.cityId,
      districtId: location?.districtId,
      updatedAtUnix: input.res_updatetime,
      manualOverrideFields
    }
  });
  const restaurant = await tx.restaurant.findUnique({ where: { id }, include: adminRestaurantInclude });
  if (!restaurant) return null;
  const after = auditSnapshot(restaurant as PrismaRestaurant);
  if (before.cuisineTypeId !== after.cuisineTypeId) {
    await writeAdminClassificationAudit(tx, id, before, after, "update-cuisine-type");
  }
  return restaurant;
}

async function updateRestaurantAuxiliaryTagsInTransaction(
  tx: Prisma.TransactionClient,
  id: number,
  selectedTagIds: number[],
  newTagNames: string[]
){
  const selected = new Set(selectedTagIds.filter((tagId) => Number.isInteger(tagId) && tagId > 0));
  const requestedNames = [...new Set(newTagNames.map((name) => name.normalize("NFKC").replace(/\s+/gu, " ").trim()).filter(Boolean))];
  const beforeRestaurant = await tx.restaurant.findUnique({ where: { id }, include: adminRestaurantInclude });
  if (!beforeRestaurant) throw new Error("找不到餐廳");
  const before = auditSnapshot(beforeRestaurant as PrismaRestaurant);

  for (const name of requestedNames) {
    const normalizedName = normalizedTagName(name);
    const tag = await tx.tag.upsert({
      where: { normalizedName },
      update: {},
      create: { name, normalizedName }
    });
    selected.add(tag.id);
  }

  const selectedTags = selected.size > 0
    ? await tx.tag.findMany({ where: { id: { in: [...selected] } }, select: { id: true } })
    : [];
  if (selectedTags.length !== selected.size) throw new Error("包含不存在的輔助標籤");

  const relationByTagId = new Map(beforeRestaurant.tags.map((relation) => [relation.tagId, relation]));
  for (const relation of beforeRestaurant.tags) {
    if ((relation.kind ?? "auxiliary") !== "auxiliary" || selected.has(relation.tagId) || !relation.isPublic) continue;
    await tx.restaurantTag.update({
      where: { restaurantId_tagId: { restaurantId: id, tagId: relation.tagId } },
      data: {
        owner: "manual",
        kind: "auxiliary",
        isPublic: false,
        visibilityReason: "admin-removed"
      }
    });
  }

  let nextPosition = beforeRestaurant.tags.reduce((max, relation) => Math.max(max, relation.position), -1) + 1;
  for (const tagId of selected) {
    const existingRelation = relationByTagId.get(tagId);
    if (
      existingRelation?.owner === "manual" &&
      existingRelation.kind === "auxiliary" &&
      existingRelation.isPublic &&
      existingRelation.visibilityReason === null
    ) continue;

    await tx.restaurantTag.upsert({
      where: { restaurantId_tagId: { restaurantId: id, tagId } },
      update: { owner: "manual", kind: "auxiliary", isPublic: true, visibilityReason: null },
      create: {
        restaurantId: id,
        tagId,
        position: nextPosition++,
        owner: "manual",
        kind: "auxiliary",
        isPublic: true
      }
    });
  }

  const afterRestaurant = await tx.restaurant.findUnique({ where: { id }, include: adminRestaurantInclude });
  if (!afterRestaurant) throw new Error("儲存輔助標籤後找不到餐廳");
  const after = auditSnapshot(afterRestaurant as PrismaRestaurant);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    const currentFields = parseStringArray(beforeRestaurant.manualOverrideFields);
    await tx.restaurant.update({
      where: { id },
      data: { manualOverrideFields: JSON.stringify([...new Set([...currentFields, "tags"])].sort()) }
    });
  }
  await writeAdminClassificationAudit(tx, id, before, after, "update-auxiliary-tags");
  return afterRestaurant;
}

export async function createRestaurantWithAuxiliaryTags(
  input: Omit<Restaurant, "id">,
  selectedTagIds: number[],
  newTagNames: string[]
): Promise<RestaurantView> {
  return prisma.$transaction(async (tx) => {
    const restaurant = await createRestaurantInTransaction(tx, input);
    const hydrated = await updateRestaurantAuxiliaryTagsInTransaction(tx, restaurant.id, selectedTagIds, newTagNames);
    return toRestaurantViewFromPrisma(hydrated);
  });
}

export async function updateRestaurantWithAuxiliaryTags(
  id: number,
  input: Partial<Omit<Restaurant, "id">>,
  selectedTagIds: number[],
  newTagNames: string[]
): Promise<RestaurantView | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const restaurant = await updateRestaurantInTransaction(tx, id, input);
      if (!restaurant) return null;
      const hydrated = await updateRestaurantAuxiliaryTagsInTransaction(tx, id, selectedTagIds, newTagNames);
      return toRestaurantViewFromPrisma(hydrated);
    });
  } catch {
    return null;
  }
}

export function restaurantFromAdminForm(input: unknown): Omit<Restaurant, "id"> {
  const data = restaurantAdminSchema.parse(input);
  const areaNum = /^(09|\+)/.test(data.res_tel_num) ? "" : data.res_area_num;

  return {
    res_name: data.res_name,
    res_area_num: areaNum ? areaNum.padStart(2, "0") : "",
    res_tel_num: data.res_tel_num,
    res_region: data.res_region,
    res_section: data.res_section,
    res_address: data.res_address,
    res_foodtype: data.res_foodtype,
    cuisine_type_id: data.cuisine_type_id,
    res_price: data.res_price_min != null && data.res_price_max != null ? Math.round((data.res_price_min + data.res_price_max) / 2)
      : data.res_price_min ?? data.res_price_max ?? data.res_price,
    res_price_min: data.price_mode === "single" ? null : data.res_price_min,
    res_price_max: data.price_mode === "single" ? null : data.res_price_max,
    external_image_url: data.image_source === "local" ? "" : data.external_image_url,
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
