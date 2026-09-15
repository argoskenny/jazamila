"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createRestaurantWithAuxiliaryTags,
  restaurantFromAdminForm,
  updateRestaurantWithAuxiliaryTags
} from "@/lib/domain/restaurants";
import { requireAdmin } from "@/lib/auth/admin";

export async function createRestaurantAction(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const selectedTagIds = formData.getAll("auxiliary_tag_ids").map(Number);
  const newTags = String(formData.get("new_auxiliary_tags") ?? "").split(/[，,\n]/u);
  const restaurant = await createRestaurantWithAuxiliaryTags(
    restaurantFromAdminForm(raw),
    selectedTagIds,
    newTags
  );
  revalidatePath("/admin/restaurants");
  redirect(`/admin/restaurants/${restaurant.id}`);
}

export async function updateRestaurantAction(formData: FormData) {
  await requireAdmin();
  const id = Number.parseInt(String(formData.get("id") ?? "0"), 10);
  const raw = Object.fromEntries(formData.entries());
  const selectedTagIds = formData.getAll("auxiliary_tag_ids").map(Number);
  const newTags = String(formData.get("new_auxiliary_tags") ?? "").split(/[，,\n]/u);
  const restaurant = await updateRestaurantWithAuxiliaryTags(
    id,
    restaurantFromAdminForm(raw),
    selectedTagIds,
    newTags
  );
  if (!restaurant) throw new Error("餐廳不存在或儲存失敗");
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  redirect(`/admin/restaurants/${id}`);
}
