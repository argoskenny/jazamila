"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="page-shell">
      <div className="panel form-grid">
        <h1 className="page-title">目前無法載入</h1>
        <p className="lead">資料暫時沒有準備好，請稍後再試。</p>
        <button className="button" type="button" onClick={reset}>重新載入</button>
      </div>
    </section>
  );
}
