"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { restaurantAdminSchema } from "@/lib/validation/forms";
import { createRestaurant, restaurantFromForm, updateRestaurant } from "@/lib/domain/restaurants";
import { requireAdmin } from "@/lib/auth/admin";

export async function createRestaurantAction(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  restaurantAdminSchema.parse(raw);
  const restaurant = await createRestaurant(restaurantFromForm(raw));
  revalidatePath("/admin/restaurants");
  redirect(`/admin/restaurants/${restaurant.id}`);
}

export async function updateRestaurantAction(formData: FormData) {
  await requireAdmin();
  const id = Number.parseInt(String(formData.get("id") ?? "0"), 10);
  const raw = Object.fromEntries(formData.entries());
  restaurantAdminSchema.parse(raw);
  await updateRestaurant(id, restaurantFromForm(raw));
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  redirect(`/admin/restaurants/${id}`);
}
