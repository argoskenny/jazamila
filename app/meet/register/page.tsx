import Link from "next/link";
import { MeetRegisterForm } from "@/components/forms/MeetRegisterForm";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MeetRegisterPage({ searchParams }: Props) {
  const query = await searchParams;
  const error = first(query.error);

  return (
    <section className="page-shell detail-grid">
      <div className="panel">
        <h1 className="page-title">加入 Meet</h1>
        <p className="lead">帳號會使用 bcrypt 儲存；舊 md5 密碼會在登入成功後自動升級。</p>
        <Link className="text-link" href="/meet/login">
          已經有帳號？
        </Link>
      </div>
      <MeetRegisterForm error={error} />
    </section>
  );
}
