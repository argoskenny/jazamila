"use server";

import { revalidatePath } from "next/cache";
import { approvePost, rejectPost } from "@/lib/domain/posts";
import { requireAdmin } from "@/lib/auth/admin";

export async function approvePostAction(formData: FormData) {
  await requireAdmin();
  const post = await approvePost(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  if (!post) throw new Error("投稿不存在或發布失敗");
  revalidatePath("/admin/posts");
  revalidatePath("/admin/restaurants");
  revalidatePath("/listdata");
  revalidatePath("/jsonapi");
  revalidatePath("/sitemap.xml");
}

export async function rejectPostAction(formData: FormData) {
  await requireAdmin();
  const post = await rejectPost(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  if (!post) throw new Error("投稿不存在或拒絕失敗");
  revalidatePath("/admin/posts");
  revalidatePath("/admin/restaurants");
  revalidatePath("/listdata");
  revalidatePath("/jsonapi");
  revalidatePath("/sitemap.xml");
}
