import Link from "next/link";
import { listAllRestaurants } from "@/lib/domain/restaurants";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const restaurants = await listAllRestaurants();

  return (
    <section className="page-shell">
      <div className="list-header">
        <div>
          <h1 className="page-title">美食地圖</h1>
        </div>
      </div>
      <div className="restaurant-list">
        {restaurants.map((restaurant) => (
          <article className="restaurant-card" key={restaurant.id}>
            <img src={restaurant.imagePath} alt="" />
            <div>
              <h2>{restaurant.res_name}</h2>
              <p>{restaurant.res_address}</p>
              <p className="meta">
                <span className="tag">{restaurant.regionLabel}{restaurant.sectionLabel}</span>
                <span>{restaurant.foodTypeLabel}</span>
              </p>
              <Link className="text-link" href={`/detail/${restaurant.id}`}>
                查看餐廳
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
