import type { MetadataRoute } from "next";
import { listPublicRestaurantIds } from "@/lib/domain/restaurants";
import { absoluteSiteUrl } from "@/lib/site";

export const revalidate = 86_400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const restaurantIds = await listPublicRestaurantIds();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteSiteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteSiteUrl("/listdata/0/0/0/0/1"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteSiteUrl("/post"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteSiteUrl("/about"), changeFrequency: "yearly", priority: 0.3 }
  ];

  return [
    ...staticRoutes,
    ...restaurantIds.map((restaurantId) => ({
      url: absoluteSiteUrl(`/detail/${restaurantId}`),
      changeFrequency: "weekly" as const,
      priority: 0.7
    }))
  ];
}
