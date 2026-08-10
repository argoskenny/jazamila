import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/jsonapi/route";
import { prisma } from "@/lib/db/prisma";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("jsonapi", () => {
  it("keeps the configured public app URL for local restaurant images", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.jazamila.test/");

    const response = await GET();
    const data = (await response.json()) as Array<{ res_img_url: string }>;

    expect(data[0].res_img_url).toBe("https://www.jazamila.test/assets/img/jazamila/generated/restaurant-default.jpg");
    expect(data[0].res_img_url).not.toContain("http://jazamila.com");
  });

  it("uses the same encoded image path as public restaurant views", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.jazamila.test/");
    await prisma.restaurant.update({ where: { id: 2 }, data: { imageUrl: "preview burger.jpg" } });
    try {
      const response = await GET();
      const data = (await response.json()) as Array<{ res_name: string; res_img_url: string }>;
      const burger = data.find((restaurant) => restaurant.res_name === "Burger Place");

      expect(burger?.res_img_url).toBe("https://www.jazamila.test/assets/pics/preview%20burger.jpg");
    } finally {
      await prisma.restaurant.update({ where: { id: 2 }, data: { imageUrl: null } });
    }
  });

  it("returns external restaurant image URLs unchanged", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.jazamila.test/");

    const response = await GET();
    const data = (await response.json()) as Array<{ res_name: string; res_img_url: string }>;
    const imported = data.find((restaurant) => restaurant.res_name === "新資料火鍋店");

    expect(imported?.res_img_url).toBe("https://example.com/hot-pot.jpg");
  });

  it("does not expose closed restaurants", async () => {
    const response = await GET();
    const data = (await response.json()) as Array<{ res_name: string }>;

    expect(data.map((restaurant) => restaurant.res_name)).not.toContain("Closed Diner");
  });
});
