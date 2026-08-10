import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogLinkForm } from "@/components/forms/BlogLinkForm";
import { listBlogLinksForRestaurant } from "@/lib/domain/blogs";
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

  const listRecord = [
    first(query.ul, "0"),
    first(query.ut, "0"),
    first(query.umx, "0"),
    first(query.umi, "0"),
    first(query.p, "1")
  ].join("/");
  const blogLinks = await listBlogLinksForRestaurant(restaurant.id);

  return (
    <section className="page-shell detail-grid">
      <div className="detail-media">
        <img src={restaurant.imagePath} alt={restaurant.res_name} />
      </div>
      <div className="form-grid">
        <div className="panel detail-restaurant-panel">
          <h1 className="page-title">{restaurant.res_name}</h1>
          <p className="detail-restaurant-address">{restaurant.res_address || "地址未提供"}</p>
          <p className="detail-restaurant-phone">
            <strong>電話：</strong>
            {restaurant.telLabel}
          </p>
          <p className="restaurant-tags">
            <span className="restaurant-tag restaurant-tag-cuisine">{restaurant.foodTypeLabel}</span>
            <span className="restaurant-tag restaurant-tag-price">{restaurant.priceLabel}</span>
          </p>
          <p className="detail-restaurant-note">{restaurant.res_note}</p>
          <Link className="text-link" href={`/listdata/${listRecord}`}>
            返回列表
          </Link>
        </div>

        <div className="panel">
          <h2>食記介紹</h2>
          <div className="blog-list">
            {blogLinks.map((blog) => (
              <a className="text-link" href={blog.b_bloglink} key={blog.id} rel="noreferrer" target="_blank">
                {blog.b_blogname}
              </a>
            ))}
            {blogLinks.length === 0 ? <p>目前還沒有食記。</p> : null}
          </div>
        </div>

        <BlogLinkForm restaurantId={restaurant.id} />
      </div>
    </section>
  );
}
