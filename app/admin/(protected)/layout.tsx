import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/admin";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAdmin();

  return (
    <>
      <AdminNav username={session.username} />
      {children}
    </>
  );
}
