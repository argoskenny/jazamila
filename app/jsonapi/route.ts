import { createHash } from "node:crypto";
import { listPublicRestaurantApiRows } from "@/lib/domain/restaurants";

export const revalidate = 3_600;

function publicImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return appUrl ? `${appUrl}${path}` : path;
}

export async function GET(request?: Request) {
  const restaurants = await listPublicRestaurantApiRows();
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
    ETag: etag
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
