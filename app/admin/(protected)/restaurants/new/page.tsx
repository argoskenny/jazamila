import { RestaurantForm } from "@/components/admin/RestaurantForm";
import { createRestaurantAction } from "@/app/admin/restaurants/actions";
import { requireAdmin } from "@/lib/auth/admin";

export default async function NewRestaurantPage() {
  await requireAdmin();
  return (
    <div className="form-grid">
      <h1 className="page-title">新增餐廳</h1>
      <RestaurantForm action={createRestaurantAction} submitLabel="建立餐廳" />
    </div>
  );
}
