import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-shell">
      <div className="panel form-grid">
        <h1 className="page-title">找不到這個頁面</h1>
        <p className="lead">這個連結可能已失效，或餐廳目前沒有公開。</p>
        <div className="detail-actions">
          <Link className="button" href="/">回首頁</Link>
          <Link className="button ghost" href="/listdata/0/0/0/0/1">瀏覽餐廳</Link>
        </div>
      </div>
    </section>
  );
}
