import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAZAMILA",
  description: "JAZAMILA內有許多美食、餐廳的資料，幫你解決不知該吃哪間餐廳的煩惱。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="JAZAMILA 首頁">
            <img src="/assets/img/jazamila/logo/jazamila_logo.png" alt="" className="brand-logo" />
            <span>JAZAMILA</span>
          </Link>
          <nav className="site-nav" aria-label="主要導覽">
            <Link href="/">首頁</Link>
            <Link href="/listdata/0/0/0/0/1">餐廳列表</Link>
            <Link href="/about">關於本站</Link>
            <Link href="/post">餐廳分享</Link>
            <Link href="/map">美食地圖</Link>
            <Link href="/meet">Meet</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <span>2025 JAZAMILA</span>
          <Link href="/admin">管理後台</Link>
        </footer>
      </body>
    </html>
  );
}
