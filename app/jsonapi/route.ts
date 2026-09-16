import { createHash } from "node:crypto";
import { listPublicRestaurantApiPage, listPublicRestaurantApiRows } from "@/lib/domain/restaurants";

export const revalidate = 3_600;

function publicImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return appUrl ? `${appUrl}${path}` : path;
}

export async function GET(request?: Request) {
  const query = request ? new URL(request.url).searchParams : new URLSearchParams();
  const paginated = query.has("page") || query.has("per_page");
  const positiveInteger = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const result = paginated ? await listPublicRestaurantApiPage(positiveInteger(query.get("page"), 1), Math.min(100, positiveInteger(query.get("per_page"), 100))) : null;
  const restaurants = result?.restaurants ?? await listPublicRestaurantApiRows();
  const data = restaurants.map((restaurant) => ({
    id: restaurant.id,
    res_name: restaurant.res_name,
    res_region: restaurant.res_region,
    res_section: restaurant.res_section,
    res_price: restaurant.res_price,
    res_foodtype: restaurant.res_foodtype,
    res_address: restaurant.res_address,
    res_img_url: publicImageUrl(restaurant.imagePath)
  }));
  const body = JSON.stringify(data);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
  const headers = {
    "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    ETag: etag,
    ...(result ? {
      "X-Total-Count": String(result.total), "X-Page": String(result.page),
      "X-Total-Pages": String(result.pages), "X-Per-Page": String(result.perPage)
    } : {})
  };

  if (request?.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
