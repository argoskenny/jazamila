"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRestaurant, restaurantFromAdminForm, updateRestaurant } from "@/lib/domain/restaurants";
import { requireAdmin } from "@/lib/auth/admin";

export async function createRestaurantAction(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const restaurant = await createRestaurant(restaurantFromAdminForm(raw));
  revalidatePath("/admin/restaurants");
  redirect(`/admin/restaurants/${restaurant.id}`);
}

export async function updateRestaurantAction(formData: FormData) {
  await requireAdmin();
  const id = Number.parseInt(String(formData.get("id") ?? "0"), 10);
  const raw = Object.fromEntries(formData.entries());
  await updateRestaurant(id, restaurantFromAdminForm(raw));
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  redirect(`/admin/restaurants/${id}`);
}
