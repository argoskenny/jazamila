import { listAllRestaurants } from "@/lib/domain/restaurants";

function publicAssetUrl(path: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return appUrl ? `${appUrl}${path}` : path;
}

export async function GET() {
  const restaurants = await listAllRestaurants();
  const data = restaurants.map((restaurant) => ({
    id: restaurant.id,
    res_name: restaurant.res_name,
    res_region: restaurant.regionLabel,
    res_section: restaurant.sectionLabel,
    res_price: restaurant.res_price,
    res_foodtype: restaurant.foodTypeLabel,
    res_address: restaurant.res_address,
    res_img_url: publicAssetUrl(`/assets/pics/${restaurant.res_img_url}`)
  }));

  return Response.json(data);
}
