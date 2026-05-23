import Link from "next/link";
import { logoutMeetAction } from "@/app/meet/actions";
import { MeetProfileForm } from "@/components/forms/MeetProfileForm";
import { requireMeetUser } from "@/lib/auth/meet";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MeetProfilePage({ searchParams }: Props) {
  const user = await requireMeetUser();
  const query = await searchParams;

  return (
    <section className="page-shell detail-grid">
      <div className="panel">
        <h1 className="page-title">{user.name || user.account}</h1>
        <p className="lead">{user.description || "還沒有自我介紹。"}</p>
        <div className="actions">
          <Link className="button ghost" href={`/member/${user.id}`}>
            查看公開頁
          </Link>
          <form action={logoutMeetAction}>
            <button className="button ghost" type="submit">
              登出
            </button>
          </form>
        </div>
      </div>
      <MeetProfileForm user={user} error={first(query.error)} saved={first(query.saved) === "1"} />
    </section>
  );
}
