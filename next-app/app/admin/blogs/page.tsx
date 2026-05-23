import { approveBlogAction, rejectBlogAction } from "@/app/admin/blogs/actions";
import { requireAdmin } from "@/lib/auth/admin";
import { listBlogLinksForAdmin } from "@/lib/domain/blogs";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function statusLabel(status: number): string {
  if (status === 1) return "已通過";
  if (status === 2) return "未通過";
  return "待審核";
}

export default async function AdminBlogsPage({ searchParams }: Props) {
  await requireAdmin();
  const query = await searchParams;
  const status = query.status === undefined ? undefined : Number.parseInt(String(query.status), 10);
  const blogLinks = await listBlogLinksForAdmin(Number.isFinite(status) ? status : undefined);

  return (
    <div className="form-grid">
      <div>
        <h1 className="page-title">食記審核</h1>
        <p className="lead">處理餐廳詳細頁收到的外部食記連結。</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>餐廳 ID</th>
              <th>名稱</th>
              <th>網址</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {blogLinks.map((blog) => (
              <tr key={blog.id}>
                <td>{blog.id}</td>
                <td>{blog.b_res_id}</td>
                <td>{blog.b_blogname}</td>
                <td>
                  <a className="text-link" href={blog.b_bloglink} target="_blank" rel="noreferrer">
                    開啟
                  </a>
                </td>
                <td>{statusLabel(blog.b_blog_show)}</td>
                <td>
                  <form className="actions" action={approveBlogAction}>
                    <input type="hidden" name="id" value={blog.id} />
                    <button className="button secondary" type="submit">
                      通過
                    </button>
                  </form>
                  <form className="actions" action={rejectBlogAction}>
                    <input type="hidden" name="id" value={blog.id} />
                    <button className="button ghost" type="submit">
                      不通過
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
