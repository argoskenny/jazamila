import { RestaurantTools } from "@/components/restaurants/RestaurantTools";
import { buildListPath, parseListFilters, filterCuisineTokens, validListReturnPath } from "@/lib/domain/list-filters";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BlogLinkForm } from "@/components/forms/BlogLinkForm";
import { PickAgainButton } from "@/components/forms/PickAgainButton";
import { RestaurantImage } from "@/components/restaurants/RestaurantImage";
import { listSegmentForCuisineTypeTokens, normalizeCuisineTypeQueryTokens } from "@/lib/domain/cuisine-types";
import { listBlogLinksForRestaurant } from "@/lib/domain/blogs";
import { getRestaurantDetail } from "@/lib/domain/restaurants";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getCachedRestaurantDetail = cache(getRestaurantDetail);

function first(value: string | string[] | undefined, fallback: string): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  const restaurantId = Number.parseInt(id, 10);
  if (!Number.isFinite(restaurantId)) return { title: "找不到餐廳" };
  const restaurant = await getCachedRestaurantDetail(restaurantId);
  if (!restaurant) return { title: "找不到餐廳" };

  const description = [
    restaurant.cuisineTypeLabel,
    restaurant.cityLabel,
    restaurant.districtLabel,
    restaurant.res_address
  ].filter(Boolean).join("｜");
  return {
    title: restaurant.res_name,
    description,
    alternates: { canonical: `/detail/${restaurant.id}` },
    openGraph: {
      type: "article",
      title: restaurant.res_name,
      description,
      url: `/detail/${restaurant.id}`,
      images: [{ url: restaurant.imagePath, alt: `${restaurant.res_name}餐廳照片` }]
    }
  };
}

export default async function DetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const restaurantId = Number.parseInt(id, 10);
  if (!Number.isFinite(restaurantId)) notFound();

  const [restaurant, blogLinks] = await Promise.all([
    getCachedRestaurantDetail(restaurantId),
    listBlogLinksForRestaurant(restaurantId)
  ]);
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
  const searchKeyword = first(query.search_keyword, "").trim();
  const legacyFilters = parseListFilters(listRecord.split("/"), { search_keyword: searchKeyword });
  const legacyTokens = cuisineTypes.length ? cuisineTypes : foodTypes.map((id) => `legacy:${id}`);
  const returnTo = validListReturnPath(first(query.returnTo, "")) ?? buildListPath({ ...legacyFilters,
    ...(legacyTokens.length ? { cuisineTokens: legacyTokens } : {}) }, legacyFilters.page);
  const returnUrl = new URL(returnTo, "http://localhost");
  const returnFilters = parseListFilters(returnUrl.pathname.split("/").slice(2), Object.fromEntries(returnUrl.searchParams));
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
          <div className="restaurant-tags" aria-label="餐廳分類">
            <span className="restaurant-tag restaurant-tag-cuisine">{restaurant.cuisineTypeLabel}</span>
            {restaurant.auxiliaryTags.map((tag) => (
              <span className="restaurant-tag restaurant-tag-feature" key={tag}>{tag}</span>
            ))}
          </div>
          {restaurant.reviewSummaries.length > 0 ? (
            <div className="review-summary">
              <h2>評論摘要</h2>
              <ul>{restaurant.reviewSummaries.slice(0, 4).map((summary) => <li key={summary}>{summary}</li>)}</ul>
            </div>
          ) : null}
          <p className="data-provenance">{restaurant.ratingPlatform ? `評分來源：${restaurant.ratingPlatform}。` : "評分來源未提供。"}
            資料更新：{restaurant.res_updatetime ? new Date(restaurant.res_updatetime * 1000).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" }) : "未提供"}。營業時間與評分為資料紀錄，非即時資訊，出發前請向店家確認。
            {restaurant.sourceLinks?.map((source) => <a className="text-link" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
          </p>
          <RestaurantTools id={restaurant.id} name={restaurant.res_name} trackRecent={first(query.picked, "") === "1"} />
          <Link className="text-link" href={`/about?restaurant=${restaurant.id}&name=${encodeURIComponent(restaurant.res_name)}`}>回報資料有誤／已歇業</Link>
          <div className="detail-actions">
            <PickAgainButton
              currentRestaurantId={restaurant.id}
              returnTo={returnTo}
              keyword={returnFilters.keyword}
              location={returnFilters.location}
              foodType={Number.parseInt(first(query.ut, "0"), 10) || 0}
              foodTypes={foodTypes}
              cuisineTypes={filterCuisineTokens(returnFilters).length ? filterCuisineTokens(returnFilters) : cuisineTypes}
              maxPrice={returnFilters.maxPrice}
              minPrice={returnFilters.minPrice}
            />
            <Link className="button ghost" href={returnTo}>返回列表</Link>
          </div>
        </div>
        <section className="panel form-grid" aria-labelledby="blog-links-heading">
          <h2 id="blog-links-heading">食記介紹</h2>
          {blogLinks.length > 0 ? (
            <ul className="blog-list">
              {blogLinks.map((blogLink) => (
                <li key={blogLink.id}>
                  <a className="text-link" href={blogLink.b_bloglink} target="_blank" rel="noreferrer">
                    {blogLink.b_blogname}
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="lead">目前還沒有公開食記。</p>}
        </section>
        <BlogLinkForm restaurantId={restaurant.id} />
      </div>
    </section>
  );
}
