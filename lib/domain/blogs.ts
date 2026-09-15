import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { BlogLink } from "@/lib/domain/types";
import { clampPage } from "@/lib/pagination";
import { blogLinkSchema } from "@/lib/validation/forms";

type PrismaBlogLink = Prisma.BlogLinkGetPayload<object>;

function fromPrismaBlogLink(blogLink: PrismaBlogLink): BlogLink {
  return {
    id: Number(blogLink.id),
    b_res_id: Number(blogLink.restaurantId),
    b_post_id: Number(blogLink.postId),
    b_blogname: blogLink.name ?? "",
    b_bloglink: blogLink.url ?? "",
    b_blog_show: blogLink.status
  };
}

export async function listBlogLinksForRestaurant(restaurantId: number): Promise<BlogLink[]> {
  const blogLinks = await prisma.blogLink.findMany({
    where: {
      restaurantId,
      status: 1
    },
    orderBy: { id: "desc" }
  });
  return blogLinks.map(fromPrismaBlogLink);
}

export async function listBlogLinksForAdmin({
  status,
  page = 1,
  perPage = 50
}: { status?: number; page?: number; perPage?: number } = {}) {
  const take = Math.min(Math.max(1, perPage), 100);
  const where = status === undefined ? undefined : { status };
  const totalRows = await prisma.blogLink.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / take));
  const currentPage = clampPage(page, totalPages);
  const blogLinks = await prisma.blogLink.findMany({
    where,
    orderBy: { id: "desc" },
    skip: (currentPage - 1) * take,
    take
  });
  return {
    blogLinks: blogLinks.map(fromPrismaBlogLink),
    totalRows,
    totalPages,
    page: currentPage,
    perPage: take
  };
}

export async function createBlogLinkSubmission(input: unknown): Promise<BlogLink> {
  const data = blogLinkSchema.parse(input);
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      id: data.res_id,
      closed: { not: 1 }
    },
    select: { id: true }
  });

  if (!restaurant) {
    throw new ZodError([
      {
        code: "custom",
        path: ["res_id"],
        message: "餐廳不存在或未開放"
      }
    ]);
  }

  const blogLink = await prisma.blogLink.create({
    data: {
      restaurantId: data.res_id,
      postId: 0,
      name: data.res_blogname,
      url: data.res_bloglink,
      status: 0
    }
  });
  return fromPrismaBlogLink(blogLink);
}

export async function approveBlogLink(id: number): Promise<BlogLink | null> {
  return updateBlogLinkStatus(id, 1);
}

export async function rejectBlogLink(id: number): Promise<BlogLink | null> {
  return updateBlogLinkStatus(id, 2);
}

async function updateBlogLinkStatus(id: number, status: number): Promise<BlogLink | null> {
  try {
    const blogLink = await prisma.blogLink.update({
      where: { id },
      data: { status }
    });
    return fromPrismaBlogLink(blogLink);
  } catch {
    return null;
  }
}
