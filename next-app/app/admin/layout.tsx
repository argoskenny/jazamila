import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminSession } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();

  return (
    <section className="admin-shell">
      {session ? <AdminNav username={session.username} /> : null}
      {children}
    </section>
  );
}
