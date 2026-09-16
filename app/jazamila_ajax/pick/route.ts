import { priceRangeError } from "@/lib/domain/list-filters";
import { parsePreferenceCuisineTypes, parsePreferenceFoodTypes } from "@/lib/cookies";
import { jsonValidationError, readRequestInput } from "@/lib/http";
import { pickRestaurant } from "@/lib/domain/restaurants";

function toInt(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function requestCookies(request: Request): Map<string, string> {
  return new Map(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key]) => Boolean(key))
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))])
  );
}

function recentRestaurantIds(value: string | undefined): number[] {
  return (value ?? "")
    .split("-")
    .map((id) => toInt(id))
    .filter((id) => id > 0)
    .slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    const cookies = requestCookies(request);
    const reusePreferences = String(input.reuse_preferences ?? "") === "1";
    const value = (inputValue: unknown, cookieName: string) =>
      reusePreferences && inputValue === undefined ? cookies.get(cookieName) : inputValue;
    const currentRestaurantId = toInt(input.exclude_restaurant_id);
    const recentIds = recentRestaurantIds(cookies.get("recent_restaurants"));
    const excludedIds = (cookies.get("excluded_restaurants") ?? "").split("-").filter((value) => Number(value.split("@")[1]) > Date.now()).map((value) => toInt(value.split("@")[0])).filter((id) => id > 0).slice(0, 10);
    const criteria = {
      regionId: toInt(value(input.foodwhere_region, "foodwhere_region")),
      sectionId: toInt(value(input.foodwhere_section, "foodwhere_section")),
      maxPrice: toInt(value(input.foodmoney_max, "foodmoney_max")),
      minPrice: toInt(value(input.foodmoney_min, "foodmoney_min")),
      foodType: 0,
      keyword: String(input.search_keyword ?? "").trim(),
      foodTypes: parsePreferenceFoodTypes(String(value(input.foodtype, "foodtype") ?? "")),
      cuisineTypeCodes: parsePreferenceCuisineTypes(String(value(input.cuisine_types, "cuisine_types") ?? ""))
        .map((token) => token.startsWith("code:") ? token.slice("code:".length) : "")
        .filter(Boolean),
      excludeIds: [...new Set([currentRestaurantId, ...excludedIds, ...recentIds].filter((id) => id > 0))].slice(0, 21)
    };
    const rangeError = priceRangeError(criteria.minPrice, criteria.maxPrice);
    if (rangeError) return Response.json({ status: "fail", error: rangeError }, { status: 422 });
    let restaurant = await pickRestaurant(criteria);
    if (!restaurant && criteria.excludeIds.length > 0) {
      restaurant = await pickRestaurant({
        ...criteria,
        excludeIds: [...new Set([currentRestaurantId, ...excludedIds].filter((id) => id > 0))]
      });
    }
    const response = Response.json({ status: "success", res_id: restaurant?.id ?? 0 });
    const maxAge = 8650000;
    const foodTypeCookie = criteria.foodTypes.length > 0 ? criteria.foodTypes.join("-") : "0";

    response.headers.append(
      "Set-Cookie",
      `foodwhere_region=${criteria.regionId}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
    );
    response.headers.append(
      "Set-Cookie",
      `foodwhere_section=${criteria.sectionId}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
    );
    response.headers.append("Set-Cookie", `foodmoney_max=${criteria.maxPrice}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
    response.headers.append("Set-Cookie", `foodmoney_min=${criteria.minPrice}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
    response.headers.append("Set-Cookie", `foodtype=${foodTypeCookie}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
    const cuisineTypeCookie = parsePreferenceCuisineTypes(String(value(input.cuisine_types, "cuisine_types") ?? "")).join(",");
    response.headers.append("Set-Cookie", `cuisine_types=${encodeURIComponent(cuisineTypeCookie)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
    if (restaurant) {
      const updatedRecentIds = [...new Set([restaurant.id, currentRestaurantId, ...recentIds].filter((id) => id > 0))].slice(0, 10);
      response.headers.append(
        "Set-Cookie",
        `recent_restaurants=${updatedRecentIds.join("-")}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
      );
    }

    return response;
  } catch (error) {
    return jsonValidationError(error);
  }
}
