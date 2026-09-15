"use server";

import { revalidatePath } from "next/cache";
import { approveBlogLink, rejectBlogLink } from "@/lib/domain/blogs";
import { requireAdmin } from "@/lib/auth/admin";

export async function approveBlogAction(formData: FormData) {
  await requireAdmin();
  const blogLink = await approveBlogLink(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  if (!blogLink) throw new Error("食記不存在或核准失敗");
  revalidatePath("/admin/blogs");
  revalidatePath(`/detail/${blogLink.b_res_id}`);
}

export async function rejectBlogAction(formData: FormData) {
  await requireAdmin();
  const blogLink = await rejectBlogLink(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  if (!blogLink) throw new Error("食記不存在或拒絕失敗");
  revalidatePath("/admin/blogs");
  revalidatePath(`/detail/${blogLink.b_res_id}`);
}
