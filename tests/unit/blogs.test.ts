import { describe, expect, it } from "vitest";
import { createBlogLinkSubmission } from "@/lib/domain/blogs";

describe("blog link domain", () => {
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
