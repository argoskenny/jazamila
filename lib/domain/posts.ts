import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Post } from "@/lib/domain/types";
import { clampPage } from "@/lib/pagination";
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

export async function listPostsForAdmin({
  status,
  page = 1,
  perPage = 50
}: { status?: number; page?: number; perPage?: number } = {}) {
  const take = Math.min(Math.max(1, perPage), 100);
  const where = status === undefined ? undefined : { status };
  const totalRows = await prisma.post.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / take));
  const currentPage = clampPage(page, totalPages);
  const posts = await prisma.post.findMany({
    where,
    orderBy: { id: "desc" },
    skip: (currentPage - 1) * take,
    take
  });
  const published = posts.length ? await prisma.restaurant.findMany({ where: { postId: { in: posts.map((post) => post.id) } }, select: { id: true, postId: true }, orderBy: { id: "asc" } }) : [];
  return {
    posts: posts.map((post) => ({ ...fromPrismaPost(post), restaurantId: published.find((row) => row.postId === post.id)?.id })),
    totalRows,
    totalPages,
    page: currentPage,
    perPage: take
  };
}

export async function approvePost(id: number): Promise<Post | null> {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({ where: { id } });
    if (!post) return null;

    const publicationKey = `post-submission:${id}`;
    const publishedRestaurants = await tx.restaurant.findMany({
      where: { OR: [{ postId: id }, { importKey: publicationKey }] },
      orderBy: { id: "asc" }
    });
    const publishedRestaurant = publishedRestaurants.find((restaurant) => restaurant.importKey === publicationKey)
      ?? publishedRestaurants[0];
    const city = post.region > 0
      ? await tx.city.findUnique({ where: { legacyRegion: post.region } })
      : null;
    const district = city && post.section > 0
      ? await tx.district.findUnique({
          where: { cityId_legacySection: { cityId: city.id, legacySection: post.section } }
        })
      : null;
    const cuisineType = post.foodType > 0
      ? await tx.cuisineType.findFirst({ where: { legacyFoodType: post.foodType, status: "active" } })
      : null;
    const phone = post.telNum
      ? `${post.areaNum ?? ""} ${post.telNum}`.trim()
      : null;
    const restaurantData = {
      name: post.name,
      areaNum: post.areaNum,
      telNum: post.telNum,
      region: post.region,
      section: post.section,
      address: post.address,
      foodType: cuisineType?.legacyFoodType ?? post.foodType,
      cuisineTypeId: cuisineType?.id ?? null,
      price: post.price,
      openTime: post.openTime,
      closeTime: post.closeTime,
      note: post.note,
      imageUrl: post.imageUrl,
      originalImage: post.originalImage,
      updatedAtUnix: post.updatedAtUnix,
      postId: post.id,
      importKey: publicationKey,
      closed: 0,
      phone,
      cityId: city?.id ?? null,
      districtId: district?.id ?? null
    };

    if (publishedRestaurant) {
      await tx.restaurant.update({ where: { id: publishedRestaurant.id }, data: { closed: 0 } });
      const duplicateIds = publishedRestaurants
        .filter((restaurant) => restaurant.id !== publishedRestaurant.id)
        .map((restaurant) => restaurant.id);
      if (duplicateIds.length > 0) {
        await tx.restaurant.updateMany({
          where: { id: { in: duplicateIds } },
          data: { closed: 1 }
        });
      }
    } else {
      await tx.restaurant.create({ data: restaurantData });
    }

    const approved = await tx.post.update({ where: { id }, data: { status: 1 } });
    return fromPrismaPost(approved);
  });
}

export async function rejectPost(id: number): Promise<Post | null> {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({ where: { id } });
    if (!post) return null;

    await tx.restaurant.updateMany({
      where: {
        OR: [
          { postId: id },
          { importKey: `post-submission:${id}` }
        ]
      },
      data: { closed: 1 }
    });
    const rejected = await tx.post.update({ where: { id }, data: { status: 2 } });
    return fromPrismaPost(rejected);
  });
}
