import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeetUser } from "@/lib/domain/meet";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MemberPage({ params }: Props) {
  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isFinite(userId)) notFound();

  const user = await getMeetUser(userId);
  if (!user) notFound();

  return (
    <section className="page-shell">
      <div className="panel">
        <h1 className="page-title">{user.name || user.account}</h1>
        <p className="lead">{user.description || "這位會員還沒有留下自我介紹。"}</p>
        <p className="meta">
          <span className="tag">{user.account}</span>
          <span>{user.email}</span>
        </p>
        <Link className="text-link" href="/meet">
          回 Meet
        </Link>
      </div>
    </section>
  );
}
