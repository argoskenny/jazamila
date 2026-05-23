import { listAllRestaurants } from "@/lib/domain/restaurants";

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
    res_img_url: `http://jazamila.com/assets/pics/${restaurant.res_img_url}`
  }));

  return Response.json(data);
}
