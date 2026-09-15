import Link from "next/link";
import { approveBlogAction, rejectBlogAction } from "@/app/admin/blogs/actions";
import { listBlogLinksForAdmin } from "@/lib/domain/blogs";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function statusLabel(status: number): string {
  if (status === 1) return "已通過";
  if (status === 2) return "未通過";
  return "待審核";
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBlogsPage({ searchParams }: Props) {
  const query = await searchParams;
  const requestedStatus = Number.parseInt(first(query.status) ?? "", 10);
  const status = Number.isFinite(requestedStatus) ? requestedStatus : undefined;
  const requestedPage = Number.parseInt(first(query.page) ?? first(query.set) ?? "1", 10);
  const result = await listBlogLinksForAdmin({
    status,
    page: Number.isFinite(requestedPage) ? requestedPage : 1
  });
  const statusQuery = status === undefined ? "" : `&status=${status}`;

  return (
    <div className="form-grid">
      <div>
        <h1 className="page-title">食記審核</h1>
        <p className="lead">處理餐廳詳細頁收到的外部食記連結，共 {result.totalRows} 筆。</p>
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
            {result.blogLinks.map((blog) => (
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
      <nav className="pagination" aria-label="食記分頁">
        {result.page > 1 ? <Link href={`?page=${result.page - 1}${statusQuery}`}>上一頁</Link> : <span>上一頁</span>}
        <span className="active">{result.page} / {result.totalPages}</span>
        {result.page < result.totalPages ? <Link href={`?page=${result.page + 1}${statusQuery}`}>下一頁</Link> : <span>下一頁</span>}
      </nav>
    </div>
  );
}
