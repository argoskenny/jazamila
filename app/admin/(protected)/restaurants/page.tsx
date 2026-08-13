import Link from "next/link";
import { listRestaurantsForAdmin } from "@/lib/domain/admin";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminRestaurantsPage({ searchParams }: Props) {
  const query = await searchParams;
  const requestedPage = Number.parseInt(first(query.page) ?? first(query.set) ?? "1", 10);
  const result = await listRestaurantsForAdmin({
    page: Number.isFinite(requestedPage) ? requestedPage : 1
  });

  return (
    <div className="form-grid">
      <div className="list-header">
        <div>
          <h1 className="page-title">餐廳管理</h1>
          <p className="lead">管理公開餐廳資料，共 {result.totalRows} 筆。</p>
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
              <th>料理類型</th>
              <th>輔助標籤</th>
              <th>價位</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {result.restaurants.map((restaurant) => (
              <tr key={restaurant.id}>
                <td>{restaurant.id}</td>
                <td>{restaurant.res_name}</td>
                <td>{restaurant.regionLabel}{restaurant.sectionLabel}</td>
                <td>{restaurant.cuisineTypeLabel}</td>
                <td>{restaurant.auxiliaryTags.slice(0, 3).join("、") || "無"}{restaurant.auxiliaryTags.length > 3 ? ` +${restaurant.auxiliaryTags.length - 3}` : ""}</td>
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
      <nav className="pagination" aria-label="後台餐廳分頁">
        {result.page > 1 ? (
          <Link href={`/admin/restaurants?page=${result.page - 1}`}>上一頁</Link>
        ) : (
          <span>上一頁</span>
        )}
        <span className="active">
          {result.page} / {result.totalPages}
        </span>
        {result.page < result.totalPages ? (
          <Link href={`/admin/restaurants?page=${result.page + 1}`}>下一頁</Link>
        ) : (
          <span>下一頁</span>
        )}
      </nav>
    </div>
  );
}
