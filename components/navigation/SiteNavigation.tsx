"use client";
import Link from "next/link";
import { useState } from "react";

export function SiteNavigation() {
  const [open, setOpen] = useState(false);
  return <>
    <button className="mobile-menu-toggle button ghost" type="button" aria-expanded={open} aria-controls="site-navigation" onClick={() => setOpen(!open)}>{open ? "關閉選單" : "選單"}</button>
    <nav id="site-navigation" className={`site-nav${open ? " is-open" : ""}`} aria-label="主要導覽" onClick={() => setOpen(false)}>
      <Link href="/">首頁</Link><Link href="/listdata/0/0/0/0/1">餐廳列表</Link><Link href="/about">關於本站</Link><Link href="/post">餐廳分享</Link>
    </nav>
  </>;
}
