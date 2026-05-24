import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getRestaurantDetail } from "@/lib/domain/restaurants";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminRestaurantDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const restaurant = await getRestaurantDetail(Number.parseInt(id, 10));
  if (!restaurant) notFound();

  return (
    <div className="detail-grid">
      <div className="detail-media">
        <img src={restaurant.imagePath} alt={restaurant.res_name} />
      </div>
      <div className="panel">
        <h1 className="page-title">{restaurant.res_name}</h1>
        <p className="meta">
          <span className="tag">{restaurant.regionLabel}{restaurant.sectionLabel}</span>
          <span>{restaurant.foodTypeLabel}</span>
          <span>{restaurant.priceLabel}</span>
        </p>
        <p>{restaurant.res_note}</p>
        <p>{restaurant.res_address}</p>
        <div className="actions">
          <Link className="button" href={`/admin/restaurants/${restaurant.id}/edit`}>
            編輯
          </Link>
          <Link className="button ghost" href="/admin/restaurants">
            回列表
          </Link>
        </div>
      </div>
    </div>
  );
}
