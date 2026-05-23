import { updateMeetProfileAction } from "@/app/meet/actions";
import type { MeetUser } from "@/lib/domain/types";

type Props = {
  user: MeetUser;
  error?: string;
  saved?: boolean;
};

export function MeetProfileForm({ user, error, saved }: Props) {
  return (
    <form className="panel form-grid" action={updateMeetProfileAction}>
      <h1 className="section-title">會員資料</h1>
      <input type="hidden" name="id" value={user.id} />
      <label className="field">
        <span>帳號</span>
        <input className="input" value={user.account} disabled />
      </label>
      <label className="field">
        <span>顯示名稱</span>
        <input className="input" name="name" defaultValue={user.name} />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" name="email" type="email" defaultValue={user.email} required />
      </label>
      <label className="field">
        <span>自我介紹</span>
        <textarea className="textarea" name="description" defaultValue={user.description} />
      </label>
      <button className="button" type="submit">
        儲存資料
      </button>
      {saved ? <p className="status">已更新會員資料。</p> : null}
      {error ? <p className="status">{error}</p> : null}
    </form>
  );
}
