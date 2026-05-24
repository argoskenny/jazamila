import Link from "next/link";
import { createPagination } from "@/lib/pagination";
import { buildListPath, describeFilters, listRestaurants, parseListFilters } from "@/lib/domain/restaurants";

type Props = {
  params: Promise<{ filters?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListDataPage({ params, searchParams }: Props) {
  const { filters: segments } = await params;
  const query = await searchParams;
  const filters = parseListFilters(segments, query);
  const result = await listRestaurants(filters);
  const pagination = createPagination(result.page, result.totalPages);

  return (
    <section className="page-shell">
      <div className="list-header">
        <div>
          <h1 className="page-title">餐廳列表</h1>
          <p className="lead">{describeFilters(filters)}</p>
        </div>
        <form className="actions" action="/listdata/0/0/0/0/1">
          <input className="input" name="search_keyword" defaultValue={filters.keyword} placeholder="請輸入關鍵字" />
          <button className="button secondary" type="submit">
            搜尋
          </button>
        </form>
      </div>

      <div className="restaurant-list">
        {result.restaurants.map((restaurant) => (
          <article className="restaurant-card" key={restaurant.id}>
            <img src={restaurant.imagePath} alt="" />
            <div>
              <h2>
                <Link href={`/detail/${restaurant.id}?ul=${filters.location}&ut=${filters.foodType}&umx=${filters.maxPrice}&umi=${filters.minPrice}&p=${result.page}`}>
                  {restaurant.res_name}
                </Link>
              </h2>
              <p className="meta">
                <span className="tag">{restaurant.regionLabel}{restaurant.sectionLabel}</span>
                <span>{restaurant.foodTypeLabel}</span>
                <span>{restaurant.priceLabel}</span>
              </p>
              <p>{restaurant.res_note}</p>
              <Link
                className="text-link"
                href={`/detail/${restaurant.id}?ul=${filters.location}&ut=${filters.foodType}&umx=${filters.maxPrice}&umi=${filters.minPrice}&p=${result.page}`}
              >
                查看詳細資料
              </Link>
            </div>
          </article>
        ))}
      </div>

      {result.restaurants.length === 0 ? (
        <p className="panel">
          暫時沒有符合的搜尋結果。<br />
          建議您輸入其他的關鍵字，或重新選擇縮小列表範圍的條件。
        </p>
      ) : null}

      <nav className="pagination" aria-label="分頁">
        {pagination.map((item, index) =>
          item.type === "page" ? (
            item.active ? (
              <span className="active" key={item.page}>
                {item.page}
              </span>
            ) : (
              <Link key={item.page} href={buildListPath(filters, item.page)}>
                {item.page}
              </Link>
            )
          ) : item.disabled ? (
            <span key={`${item.label}-${index}`}>{item.label}</span>
          ) : (
            <Link key={`${item.label}-${index}`} href={buildListPath(filters, item.page)}>
              {item.label}
            </Link>
          )
        )}
      </nav>
    </section>
  );
}
