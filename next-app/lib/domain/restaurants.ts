import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { clampPage } from "@/lib/pagination";
import { foodTypes, getSections, labelFor, regions } from "@/lib/domain/sections";
import type { ListFilters, Restaurant, RestaurantCriteria, RestaurantView } from "@/lib/domain/types";

const perPage = 10;

type PrismaRestaurant = Prisma.RestaurantGetPayload<object>;

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

  if (criteria.regionId) where.region = criteria.regionId;
  if (criteria.sectionId) where.section = criteria.sectionId;
  if (criteria.foodType) where.foodType = criteria.foodType;
  if (criteria.maxPrice && criteria.maxPrice < 1100) where.price = { ...(where.price as object), lte: criteria.maxPrice };
  if (criteria.minPrice) where.price = { ...(where.price as object), gte: criteria.minPrice };

  return where;
}

function listWhere(filters: ListFilters): Prisma.RestaurantWhereInput {
  const where = criteriaWhere(filters);

  if (filters.keyword) {
    where.OR = [
      { name: { contains: filters.keyword } },
      { address: { contains: filters.keyword } },
      { note: { contains: filters.keyword } }
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
    res_img_url: restaurant.imageUrl ?? "preview_1380970870.jpg",
    res_img_ori_url: restaurant.originalImage ?? "",
    res_updatetime: restaurant.updatedAtUnix === null ? 0 : Number(restaurant.updatedAtUnix),
    res_post_id: Number(restaurant.postId),
    res_close: restaurant.closed
  };
}

export function toRestaurantView(restaurant: Restaurant): RestaurantView {
  const tel = restaurant.res_tel_num ? `(${restaurant.res_area_num}) ${restaurant.res_tel_num}` : "未提供";

  return {
    ...restaurant,
    regionLabel: labelFor(regions, restaurant.res_region, "未知縣市"),
    sectionLabel: labelFor(getSections(restaurant.res_region), restaurant.res_section, "未知區域"),
    foodTypeLabel: labelFor(foodTypes, restaurant.res_foodtype, "未分類"),
    telLabel: tel,
    priceLabel: restaurant.res_price > 0 ? `${restaurant.res_price} 元左右` : "價格彈性",
    imagePath: `/assets/post/${restaurant.res_img_url}`
  };
}

function toRestaurantViewFromPrisma(restaurant: PrismaRestaurant): RestaurantView {
  return toRestaurantView(fromPrismaRestaurant(restaurant));
}

export async function listRestaurants(filters: ListFilters) {
  const where = listWhere(filters);
  const totalRows = await prisma.restaurant.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const page = clampPage(filters.page, totalPages);
  const restaurants = await prisma.restaurant.findMany({
    where,
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
    }
  });
  return restaurant ? toRestaurantViewFromPrisma(restaurant) : null;
}

export async function pickRestaurant(criteria: RestaurantCriteria): Promise<RestaurantView | null> {
  const where = criteriaWhere(criteria);
  const candidateCount = await prisma.restaurant.count({ where });
  if (candidateCount === 0) return null;

  const [selected] = await prisma.restaurant.findMany({
    where,
    orderBy: { id: "asc" },
    skip: Math.floor(Math.random() * candidateCount),
    take: 1
  });

  return selected ? toRestaurantViewFromPrisma(selected) : null;
}

export async function listAllRestaurants(): Promise<RestaurantView[]> {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { id: "asc" }
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
    const restaurant = await prisma.restaurant.update({
      where: { id },
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
        originalImage: input.res_img_ori_url,
        updatedAtUnix: input.res_updatetime,
        postId: input.res_post_id,
        closed: input.res_close
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
