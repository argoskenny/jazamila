import Link from "next/link";
import { MeetLoginForm } from "@/components/forms/MeetLoginForm";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MeetLoginPage({ searchParams }: Props) {
  const query = await searchParams;
  const error = first(query.error);

  return (
    <section className="page-shell detail-grid">
      <div className="panel">
        <h1 className="page-title">歡迎回來</h1>
        <p className="lead">登入後可以維護會員資料，並保留未來 Meet 社群功能的擴充位置。</p>
        <Link className="text-link" href="/meet/register">
          還沒有帳號？
        </Link>
      </div>
      <MeetLoginForm error={error} />
    </section>
  );
}
