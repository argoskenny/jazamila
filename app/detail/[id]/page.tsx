import Link from "next/link";
import { notFound } from "next/navigation";
import { PickAgainButton } from "@/components/forms/PickAgainButton";
import { RestaurantImage } from "@/components/restaurants/RestaurantImage";
import { listSegmentForCuisineTypeTokens, normalizeCuisineTypeQueryTokens } from "@/lib/domain/cuisine-types";
import { getRestaurantDetail } from "@/lib/domain/restaurants";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined, fallback: string): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default async function DetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const restaurantId = Number.parseInt(id, 10);
  if (!Number.isFinite(restaurantId)) notFound();

  const restaurant = await getRestaurantDetail(restaurantId);
  if (!restaurant) notFound();

  const cuisineTypes = normalizeCuisineTypeQueryTokens(first(query.uct, ""));
  const listTypeSegment = listSegmentForCuisineTypeTokens(cuisineTypes) ?? first(query.ut, "0");
  const listRecord = [
    first(query.ul, "0"),
    listTypeSegment,
    first(query.umx, "0"),
    first(query.umi, "0"),
    first(query.p, "1")
  ].join("/");
  const foodTypes = first(query.uft, "")
    .split("-")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  const restaurantNameMapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.res_name)}`;

  return (
    <section className="page-shell detail-grid">
      <div className="detail-media">
        <RestaurantImage
          key={restaurant.id}
          src={restaurant.imagePath}
          fallbackSrc={restaurant.fallbackImagePath}
          alt={`${restaurant.res_name}餐廳照片`}
          eager
        />
      </div>
      <div className="form-grid">
        <div className="panel detail-restaurant-panel">
          <h1 className="page-title">
            <a className="detail-restaurant-name-link" href={restaurantNameMapHref} target="_blank" rel="noreferrer">
              {restaurant.res_name}
            </a>
          </h1>
          <p className="detail-restaurant-contact">
            {restaurant.mapHref ? (
              <a className="detail-restaurant-contact-link" href={restaurant.mapHref} target="_blank" rel="noreferrer">
                {restaurant.res_address || "地址未提供"}
              </a>
            ) : restaurant.res_address || "地址未提供"}
          </p>
          <p className="detail-restaurant-contact">
            <strong>電話：</strong>
            {restaurant.phoneHref ? <a className="detail-restaurant-contact-link" href={restaurant.phoneHref}>{restaurant.telLabel}</a> : restaurant.telLabel}
          </p>
          <div className="detail-facts" aria-label="餐廳摘要">
            {restaurant.ratingScore != null ? (
              <p><strong><span aria-hidden="true">★</span> {restaurant.ratingScore.toFixed(1)}</strong><span>{restaurant.ratingReviewCount != null ? `${restaurant.ratingReviewCount.toLocaleString("zh-TW")} 則評論` : restaurant.ratingPlatform}</span></p>
            ) : null}
            <p><strong>{restaurant.priceLabel}</strong><span>平均消費</span></p>
            <p><strong>{restaurant.businessHoursLabel}</strong><span>營業時間</span></p>
          </div>
          <p className="restaurant-tags">
            <span className="restaurant-tag restaurant-tag-cuisine">{restaurant.foodTypeLabel}</span>
            {restaurant.tags.filter((tag) => tag !== restaurant.foodTypeLabel).map((tag) => (
              <span className="restaurant-tag restaurant-tag-feature" key={tag}>{tag}</span>
            ))}
          </p>
          {restaurant.reviewSummaries.length > 0 ? (
            <div className="review-summary">
              <h2>評論摘要</h2>
              <ul>{restaurant.reviewSummaries.slice(0, 4).map((summary) => <li key={summary}>{summary}</li>)}</ul>
            </div>
          ) : null}
          <div className="detail-actions">
            <PickAgainButton
              currentRestaurantId={restaurant.id}
              location={first(query.ul, "0")}
              foodType={Number.parseInt(first(query.ut, "0"), 10) || 0}
              foodTypes={foodTypes}
              cuisineTypes={cuisineTypes}
              maxPrice={Number.parseInt(first(query.umx, "0"), 10) || 0}
              minPrice={Number.parseInt(first(query.umi, "0"), 10) || 0}
            />
            <Link className="button ghost" href={`/listdata/${listRecord}`}>返回列表</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
