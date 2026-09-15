import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { approvePost, createRestaurantPost, rejectPost } from "@/lib/domain/posts";

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

  it("rejects a district that does not belong to the selected city", async () => {
    await expect(
      createRestaurantPost({
        post_name: "跨縣市地區測試",
        post_region: 1,
        post_section: 999,
        post_address: "台北市測試路 1 號",
        post_foodtype: 1
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["post_section"], message: "地區與縣市不相符" })
      ])
    });
  });

  it("publishes an approved submission exactly once and reverses moderation safely", async () => {
    const post = await createRestaurantPost({
      post_name: "核准發布測試",
      post_area_num: "02",
      post_tel_num: "87654321",
      post_region: 1,
      post_section: 2,
      post_address: "台北市大同區核准路 1 號",
      post_foodtype: 1,
      post_price: 250,
      post_note: "應發布到餐廳清單"
    });

    try {
      await expect(approvePost(post.id)).resolves.toMatchObject({ post_prove: 1 });
      await expect(approvePost(post.id)).resolves.toMatchObject({ post_prove: 1 });

      const published = await prisma.restaurant.findMany({
        where: { postId: post.id },
        include: { city: true, district: true, cuisineType: true }
      });
      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({
        name: "核准發布測試",
        closed: 0,
        city: { name: "台北市" },
        district: { name: "大同區" },
        cuisineType: { name: "日式料理" }
      });

      await expect(rejectPost(post.id)).resolves.toMatchObject({ post_prove: 2 });
      await expect(prisma.restaurant.findUnique({ where: { id: published[0].id } })).resolves.toMatchObject({
        closed: 1
      });

      await expect(approvePost(post.id)).resolves.toMatchObject({ post_prove: 1 });
      const reopened = await prisma.restaurant.findMany({ where: { postId: post.id } });
      expect(reopened).toHaveLength(1);
      expect(reopened[0]).toMatchObject({ id: published[0].id, closed: 0 });
    } finally {
      await prisma.restaurant.deleteMany({ where: { postId: post.id } });
      await prisma.post.delete({ where: { id: post.id } });
    }
  });
});
