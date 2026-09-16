import { PendingSubmit } from "@/components/admin/PendingSubmit";
import Link from "next/link";
import { approvePostAction, rejectPostAction } from "@/app/admin/posts/actions";
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

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPostsPage({ searchParams }: Props) {
  const query = await searchParams;
  const requestedStatus = Number.parseInt(first(query.status) ?? "", 10);
  const status = Number.isFinite(requestedStatus) ? requestedStatus : undefined;
  const requestedPage = Number.parseInt(first(query.page) ?? first(query.set) ?? "1", 10);
  const result = await listPostsForAdmin({
    status,
    page: Number.isFinite(requestedPage) ? requestedPage : 1
  });
  const statusQuery = status === undefined ? "" : `&status=${status}`;

  return (
    <div className="form-grid">
      <div>
        <h1 className="page-title">投稿審核</h1>
        <p className="lead">處理使用者分享的餐廳，共 {result.totalRows} 筆。</p>
      </div>
      <nav className="active-filters" aria-label="投稿狀態"><Link href="?status=0">待審核</Link><Link href="?status=1">已通過</Link><Link href="?status=2">未通過</Link><Link href="/admin/posts">全部</Link></nav>
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
            {result.posts.map((post) => (
              <tr key={post.id}>
                <td>{post.id}</td>
                <td>
                  <strong>{post.post_name}</strong>
                  <p>{post.post_note}</p>
                  <p>地址：{post.post_address || "未提供"}</p>
                  <p>電話：{[post.post_area_num, post.post_tel_num].filter(Boolean).join(" ") || "未提供"}</p>
                  <p>平均價位：{post.post_price > 0 ? `${post.post_price} 元` : "未提供"}</p>
                  {post.restaurantId ? <Link className="text-link" href={`/admin/restaurants/${post.restaurantId}`}>查看已發布餐廳</Link> : null}
                </td>
                <td>{labelFor(regions, post.post_region, "")}{labelFor(getSections(post.post_region), post.post_section, "")}</td>
                <td>{labelFor(foodTypes, post.post_foodtype, "未分類")}</td>
                <td>{statusLabel(post.post_prove)}</td>
                <td>
                  {post.post_prove !== 1 ? (
                    <form className="actions" action={approvePostAction}>
                      <input type="hidden" name="id" value={post.id} />
                      <PendingSubmit className="button secondary">
                        通過
                      </PendingSubmit>
                    </form>
                  ) : null}
                  {post.post_prove !== 2 ? (
                    <form className="actions" action={rejectPostAction}>
                      <input type="hidden" name="id" value={post.id} />
                      <PendingSubmit className="button ghost">
                        不通過
                      </PendingSubmit>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="pagination" aria-label="投稿分頁">
        {result.page > 1 ? <Link href={`?page=${result.page - 1}${statusQuery}`}>上一頁</Link> : <span>上一頁</span>}
        <span className="active">{result.page} / {result.totalPages}</span>
        {result.page < result.totalPages ? <Link href={`?page=${result.page + 1}${statusQuery}`}>下一頁</Link> : <span>下一頁</span>}
      </nav>
    </div>
  );
}
