import { RestaurantForm } from "@/components/admin/RestaurantForm";
import { createRestaurantAction } from "@/app/admin/restaurants/actions";
import { getActiveCuisineTypeOptions, getAuxiliaryTagOptions } from "@/lib/domain/restaurants";

export default async function NewRestaurantPage() {
  const [cuisineTypes, auxiliaryTags] = await Promise.all([getActiveCuisineTypeOptions(), getAuxiliaryTagOptions()]);
  return (
    <div className="form-grid">
      <h1 className="page-title">新增餐廳</h1>
      <RestaurantForm action={createRestaurantAction} cuisineTypes={cuisineTypes} auxiliaryTags={auxiliaryTags} submitLabel="建立餐廳" />
    </div>
  );
}
