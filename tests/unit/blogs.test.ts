import { describe, expect, it } from "vitest";
import { createBlogLinkSubmission, listBlogLinksForRestaurant } from "@/lib/domain/blogs";

describe("blog link domain", () => {
  it("lists approved links for a public restaurant", async () => {
    await expect(listBlogLinksForRestaurant(1)).resolves.toEqual([
      expect.objectContaining({ b_blogname: "Sushi Blog", b_blog_show: 1 })
    ]);
  });

  it("rejects submissions for missing restaurants", async () => {
    await expect(
      createBlogLinkSubmission({
        res_id: 999,
        res_blogname: "不存在的餐廳",
        res_bloglink: "https://example.com/missing"
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ path: ["res_id"] })])
    });
  });

  it("rejects submissions for closed restaurants", async () => {
    await expect(
      createBlogLinkSubmission({
        res_id: 4,
        res_blogname: "已關閉餐廳",
        res_bloglink: "https://example.com/closed"
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ path: ["res_id"] })])
    });
  });
});
