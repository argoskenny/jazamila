import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { BlogLink } from "@/lib/domain/types";
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

export async function listBlogLinksForAdmin(status?: number): Promise<BlogLink[]> {
  const blogLinks = await prisma.blogLink.findMany({
    where: status === undefined ? undefined : { status },
    orderBy: { id: "desc" }
  });
  return blogLinks.map(fromPrismaBlogLink);
}

export async function createBlogLinkSubmission(input: unknown): Promise<BlogLink> {
  const data = blogLinkSchema.parse(input);
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
