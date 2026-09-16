import { PendingSubmit } from "@/components/admin/PendingSubmit";
import Link from "next/link";
import { markFeedbackReadAction } from "@/app/admin/feedback/actions";
import { listFeedbackForAdmin } from "@/lib/domain/feedback";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminFeedbackPage({ searchParams }: Props) {
  const query = await searchParams;
  const requestedPage = Number.parseInt(first(query.page) ?? first(query.set) ?? "1", 10);
  const result = await listFeedbackForAdmin({
    page: Number.isFinite(requestedPage) ? requestedPage : 1
  });

  return (
    <div className="form-grid">
      <div>
        <h1 className="page-title">回饋列表</h1>
        <p className="lead">查看使用者留下的站務意見，共 {result.totalRows} 筆。</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>稱呼</th>
              <th>Email</th>
              <th>內容</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {result.feedback.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.f_name}</td>
                <td>{item.f_email}</td>
                <td>{item.f_content}</td>
                <td>{item.f_isread === 1 ? "已讀" : "未讀"}</td>
                <td>
                  <form action={markFeedbackReadAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <PendingSubmit className="button ghost">
                      標為已讀
                    </PendingSubmit>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="pagination" aria-label="回饋分頁">
        {result.page > 1 ? <Link href={`?page=${result.page - 1}`}>上一頁</Link> : <span>上一頁</span>}
        <span className="active">{result.page} / {result.totalPages}</span>
        {result.page < result.totalPages ? <Link href={`?page=${result.page + 1}`}>下一頁</Link> : <span>下一頁</span>}
      </nav>
    </div>
  );
}
