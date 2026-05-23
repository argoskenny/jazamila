import { describe, expect, it } from "vitest";
import { describeFilters, listRestaurants, parseListFilters, pickRestaurant } from "@/lib/domain/restaurants";

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
});
