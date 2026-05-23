import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listAllRestaurants } from "@/lib/domain/restaurants";

export default async function AdminRestaurantsPage() {
  await requireAdmin();
  const restaurants = await listAllRestaurants();

  return (
    <div className="form-grid">
      <div className="list-header">
        <div>
          <h1 className="page-title">餐廳管理</h1>
          <p className="lead">管理公開餐廳資料。</p>
        </div>
        <Link className="button" href="/admin/restaurants/new">
          新增餐廳
        </Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名稱</th>
              <th>地區</th>
              <th>類型</th>
              <th>價位</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((restaurant) => (
              <tr key={restaurant.id}>
                <td>{restaurant.id}</td>
                <td>{restaurant.res_name}</td>
                <td>{restaurant.regionLabel}{restaurant.sectionLabel}</td>
                <td>{restaurant.foodTypeLabel}</td>
                <td>{restaurant.priceLabel}</td>
                <td>
                  <Link className="text-link" href={`/admin/restaurants/${restaurant.id}`}>
                    查看
                  </Link>
                  <Link className="text-link" href={`/admin/restaurants/${restaurant.id}/edit`}>
                    編輯
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
