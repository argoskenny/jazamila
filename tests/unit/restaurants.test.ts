import { describe, expect, it } from "vitest";
import {
  describeFilters,
  getRestaurantForAdmin,
  getRestaurantDetail,
  listPublicRestaurants,
  listRestaurants,
  parseListFilters,
  pickRestaurant,
  restaurantFromAdminForm,
  updateRestaurant,
  toRestaurantView
} from "@/lib/domain/restaurants";

describe("restaurant domain", () => {
  it("parses legacy listdata segments", () => {
    const filters = parseListFilters(["1X2", "1", "200", "0", "2"], { search_keyword: "Sushi" });

    expect(filters).toMatchObject({
      location: "1X2",
      regionId: 1,
      sectionId: 2,
      foodType: 1,
      maxPrice: 200,
      minPrice: 0,
      page: 2,
      keyword: "Sushi"
    });
  });

  it("filters restaurants and builds readable text", async () => {
    const filters = parseListFilters(["1X2", "1", "200", "0", "1"], {});
    const result = await listRestaurants(filters);

    expect(result.totalRows).toBe(1);
    expect(result.restaurants[0].res_name).toBe("Sushi House");
    expect(describeFilters(filters)).toContain("台北市大同區");
  });

  it("picks a restaurant by criteria", async () => {
    const restaurant = await pickRestaurant({
      regionId: 1,
      sectionId: 2,
      maxPrice: 100,
      minPrice: 0,
      foodType: 1
    });

    expect(restaurant?.id).toBe(1);
  });

  it("picks from any of the selected cuisine types", async () => {
    const restaurant = await pickRestaurant({
      regionId: 0,
      sectionId: 0,
      maxPrice: 0,
      minPrice: 0,
      foodType: 0,
      foodTypes: [2]
    });

    expect(restaurant?.res_foodtype).toBe(2);
  });

  it("lists only open public restaurants with an explicit limit", async () => {
    const restaurants = await listPublicRestaurants({ limit: 2 });

    expect(restaurants).toHaveLength(2);
    expect(restaurants.map((restaurant) => restaurant.res_name)).not.toContain("Closed Diner");
  });

  it("keeps closed restaurants hidden publicly but available to admin lookups", async () => {
    await expect(getRestaurantDetail(4)).resolves.toBeNull();
    await expect(getRestaurantForAdmin(4)).resolves.toMatchObject({ res_name: "Closed Diner", res_close: 1 });
  });

  it("uses custom restaurant image filenames when present", () => {
    const restaurant = toRestaurantView({
      id: 99,
      res_name: "有圖餐廳",
      res_area_num: "02",
      res_tel_num: "12345678",
      res_region: 1,
      res_section: 2,
      res_address: "台北市",
      res_foodtype: 1,
      res_price: 100,
      res_open_time: 0,
      res_close_time: 0,
      res_note: "",
      res_img_url: "custom photo.jpg",
      res_img_ori_url: "",
      res_updatetime: 0,
      res_post_id: 0,
      res_close: 0
    });

    expect(restaurant.imagePath).toBe("/assets/pics/custom%20photo.jpg");
  });

  it("builds admin restaurant input from parsed schema values", () => {
    const restaurant = restaurantFromAdminForm({
      res_name: "  修剪餐廳  ",
      res_area_num: "2",
      res_tel_num: "  1234567  ",
      res_region: "1",
      res_section: "2",
      res_address: "  台北市  ",
      res_foodtype: "1",
      res_price: "120",
      res_note: "  備註  ",
      res_img_url: "  custom.jpg  "
    });

    expect(restaurant).toMatchObject({
      res_name: "修剪餐廳",
      res_area_num: "02",
      res_tel_num: "1234567",
      res_address: "台北市",
      res_note: "備註",
      res_img_url: "custom.jpg",
      res_price: 120
    });
  });

  it("preserves closed status when editing an existing closed restaurant", async () => {
    const input = restaurantFromAdminForm({
      res_name: "Closed Diner Updated",
      res_area_num: "02",
      res_tel_num: "33334444",
      res_region: "1",
      res_section: "2",
      res_address: "台北市大同區封存路 1 號",
      res_foodtype: "1",
      res_price: "100",
      res_note: "仍然關閉",
      res_img_url: "preview_1380970870.jpg",
      res_close: "1"
    });

    const updated = await updateRestaurant(4, input);

    expect(updated).toMatchObject({
      res_name: "Closed Diner Updated",
      res_close: 1
    });
  });
});
