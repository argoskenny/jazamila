"use server";

import { revalidatePath } from "next/cache";
import { approveBlogLink, rejectBlogLink } from "@/lib/domain/blogs";
import { requireAdmin } from "@/lib/auth/admin";

export async function approveBlogAction(formData: FormData) {
  await requireAdmin();
  await approveBlogLink(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  revalidatePath("/admin/blogs");
}

export async function rejectBlogAction(formData: FormData) {
  await requireAdmin();
  await rejectBlogLink(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  revalidatePath("/admin/blogs");
}
