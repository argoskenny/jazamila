import Link from "next/link";
import { RestaurantListFilter } from "@/components/forms/RestaurantListFilter";
import { RestaurantImage } from "@/components/restaurants/RestaurantImage";
import { createPagination } from "@/lib/pagination";
import { buildListPath, getActiveCuisineTypeOptions, listRestaurants, parseListFilters, summarizeRestaurantTags } from "@/lib/domain/restaurants";
import { getRegions, moneyOptions, sectionsByRegion } from "@/lib/domain/sections";

type Props = {
  params: Promise<{ filters?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListDataPage({ params, searchParams }: Props) {
  const { filters: segments } = await params;
  const query = await searchParams;
  const filters = parseListFilters(segments, query);
  const [result, cuisineTypes] = await Promise.all([listRestaurants(filters), getActiveCuisineTypeOptions()]);
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
            cuisineTypes={cuisineTypes}
            moneyOptions={moneyOptions}
          />
        </div>
        <p className="list-count" aria-live="polite">
          共 {result.totalRows.toLocaleString("zh-TW")} 間餐廳
        </p>
      </div>

      <div className="restaurant-list">
        {result.restaurants.map((restaurant) => {
          const cuisineQuery = filters.cuisineTypeCode
            ? `&uct=${encodeURIComponent(`code:${filters.cuisineTypeCode}`)}`
            : `&ut=${filters.foodType}`;
          const detailHref = `/detail/${restaurant.id}?ul=${filters.location}${cuisineQuery}&umx=${filters.maxPrice}&umi=${filters.minPrice}&p=${result.page}`;
          const titleId = `restaurant-${restaurant.id}-title`;
          const tagSummary = summarizeRestaurantTags(restaurant.auxiliaryTags, restaurant.cuisineTypeLabel);

          return (
            <article key={restaurant.id}>
              <Link className="restaurant-card" href={detailHref} aria-labelledby={titleId}>
                <RestaurantImage
                  src={restaurant.imagePath}
                  fallbackSrc={restaurant.fallbackImagePath}
                  alt={`${restaurant.res_name}餐廳照片`}
                />
                <div>
                  <h2 id={titleId}>{restaurant.res_name}</h2>
                  <p className="restaurant-address">
                    {[restaurant.cityLabel, restaurant.districtLabel].filter(Boolean).join("・")}
                    {restaurant.res_address ? `｜${restaurant.res_address}` : "｜地址未提供"}
                  </p>
                  {restaurant.ratingScore != null ? (
                    <p className="restaurant-rating" aria-label={`評分 ${restaurant.ratingScore} 分`}>
                      <span aria-hidden="true">★</span> {restaurant.ratingScore.toFixed(1)}
                      {restaurant.ratingReviewCount != null ? `（${restaurant.ratingReviewCount.toLocaleString("zh-TW")} 則）` : ""}
                    </p>
                  ) : null}
                  <div className="restaurant-classification" aria-label="餐廳分類">
                    <p><strong>料理類型：</strong><span className="restaurant-tag restaurant-tag-cuisine">{restaurant.cuisineTypeLabel}</span></p>
                    <p><strong>輔助標籤：</strong>
                    <span className="restaurant-tag restaurant-tag-price">{restaurant.priceLabel}</span>
                    {tagSummary.visibleTags.map((tag) => (
                      <span className="restaurant-tag restaurant-tag-feature" key={tag}>{tag}</span>
                    ))}
                    {tagSummary.hiddenCount > 0 ? (
                      <span className="restaurant-tag restaurant-tag-more">+{tagSummary.hiddenCount}</span>
                    ) : null}
                    {restaurant.auxiliaryTags.length === 0 ? <span>無</span> : null}
                    </p>
                  </div>
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
