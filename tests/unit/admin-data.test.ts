import { describe, expect, it } from "vitest";
import { countAdminDashboardStats, listRestaurantsForAdmin } from "@/lib/domain/admin";

describe("admin data queries", () => {
  it("returns paginated restaurant rows and total count", async () => {
    const result = await listRestaurantsForAdmin({ page: 1, perPage: 2 });

    expect(result.restaurants).toHaveLength(2);
    expect(result.totalRows).toBeGreaterThan(result.restaurants.length);
    expect(result.totalPages).toBeGreaterThan(1);
  });

  it("counts dashboard stats without loading full row sets", async () => {
    const stats = await countAdminDashboardStats();

    expect(stats).toMatchObject({
      restaurants: 5,
      posts: 1,
      blogs: 2,
      feedback: 1
    });
  });
});
