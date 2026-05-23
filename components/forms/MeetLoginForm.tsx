import { loginMeetAction } from "@/app/meet/actions";

export function MeetLoginForm({ error }: { error?: string }) {
  return (
    <form className="panel form-grid" action={loginMeetAction}>
      <h1 className="section-title">會員登入</h1>
      <label className="field">
        <span>帳號</span>
        <input className="input" name="account" autoComplete="username" required />
      </label>
      <label className="field">
        <span>密碼</span>
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button" type="submit">
        登入
      </button>
      {error ? <p className="status">{error}</p> : null}
    </form>
  );
}
