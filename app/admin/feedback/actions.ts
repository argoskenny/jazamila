"use server";

import { revalidatePath } from "next/cache";
import { markFeedbackRead } from "@/lib/domain/feedback";
import { requireAdmin } from "@/lib/auth/admin";

export async function markFeedbackReadAction(formData: FormData) {
  await requireAdmin();
  await markFeedbackRead(Number.parseInt(String(formData.get("id") ?? "0"), 10));
  revalidatePath("/admin/feedback");
}
