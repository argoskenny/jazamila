import { notFound } from "next/navigation";
import { RestaurantForm } from "@/components/admin/RestaurantForm";
import { updateRestaurantAction } from "@/app/admin/restaurants/actions";
import { getActiveCuisineTypeOptions, getRestaurantForAdmin } from "@/lib/domain/restaurants";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditRestaurantPage({ params }: Props) {
  const { id } = await params;
  const restaurant = await getRestaurantForAdmin(Number.parseInt(id, 10));
  if (!restaurant) notFound();
  const cuisineTypes = await getActiveCuisineTypeOptions();

  return (
    <div className="form-grid">
      <h1 className="page-title">編輯餐廳</h1>
      <RestaurantForm action={updateRestaurantAction} restaurant={restaurant} cuisineTypes={cuisineTypes} submitLabel="儲存變更" />
    </div>
  );
}
