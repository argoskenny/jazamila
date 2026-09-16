import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { clampPage } from "@/lib/pagination";
import { toRestaurantViewFromPrisma } from "@/lib/domain/restaurants";

const defaultPerPage = 20;
const maxPerPage = 100;

export async function listRestaurantsForAdmin({ page = 1, perPage = defaultPerPage, keyword = "", region = 0, closed }: { page?: number; perPage?: number; keyword?: string; region?: number; closed?: number } = {}) {
  const take = Math.min(Math.max(1, perPage), maxPerPage);
  const where: Prisma.RestaurantWhereInput = {
    ...(region > 0 ? { region } : {}),
    ...(closed === 0 || closed === 1 ? { closed } : {}),
    ...(keyword.trim() ? { OR: [{ name: { contains: keyword.trim() } }, { address: { contains: keyword.trim() } }, { phone: { contains: keyword.trim() } }, { telNum: { contains: keyword.trim() } }, ...(Number.isSafeInteger(Number(keyword)) ? [{ id: Number(keyword) }] : [])] } : {})
  };
  const totalRows = await prisma.restaurant.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / take));
  const currentPage = clampPage(page, totalPages);
  const restaurants = await prisma.restaurant.findMany({
    where,
    orderBy: { id: "asc" },
    include: {
      city: { select: { name: true } },
      district: { select: { name: true } },
      cuisineType: { select: { id: true, code: true, name: true, normalizedName: true, status: true } },
      tags: {
        orderBy: { position: "asc" },
        include: { tag: { select: { name: true, normalizedName: true } } }
      }
    },
    skip: (currentPage - 1) * take,
    take
  });

  return {
    restaurants: restaurants.map(toRestaurantViewFromPrisma),
    totalRows,
    totalPages,
    page: currentPage,
    perPage: take
  };
}

export async function countAdminDashboardStats() {
  const [restaurants, posts, blogs, feedback] = await Promise.all([
    prisma.restaurant.count(),
    prisma.post.count(),
    prisma.blogLink.count(),
    prisma.feedback.count()
  ]);

  return {
    restaurants,
    posts,
    blogs,
    feedback
  };
}
