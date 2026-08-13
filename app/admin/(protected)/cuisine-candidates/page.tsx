import { prisma } from "@/lib/db/prisma";

export default async function CuisineCandidatesPage() {
  const [candidates, automaticTypes, batches] = await Promise.all([
    prisma.cuisineType.findMany({ where: { status: "candidate" }, orderBy: { id: "asc" } }),
    prisma.cuisineType.findMany({ where: { createdBy: { in: ["ai", "manual"] } }, orderBy: { id: "asc" } }),
    prisma.cuisineApplyBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { changes: true } } } })
  ]);

  return (
    <div className="form-grid">
      <div>
        <h1 className="page-title">料理類型候選與自動決策</h1>
        <p className="lead">候選必須完成 approve、merge 或 reject；正常完成狀態不可留下 pending。</p>
      </div>
      <section className="panel">
        <h2>待處理候選</h2>
        {candidates.length === 0 ? <p>目前沒有 pending 候選。</p> : (
          <ul>{candidates.map((candidate) => <li key={candidate.id}>{candidate.name}（{candidate.code}）</li>)}</ul>
        )}
      </section>
      <section className="panel">
        <h2>已建立／核准的類型</h2>
        {automaticTypes.length === 0 ? <p>沒有由分類流程建立的新類型。</p> : (
          <ul>{automaticTypes.map((type) => <li key={type.id}>{type.name}（{type.code}，來源：{type.createdBy}）</li>)}</ul>
        )}
      </section>
      <section className="panel">
        <h2>最近套用紀錄</h2>
        <div className="table-wrap"><table><thead><tr><th>Batch</th><th>狀態</th><th>來源</th><th>變更數</th></tr></thead>
          <tbody>{batches.map((batch) => <tr key={batch.id}><td>{batch.id}</td><td>{batch.status}</td><td>{batch.source}</td><td>{batch._count.changes}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}
