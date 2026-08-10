import { parsePreferenceFoodTypes } from "@/lib/cookies";
import { jsonValidationError, readRequestInput } from "@/lib/http";
import { pickRestaurant } from "@/lib/domain/restaurants";

function toInt(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    const criteria = {
      regionId: toInt(input.foodwhere_region),
      sectionId: toInt(input.foodwhere_section),
      maxPrice: toInt(input.foodmoney_max),
      minPrice: toInt(input.foodmoney_min),
      foodType: 0,
      foodTypes: parsePreferenceFoodTypes(String(input.foodtype ?? ""))
    };
    const restaurant = await pickRestaurant(criteria);
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

    return response;
  } catch (error) {
    return jsonValidationError(error);
  }
}
