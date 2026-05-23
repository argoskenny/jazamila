import { approvePostAction, rejectPostAction } from "@/app/admin/posts/actions";
import { requireAdmin } from "@/lib/auth/admin";
import { foodTypes, getSections, labelFor, regions } from "@/lib/domain/sections";
import { listPostsForAdmin } from "@/lib/domain/posts";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function statusLabel(status: number): string {
  if (status === 1) return "已通過";
  if (status === 2) return "未通過";
  return "待審核";
}

export default async function AdminPostsPage({ searchParams }: Props) {
  await requireAdmin();
  const query = await searchParams;
  const status = query.status === undefined ? undefined : Number.parseInt(String(query.status), 10);
  const posts = await listPostsForAdmin(Number.isFinite(status) ? status : undefined);

  return (
    <div className="form-grid">
      <div>
        <h1 className="page-title">投稿審核</h1>
        <p className="lead">處理使用者分享的餐廳。</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名稱</th>
              <th>地區</th>
              <th>類型</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>{post.id}</td>
                <td>
                  <strong>{post.post_name}</strong>
                  <p>{post.post_note}</p>
                </td>
                <td>{labelFor(regions, post.post_region, "")}{labelFor(getSections(post.post_region), post.post_section, "")}</td>
                <td>{labelFor(foodTypes, post.post_foodtype, "未分類")}</td>
                <td>{statusLabel(post.post_prove)}</td>
                <td>
                  <form className="actions" action={approvePostAction}>
                    <input type="hidden" name="id" value={post.id} />
                    <button className="button secondary" type="submit">
                      通過
                    </button>
                  </form>
                  <form className="actions" action={rejectPostAction}>
                    <input type="hidden" name="id" value={post.id} />
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
