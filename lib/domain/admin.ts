import { prisma } from "@/lib/db/prisma";
import { clampPage } from "@/lib/pagination";
import { toRestaurantViewFromPrisma } from "@/lib/domain/restaurants";

const defaultPerPage = 20;
const maxPerPage = 100;

export async function listRestaurantsForAdmin({ page = 1, perPage = defaultPerPage } = {}) {
  const take = Math.min(Math.max(1, perPage), maxPerPage);
  const totalRows = await prisma.restaurant.count();
  const totalPages = Math.max(1, Math.ceil(totalRows / take));
  const currentPage = clampPage(page, totalPages);
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { id: "asc" },
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
