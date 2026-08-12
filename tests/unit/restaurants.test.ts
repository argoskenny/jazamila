import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  describeFilters,
  buildListPath,
  getActiveCuisineTypeOptions,
  getRestaurantForAdmin,
  getRestaurantDetail,
  listPublicRestaurants,
  listRestaurants,
  parseListFilters,
  pickRestaurant,
  restaurantFromAdminForm,
  summarizeRestaurantTags,
  updateRestaurant,
  toRestaurantView,
  toRestaurantViewFromPrisma
} from "@/lib/domain/restaurants";

describe("restaurant domain", () => {
  it("counts only hidden feature tags in the list summary", () => {
    expect(summarizeRestaurantTags(["火鍋", "吃到飽", "聚餐", "麻辣", "宵夜"], "火鍋")).toEqual({
      visibleTags: ["吃到飽", "聚餐", "麻辣"],
      hiddenCount: 1
    });
    expect(summarizeRestaurantTags(["吃到飽", "聚餐", "麻辣", "宵夜", "外帶"], "火鍋").hiddenCount).toBe(2);
  });
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

  it("accepts canonical CuisineType URL tokens without changing legacy URL parsing", () => {
    const filters = parseListFilters(["0", "c:hot-pot", "0", "0", "1"], {});
    expect(filters).toMatchObject({ foodType: 0, cuisineTypeCode: "hot-pot" });
    expect(buildListPath(filters, 2)).toBe("/listdata/0/c:hot-pot/0/0/2");
    expect(parseListFilters(["0", "2", "0", "0", "1"], {}).foodType).toBe(2);
  });

  it("loads only active CuisineTypes for public controls and uses the relation as the primary label", async () => {
    const options = await getActiveCuisineTypeOptions();
    expect(options.every((option) => option.status === "active")).toBe(true);
    await expect(getRestaurantDetail(1)).resolves.toMatchObject({
      cuisineTypeId: expect.any(Number),
      cuisineTypeLabel: "日式料理",
      foodTypeLabel: "日式料理"
    });
  });

  it("does not expose an active cuisine name twice as a public auxiliary tag", () => {
    const view = toRestaurantViewFromPrisma({
      id: 99,
      name: "重複料理測試",
      areaNum: "02",
      telNum: "12345678",
      region: 1,
      section: 2,
      address: "臺北市測試路 99 號",
      foodType: 0,
      cuisineTypeId: 12,
      price: 200,
      openTime: 0,
      closeTime: 0,
      note: null,
      imageUrl: null,
      originalImage: null,
      updatedAtUnix: 0,
      postId: 0,
      closed: 0,
      cuisineType: { id: 12, code: "hot-pot", name: "火鍋", normalizedName: "火鍋", status: "active" },
      tags: [
        { position: 0, owner: "source", isPublic: true, tag: { name: "火鍋", normalizedName: "火鍋" } },
        { position: 1, owner: "source", isPublic: true, tag: { name: "海鮮", normalizedName: "海鮮" } },
      ],
    } as unknown as Parameters<typeof toRestaurantViewFromPrisma>[0]);

    expect(view.cuisineTypeLabel).toBe("火鍋");
    expect(view.tags).toEqual(["海鮮"]);
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

  it("excludes recently picked restaurants from the candidate pool", async () => {
    const restaurant = await pickRestaurant({
      regionId: 1,
      sectionId: 3,
      maxPrice: 0,
      minPrice: 0,
      foodType: 2,
      excludeIds: [2]
    });

    expect(restaurant).toBeNull();
  });

  it("does not include imported hot pot restaurants in the small-eats filter", async () => {
    const filters = parseListFilters(["1X2", "4", "0", "0", "1"], {});
    const result = await listRestaurants(filters);

    expect(result.restaurants.map((restaurant) => restaurant.res_name)).not.toContain("新資料火鍋店");
  });

  it("does not pick an imported hot pot restaurant for the small-eats preference", async () => {
    const restaurant = await pickRestaurant({
      regionId: 1,
      sectionId: 2,
      maxPrice: 0,
      minPrice: 0,
      foodType: 4,
    });

    expect(restaurant).toBeNull();
  });

  it("matches an imported price range by overlap instead of its legacy midpoint", async () => {
    const filters = parseListFilters(["1X2", "0", "500", "400", "1"], {});
    const result = await listRestaurants(filters);

    expect(result.restaurants.map((restaurant) => restaurant.res_name)).toContain("新資料火鍋店");
  });

  it("maps imported restaurant detail fields for public presentation", async () => {
    const restaurant = await getRestaurantDetail(5);

    expect(restaurant).toMatchObject({
      foodTypeLabel: "未分類",
      priceLabel: "每人 400–1,500 元",
      imagePath: "https://example.com/hot-pot.jpg",
      fallbackImagePath: "/assets/img/jazamila/generated/restaurant-default.jpg",
      cityLabel: "台北市",
      districtLabel: "大同區",
      tags: ["火鍋"],
      ratingScore: 4.6,
      ratingReviewCount: 321,
      businessHoursLabel: "平均 11:00–22:00",
      phoneHref: "tel:0255551234"
    });
    expect(restaurant?.reviewSummaries).toEqual(["湯頭選擇多", "服務親切"]);
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

  it("uses the generated default restaurant image when no image is available", () => {
    const restaurant = toRestaurantView({
      id: 100,
      res_name: "無圖餐廳",
      res_area_num: "02",
      res_tel_num: "12345678",
      res_region: 1,
      res_section: 2,
      res_address: "台北市",
      res_foodtype: 0,
      res_price: 100,
      res_open_time: 0,
      res_close_time: 0,
      res_note: "",
      res_img_url: "",
      res_img_ori_url: "",
      res_updatetime: 0,
      res_post_id: 0,
      res_close: 0
    });

    expect(restaurant.imagePath).toBe("/assets/img/jazamila/generated/restaurant-default.jpg");
    expect(restaurant.fallbackImagePath).toBe("/assets/img/jazamila/generated/restaurant-default.jpg");
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
      cuisine_type_id: "1",
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
      res_price: 120,
      cuisine_type_id: 1
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

  it("records field-level protection when an imported restaurant is edited manually", async () => {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: "人工狀態測試",
        importKey: `res-data:v2:${"b".repeat(64)}`,
        closed: 0
      }
    });

    try {
      await updateRestaurant(restaurant.id, { res_close: 1 });
      const saved = await prisma.restaurant.findUnique({ where: { id: restaurant.id } });

      expect(saved?.closed).toBe(1);
      expect(JSON.parse(saved?.manualOverrideFields ?? "[]")).toEqual(["closed"]);
    } finally {
      await prisma.restaurant.delete({ where: { id: restaurant.id } });
    }
  });
});
