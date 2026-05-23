"use server";

import { revalidatePath } from "next/cache";
import { approvePost, rejectPost } from "@/lib/domain/posts";
import { requireAdmin } from "@/lib/auth/admin";

export async function approvePostAction(formData: FormData) {
  await requireAdmin();
  await approvePost(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  revalidatePath("/admin/posts");
}

export async function rejectPostAction(formData: FormData) {
  await requireAdmin();
  await rejectPost(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  revalidatePath("/admin/posts");
}
