import Link from "next/link";
import { logoutMeetAction } from "@/app/meet/actions";
import { getMeetSession } from "@/lib/auth/meet";
import { listMeetMembers } from "@/lib/domain/meet";

export default async function MeetPage() {
  const [user, members] = await Promise.all([getMeetSession(), listMeetMembers()]);

  return (
    <section className="page-shell detail-grid">
      <div className="panel">
        <h1 className="page-title">Meet</h1>
        <p className="lead">會員系統已接上 Next.js 與 Prisma SQLite。先從帳號、登入、個人頁開始。</p>
        {user ? (
          <div className="actions">
            <Link className="button" href="/meet/profile">
              我的資料
            </Link>
            <Link className="button ghost" href={`/member/${user.id}`}>
              公開頁
            </Link>
            <form action={logoutMeetAction}>
              <button className="button ghost" type="submit">
                登出
              </button>
            </form>
          </div>
        ) : (
          <div className="actions">
            <Link className="button" href="/meet/login">
              登入
            </Link>
            <Link className="button secondary" href="/meet/register">
              加入會員
            </Link>
          </div>
        )}
      </div>
      <div className="panel">
        <h2>會員列表</h2>
        <div className="blog-list">
          {members.map((member) => (
            <Link className="text-link" href={`/member/${member.id}`} key={member.id}>
              {member.name || member.account}
            </Link>
          ))}
          {members.length === 0 ? <p>目前還沒有會員。</p> : null}
        </div>
      </div>
    </section>
  );
}
