import { registerMeetAction } from "@/app/meet/actions";

export function MeetRegisterForm({ error }: { error?: string }) {
  return (
    <form className="panel form-grid" action={registerMeetAction}>
      <h1 className="section-title">加入會員</h1>
      <label className="field">
        <span>帳號</span>
        <input className="input" name="account" autoComplete="username" minLength={3} required />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>密碼</span>
        <input className="input" name="password" type="password" autoComplete="new-password" minLength={4} required />
      </label>
      <label className="field">
        <span>確認密碼</span>
        <input
          className="input"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          minLength={4}
          required
        />
      </label>
      <button className="button" type="submit">
        建立帳號
      </button>
      {error ? <p className="status">{error}</p> : null}
    </form>
  );
}
