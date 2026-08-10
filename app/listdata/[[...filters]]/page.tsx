import Link from "next/link";
import { RestaurantListFilter } from "@/components/forms/RestaurantListFilter";
import { createPagination } from "@/lib/pagination";
import { buildListPath, listRestaurants, parseListFilters } from "@/lib/domain/restaurants";
import { foodTypes, getRegions, moneyOptions, sectionsByRegion } from "@/lib/domain/sections";

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
          <RestaurantListFilter
            filters={filters}
            regions={getRegions()}
            sectionsByRegion={sectionsByRegion}
            foodTypes={foodTypes}
            moneyOptions={moneyOptions}
          />
        </div>
      </div>

      <div className="restaurant-list">
        {result.restaurants.map((restaurant) => {
          const detailHref = `/detail/${restaurant.id}?ul=${filters.location}&ut=${filters.foodType}&umx=${filters.maxPrice}&umi=${filters.minPrice}&p=${result.page}`;
          const titleId = `restaurant-${restaurant.id}-title`;

          return (
            <article key={restaurant.id}>
              <Link className="restaurant-card" href={detailHref} aria-labelledby={titleId}>
                <img src={restaurant.imagePath} alt="" />
                <div>
                  <h2 id={titleId}>{restaurant.res_name}</h2>
                  <p className="restaurant-address">{restaurant.res_address || "地址未提供"}</p>
                  <p className="restaurant-tags">
                    <span className="restaurant-tag restaurant-tag-cuisine">{restaurant.foodTypeLabel}</span>
                    <span className="restaurant-tag restaurant-tag-price">{restaurant.priceLabel}</span>
                  </p>
                  <p className="restaurant-note">{restaurant.res_note}</p>
                </div>
              </Link>
            </article>
          );
        })}
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
