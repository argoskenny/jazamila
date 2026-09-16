"use server";

import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createRestaurantWithAuxiliaryTags,
  restaurantFromAdminForm,
  updateRestaurantWithAuxiliaryTags
} from "@/lib/domain/restaurants";
import { requireAdmin } from "@/lib/auth/admin";

function formError(error: unknown) {
  return error instanceof ZodError
    ? { errors: error.flatten().fieldErrors as Record<string, string[]>, message: "請修正以下欄位，資料尚未儲存。" }
    : { errors: {} as Record<string, string[]>, message: error instanceof Error ? error.message : "儲存失敗，請稍後再試。" };
}
function invalidateRestaurant(id: number) {
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  revalidatePath(`/detail/${id}`);
  revalidatePath("/listdata", "page");
  revalidatePath("/jsonapi");
  revalidatePath("/sitemap.xml");
}
export async function createRestaurantAction(formData: FormData) {
  await requireAdmin();
  let id: number;
  try {
    const restaurant = await createRestaurantWithAuxiliaryTags(
      restaurantFromAdminForm(Object.fromEntries(formData.entries())),
      formData.getAll("auxiliary_tag_ids").map(Number),
      String(formData.get("new_auxiliary_tags") ?? "").split(/[，,\n]/u)
    );
    id = restaurant.id;
  } catch (error) { return formError(error); }
  invalidateRestaurant(id);
  redirect(`/admin/restaurants/${id}`);
}
export async function updateRestaurantAction(formData: FormData) {
  await requireAdmin();
  const id = Number.parseInt(String(formData.get("id") ?? "0"), 10);
  try {
    const restaurant = await updateRestaurantWithAuxiliaryTags(id,
      restaurantFromAdminForm(Object.fromEntries(formData.entries())),
      formData.getAll("auxiliary_tag_ids").map(Number),
      String(formData.get("new_auxiliary_tags") ?? "").split(/[，,\n]/u)
    );
    if (!restaurant) throw new Error("餐廳不存在或儲存失敗，請確認分類與標籤後重試。");
  } catch (error) { return formError(error); }
  invalidateRestaurant(id);
  redirect(`/admin/restaurants/${id}`);
}
