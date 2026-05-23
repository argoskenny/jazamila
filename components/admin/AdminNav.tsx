import Link from "next/link";
import { logoutAction } from "@/app/admin/login/actions";

export function AdminNav({ username }: { username: string }) {
  return (
    <div className="admin-header">
      <div>
        <strong>JAZAMILA Admin</strong>
        <p className="meta">目前登入：{username}</p>
      </div>
      <nav className="admin-nav" aria-label="後台導覽">
        <Link href="/admin">總覽</Link>
        <Link href="/admin/restaurants">餐廳</Link>
        <Link href="/admin/posts">投稿</Link>
        <Link href="/admin/blogs">食記</Link>
        <Link href="/admin/feedback">回饋</Link>
        <form action={logoutAction}>
          <button className="button ghost" type="submit">
            登出
          </button>
        </form>
      </nav>
    </div>
  );
}
