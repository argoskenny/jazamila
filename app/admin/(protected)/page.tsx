import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listBlogLinksForAdmin } from "@/lib/domain/blogs";
import { listFeedbackForAdmin } from "@/lib/domain/feedback";
import { listPostsForAdmin } from "@/lib/domain/posts";
import { listAllRestaurants } from "@/lib/domain/restaurants";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [restaurants, posts, blogs, feedback] = await Promise.all([
    listAllRestaurants(),
    listPostsForAdmin(),
    listBlogLinksForAdmin(),
    listFeedbackForAdmin()
  ]);

  return (
    <div className="form-grid">
      <h1 className="page-title">後台總覽</h1>
      <div className="stat-grid">
        <Link className="stat" href="/admin/restaurants">
          <span>餐廳</span>
          <strong>{restaurants.length}</strong>
        </Link>
        <Link className="stat" href="/admin/posts">
          <span>投稿</span>
          <strong>{posts.length}</strong>
        </Link>
        <Link className="stat" href="/admin/blogs">
          <span>食記</span>
          <strong>{blogs.length}</strong>
        </Link>
        <Link className="stat" href="/admin/feedback">
          <span>回饋</span>
          <strong>{feedback.length}</strong>
        </Link>
      </div>
    </div>
  );
}
