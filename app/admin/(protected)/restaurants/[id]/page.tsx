import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantForAdmin } from "@/lib/domain/restaurants";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminRestaurantDetailPage({ params }: Props) {
  const { id } = await params;
  const restaurant = await getRestaurantForAdmin(Number.parseInt(id, 10));
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
          <span>{restaurant.priceLabel}</span>
        </p>
        <section className="admin-classification-section" aria-labelledby="admin-cuisine-heading">
          <h2 id="admin-cuisine-heading">料理類型</h2>
          <p>{restaurant.cuisineTypeLabel}</p>
        </section>
        <section className="admin-classification-section" aria-labelledby="admin-auxiliary-heading">
          <h2 id="admin-auxiliary-heading">公開輔助標籤</h2>
          <p>{restaurant.auxiliaryTags.join("、") || "無"}</p>
        </section>
        <section className="admin-classification-section" aria-labelledby="admin-hidden-heading">
          <h2 id="admin-hidden-heading">隱藏的 legacy／source tag</h2>
          {restaurant.hiddenSourceTags.length > 0 ? (
            <ul>{restaurant.hiddenSourceTags.map((tag) => (
              <li key={`${tag.id}-${tag.name}`}>{tag.name}（來源：{tag.sourceName || tag.owner}；原因：{tag.reason}）</li>
            ))}</ul>
          ) : <p>無</p>}
        </section>
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
