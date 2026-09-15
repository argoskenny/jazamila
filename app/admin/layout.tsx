import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理後台",
  alternates: { canonical: "/admin" },
  robots: { index: false, follow: false }
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <section className="admin-shell">{children}</section>;
}
