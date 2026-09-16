import { regions } from "@/lib/domain/sections";
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
  const keyword = first(query.keyword) ?? "";
  const region = Number(first(query.region) ?? 0);
  const closed = first(query.closed) === "0" ? 0 : first(query.closed) === "1" ? 1 : undefined;
  const result = await listRestaurantsForAdmin({
    keyword, region, closed,
    page: Number.isFinite(requestedPage) ? requestedPage : 1
  });

  const pageHref = (page: number) => `/admin/restaurants?${new URLSearchParams({ keyword, region: String(region), closed: closed === undefined ? "" : String(closed), page: String(page) })}`;

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
      <form className="panel form-grid" action="/admin/restaurants">
        <label className="field"><span>名稱、電話、地址或 ID</span><input className="input" name="keyword" defaultValue={keyword} /></label>
        <div className="form-row"><label className="field"><span>城市</span><select className="select" name="region" defaultValue={region}>{regions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="field"><span>狀態</span><select className="select" name="closed" defaultValue={closed ?? ""}><option value="">全部</option><option value="0">公開</option><option value="1">關閉</option></select></label></div>
        <button className="button" type="submit">搜尋餐廳</button><Link href="/admin/restaurants">清除篩選</Link>
      </form>
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
              <th>狀態</th><th>操作</th>
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
                <td>{restaurant.priceLabel}</td><td>{restaurant.res_close === 1 ? "關閉" : "公開"}</td>
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
          <Link href={pageHref(result.page - 1)}>上一頁</Link>
        ) : (
          <span>上一頁</span>
        )}
        <span className="active">
          {result.page} / {result.totalPages}
        </span>
        {result.page < result.totalPages ? (
          <Link href={pageHref(result.page + 1)}>下一頁</Link>
        ) : (
          <span>下一頁</span>
        )}
      </nav>
    </div>
  );
}
