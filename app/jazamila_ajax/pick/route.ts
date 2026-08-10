import { parsePreferenceFoodTypes } from "@/lib/cookies";
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
      reusePreferences && (inputValue === undefined || String(inputValue) === "") ? cookies.get(cookieName) : inputValue;
    const currentRestaurantId = toInt(input.exclude_restaurant_id);
    const recentIds = recentRestaurantIds(cookies.get("recent_restaurants"));
    const criteria = {
      regionId: toInt(value(input.foodwhere_region, "foodwhere_region")),
      sectionId: toInt(value(input.foodwhere_section, "foodwhere_section")),
      maxPrice: toInt(value(input.foodmoney_max, "foodmoney_max")),
      minPrice: toInt(value(input.foodmoney_min, "foodmoney_min")),
      foodType: 0,
      foodTypes: parsePreferenceFoodTypes(String(value(input.foodtype, "foodtype") ?? "")),
      excludeIds: [...new Set([currentRestaurantId, ...recentIds].filter((id) => id > 0))].slice(0, 10)
    };
    let restaurant = await pickRestaurant(criteria);
    if (!restaurant && criteria.excludeIds.length > 0) {
      restaurant = await pickRestaurant({ ...criteria, excludeIds: [] });
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
    if (restaurant) {
      const recentIds = [restaurant.id, ...criteria.excludeIds.filter((id) => id !== restaurant.id)].slice(0, 10);
      response.headers.append(
        "Set-Cookie",
        `recent_restaurants=${recentIds.join("-")}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
      );
    }

    return response;
  } catch (error) {
    return jsonValidationError(error);
  }
}
