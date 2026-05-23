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
        <img src={restaurant.imagePath} alt="" />
      </div>
      <div className="form-grid">
        <div className="panel">
          <h1 className="page-title">{restaurant.res_name}</h1>
          <p className="meta">
            <span className="tag">{restaurant.regionLabel}{restaurant.sectionLabel}</span>
            <span>{restaurant.foodTypeLabel}</span>
            <span>{restaurant.priceLabel}</span>
          </p>
          <p>{restaurant.res_note}</p>
          <p>
            <strong>地址：</strong>
            {restaurant.res_address}
          </p>
          <p>
            <strong>電話：</strong>
            {restaurant.telLabel}
          </p>
          <Link className="text-link" href={`/listdata/${listRecord}`}>
            回餐廳列表
          </Link>
        </div>

        <div className="panel">
          <h2>相關食記</h2>
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
