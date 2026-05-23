import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAZAMILA",
  description: "選擇生活，選擇今天吃什麼。"
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
            <Link href="/">吃什麼</Link>
            <Link href="/listdata/0/0/0/0/1">餐廳列表</Link>
            <Link href="/map">美食地圖</Link>
            <Link href="/post">餐廳分享</Link>
            <Link href="/about">關於本站</Link>
            <Link href="/meet">Meet</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <span>JAZAMILA Next.js rewrite</span>
          <Link href="/admin">管理後台</Link>
        </footer>
      </body>
    </html>
  );
}
