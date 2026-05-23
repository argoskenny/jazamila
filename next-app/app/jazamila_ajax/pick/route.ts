import { preferenceCookieNames } from "@/lib/cookies";
import { readRequestInput } from "@/lib/http";
import { pickRestaurant } from "@/lib/domain/restaurants";

function toInt(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function POST(request: Request) {
  const input = await readRequestInput(request);
  const criteria = {
    regionId: toInt(input.foodwhere_region),
    sectionId: toInt(input.foodwhere_section),
    maxPrice: toInt(input.foodmoney_max),
    minPrice: toInt(input.foodmoney_min),
    foodType: toInt(input.foodtype)
  };
  const remember = toInt(input.remember);
  const restaurant = await pickRestaurant(criteria);
  const response = Response.json({ status: "success", res_id: restaurant?.id ?? 0 });

  if (remember === 1) {
    const maxAge = 8650000;
    response.headers.append("Set-Cookie", `remember=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
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
    response.headers.append("Set-Cookie", `foodtype=${criteria.foodType}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
  } else {
    for (const name of preferenceCookieNames) {
      response.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; SameSite=Lax`);
    }
  }

  return response;
}
