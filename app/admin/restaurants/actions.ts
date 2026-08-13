"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRestaurant, restaurantFromAdminForm, updateRestaurant, updateRestaurantAuxiliaryTags } from "@/lib/domain/restaurants";
import { requireAdmin } from "@/lib/auth/admin";

export async function createRestaurantAction(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const restaurant = await createRestaurant(restaurantFromAdminForm(raw));
  const selectedTagIds = formData.getAll("auxiliary_tag_ids").map(Number);
  const newTags = String(formData.get("new_auxiliary_tags") ?? "").split(/[，,\n]/u);
  await updateRestaurantAuxiliaryTags(restaurant.id, selectedTagIds, newTags);
  revalidatePath("/admin/restaurants");
  redirect(`/admin/restaurants/${restaurant.id}`);
}

export async function updateRestaurantAction(formData: FormData) {
  await requireAdmin();
  const id = Number.parseInt(String(formData.get("id") ?? "0"), 10);
  const raw = Object.fromEntries(formData.entries());
  await updateRestaurant(id, restaurantFromAdminForm(raw));
  const selectedTagIds = formData.getAll("auxiliary_tag_ids").map(Number);
  const newTags = String(formData.get("new_auxiliary_tags") ?? "").split(/[，,\n]/u);
  await updateRestaurantAuxiliaryTags(id, selectedTagIds, newTags);
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  redirect(`/admin/restaurants/${id}`);
}
