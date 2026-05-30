import { loginAction } from "@/app/admin/login/actions";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const query = await searchParams;
  const hasError = query.error === "1";
  const isRateLimited = query.error === "rate_limit";

  return (
    <div className="page-shell" style={{ maxWidth: 460 }}>
      <form className="panel form-grid" action={loginAction}>
        <h1 className="section-title">後台登入</h1>
        <label className="field">
          <span>帳號</span>
          <input className="input" name="username" autoComplete="username" required />
        </label>
        <label className="field">
          <span>密碼</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="button" type="submit">
          登入
        </button>
        {hasError ? <p className="status">帳號或密碼不正確。</p> : null}
        {isRateLimited ? <p className="status">登入嘗試過於頻繁，請稍後再試。</p> : null}
      </form>
    </div>
  );
}
