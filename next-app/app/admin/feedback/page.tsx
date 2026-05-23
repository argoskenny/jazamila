import { markFeedbackReadAction } from "@/app/admin/feedback/actions";
import { requireAdmin } from "@/lib/auth/admin";
import { listFeedbackForAdmin } from "@/lib/domain/feedback";

export default async function AdminFeedbackPage() {
  await requireAdmin();
  const feedback = await listFeedbackForAdmin();

  return (
    <div className="form-grid">
      <div>
        <h1 className="page-title">回饋列表</h1>
        <p className="lead">查看使用者留下的站務意見。</p>
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
            {feedback.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.f_name}</td>
                <td>{item.f_email}</td>
                <td>{item.f_content}</td>
                <td>{item.f_isread === 1 ? "已讀" : "未讀"}</td>
                <td>
                  <form action={markFeedbackReadAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="button ghost" type="submit">
                      標為已讀
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
