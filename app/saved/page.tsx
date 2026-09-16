import type { Metadata } from "next";
import { SavedRestaurants } from "@/components/restaurants/RestaurantTools";
export const metadata: Metadata = { title: "我的收藏", robots: { index: false, follow: true } };
export default function SavedPage() {
  return <section className="page-shell"><h1 className="page-title">我的收藏與抽選紀錄</h1><SavedRestaurants /></section>;
}
