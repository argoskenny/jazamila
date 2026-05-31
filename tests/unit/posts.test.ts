import { describe, expect, it } from "vitest";
import { createRestaurantPost } from "@/lib/domain/posts";

describe("restaurant post domain", () => {
  it("rejects submissions missing required location and category data", async () => {
    await expect(
      createRestaurantPost({
        post_name: "測試餐廳",
        post_region: 0,
        post_section: 0,
        post_address: "",
        post_foodtype: 0
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["post_region"] }),
        expect.objectContaining({ path: ["post_section"] }),
        expect.objectContaining({ path: ["post_address"] }),
        expect.objectContaining({ path: ["post_foodtype"] })
      ])
    });
  });
});
