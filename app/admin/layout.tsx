export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <section className="admin-shell">{children}</section>;
}
