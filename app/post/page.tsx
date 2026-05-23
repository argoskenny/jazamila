import { RestaurantPostForm } from "@/components/forms/RestaurantPostForm";
import { foodTypes, getRegions, sectionsByRegion } from "@/lib/domain/sections";

export default function PostPage() {
  return (
    <section className="page-shell detail-grid">
      <div className="panel">
        <h1 className="page-title">餐廳分享</h1>
        <p className="lead">如果你知道一間值得丟進命運輪盤的店，就把它交給我們。</p>
      </div>
      <RestaurantPostForm regions={getRegions()} sectionsByRegion={sectionsByRegion} foodTypes={foodTypes} />
    </section>
  );
}
