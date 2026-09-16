import type { ListFilters } from "@/lib/domain/types";
import { parsePreferenceCuisineTypes } from "@/lib/cookies";

export const sortOptions = [
  { value: "id", label: "預設順序" }, { value: "price_asc", label: "平均價位：低到高" },
  { value: "price_desc", label: "平均價位：高到低" }, { value: "rating", label: "評分優先" },
  { value: "reviews", label: "評論數優先" }
];
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const integer = (value: string | undefined, fallback = 0) => {
  const result = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(result) && result >= 0 ? result : fallback;
};
export function priceRangeError(min: number, max: number): string {
  return max > 0 && max !== 1100 && min > max ? "價格上限不可低於下限，請重新選擇。" : "";
}
export function parseListFilters(segments?: string[], query: Record<string, string | string[] | undefined> = {}): ListFilters {
  const [location = "0", rawType = "0", max, min, page] = segments ?? [];
  let type = rawType;
  try { type = decodeURIComponent(rawType); } catch { /* Invalid URL tokens simply match no cuisine. */ }
  const [region, section] = location.split("X");
  const regionId = integer(region), sectionId = regionId ? integer(section) : 0;
  const cuisineTokens = parsePreferenceCuisineTypes(first(query.ct));
  return {
    location: regionId ? `${regionId}X${sectionId}` : "0", regionId, sectionId,
    foodType: type.startsWith("c:") ? 0 : integer(type),
    ...(type.startsWith("c:") ? { cuisineTypeCode: type.slice(2) } : {}),
    ...(cuisineTokens.length ? { cuisineTokens } : {}),
    maxPrice: integer(max) === 1100 ? 0 : integer(max), minPrice: integer(min) === 1100 ? 1000 : integer(min), page: Math.max(1, integer(page, 1)),
    keyword: first(query.search_keyword).trim(),
    ...(sortOptions.some((option) => option.value === first(query.sort)) ? { sort: first(query.sort) } : {})
  };
}
export function filterCuisineTokens(filters: ListFilters): string[] {
  return filters.cuisineTokens ?? (filters.cuisineTypeCode ? [`code:${filters.cuisineTypeCode}`]
    : filters.foodType > 0 ? [`legacy:${filters.foodType}`] : []);
}
export function buildListPath(filters: ListFilters, page = 1): string {
  const tokens = filterCuisineTokens(filters);
  const type = tokens.length === 1 ? tokens[0].startsWith("code:") ? `c:${encodeURIComponent(tokens[0].slice(5))}` : tokens[0].slice(7) : "0";
  const query = new URLSearchParams();
  if (filters.keyword) query.set("search_keyword", filters.keyword);
  if (tokens.length > 1) query.set("ct", tokens.join(","));
  if (filters.sort && filters.sort !== "id") query.set("sort", filters.sort);
  const search = query.size ? `?${query.toString()}` : "";
  return `/listdata/${filters.location}/${type}/${filters.maxPrice}/${filters.minPrice}/${page}${search}`;
}
export function validListReturnPath(value: string): string | null {
  if (!/^\/listdata(?:\/|\?|$)/.test(value) || value.includes("\\")) return null;
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return null;
    return url.pathname + url.search;
  } catch { return null; }
}
