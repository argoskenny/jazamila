import Link from "next/link";
import { countAdminDashboardStats } from "@/lib/domain/admin";

export default async function AdminDashboardPage() {
  const stats = await countAdminDashboardStats();

  return (
    <div className="form-grid">
      <h1 className="page-title">後台總覽</h1>
      <div className="stat-grid">
        <Link className="stat" href="/admin/restaurants">
          <span>餐廳</span>
          <strong>{stats.restaurants}</strong>
        </Link>
        <Link className="stat" href="/admin/posts">
          <span>投稿</span>
          <strong>{stats.posts}</strong>
        </Link>
        <Link className="stat" href="/admin/blogs">
          <span>食記</span>
          <strong>{stats.blogs}</strong>
        </Link>
        <Link className="stat" href="/admin/feedback">
          <span>回饋</span>
          <strong>{stats.feedback}</strong>
        </Link>
      </div>
    </div>
  );
}
