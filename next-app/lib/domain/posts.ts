import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Post } from "@/lib/domain/types";
import { restaurantPostSchema } from "@/lib/validation/forms";

type PrismaPost = Prisma.PostGetPayload<object>;

function fromPrismaPost(post: PrismaPost): Post {
  return {
    id: Number(post.id),
    post_name: post.name,
    post_area_num: post.areaNum ?? "",
    post_tel_num: post.telNum ?? "",
    post_region: post.region,
    post_section: post.section,
    post_address: post.address ?? "",
    post_foodtype: post.foodType,
    post_price: post.price,
    post_open_time: Number(post.openTime),
    post_close_time: Number(post.closeTime),
    post_note: post.note ?? "",
    post_updatetime: Number(post.updatedAtUnix),
    post_img_url: post.imageUrl ?? "preview_1380970870.jpg",
    post_img_ori_url: post.originalImage ?? "",
    post_prove: post.status
  };
}

export async function createRestaurantPost(input: unknown): Promise<Post> {
  const data = restaurantPostSchema.parse(input);
  const post = await prisma.post.create({
    data: {
      name: data.post_name,
      areaNum: data.post_area_num,
      telNum: data.post_tel_num,
      region: data.post_region,
      section: data.post_section,
      address: data.post_address,
      foodType: data.post_foodtype,
      price: data.post_price,
      openTime: 0,
      closeTime: 0,
      note: data.post_note,
      updatedAtUnix: Math.floor(Date.now() / 1000),
      imageUrl: "preview_1380970870.jpg",
      originalImage: "",
      status: 0
    }
  });
  return fromPrismaPost(post);
}

export async function listPostsForAdmin(status?: number): Promise<Post[]> {
  const posts = await prisma.post.findMany({
    where: status === undefined ? undefined : { status },
    orderBy: { id: "desc" }
  });
  return posts.map(fromPrismaPost);
}

export async function approvePost(id: number): Promise<Post | null> {
  return updatePostStatus(id, 1);
}

export async function rejectPost(id: number): Promise<Post | null> {
  return updatePostStatus(id, 2);
}

async function updatePostStatus(id: number, status: number): Promise<Post | null> {
  try {
    const post = await prisma.post.update({
      where: { id },
      data: { status }
    });
    return fromPrismaPost(post);
  } catch {
    return null;
  }
}
