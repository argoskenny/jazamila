"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type Item = { id: number; name: string; href: string; until?: number };
type Saved = { favorites: Item[]; recent: Item[]; excluded: Item[] };
const key = "jazamila:choices:v1";
const empty = (): Saved => ({ favorites: [], recent: [], excluded: [] });
function snapshot() { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener("jazamila:choices", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("jazamila:choices", callback); };
}
function parse(value: string): Saved {
  try {
    const parsed = JSON.parse(value);
    const items = (value: unknown): Item[] => Array.isArray(value) ? value.filter((item) => Number.isSafeInteger(item?.id) && item.id > 0 && typeof item.name === "string").map((item) => ({ ...item, href: `/detail/${item.id}` })) : [];
    return { favorites: items(parsed.favorites).slice(0, 100), recent: items(parsed.recent).slice(0, 20), excluded: items(parsed.excluded).filter((item) => Number(item.until) > Date.now()).slice(0, 10) };
  } catch { return empty(); }
}
function save(data: Saved) {
  localStorage.setItem(key, JSON.stringify(data));
  document.cookie = `excluded_restaurants=${data.excluded.map((item) => `${item.id}@${item.until}`).join("-")}; Path=/; Max-Age=86400; SameSite=Lax`;
  window.dispatchEvent(new Event("jazamila:choices"));
}
function useChoices() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => parse(value), [value]);
}
export function RestaurantTools({ id, name, trackRecent = false, compact = false }: { id: number; name: string; trackRecent?: boolean; compact?: boolean }) {
  const choices = useChoices(); const [message, setMessage] = useState("");
  const saved = choices.favorites.some((item) => item.id === id);
  const excluded = choices.excluded.some((item) => item.id === id);
  useEffect(() => {
    if (!trackRecent) return;
    try { const data = parse(snapshot()); save({ ...data, recent: [{ id, name, href: `/detail/${id}` }, ...data.recent.filter((item) => item.id !== id)].slice(0, 20) }); }
    catch { /* Browsing remains available when storage is unavailable. */ }
  }, [id, name, trackRecent]);
  function toggle(kind: "favorites" | "excluded") {
    try {
      const data = parse(snapshot()); const list = data[kind]; const exists = list.some((item) => item.id === id);
      if (!exists && list.length >= (kind === "favorites" ? 100 : 10)) { setMessage(kind === "favorites" ? "收藏最多 100 間，請先整理收藏。" : "最多暫時排除 10 間，請先至我的收藏整理。"); return; }
      save({ ...data, [kind]: exists ? list.filter((item) => item.id !== id) : [{ id, name, href: `/detail/${id}`, ...(kind === "excluded" ? { until: Date.now() + 86400000 } : {}) }, ...list] });
      setMessage("");
    } catch { setMessage("此瀏覽器無法保存選擇，請確認儲存空間設定。"); }
  }
  return <div className="restaurant-tools">
    <button className="button ghost" type="button" aria-pressed={saved} onClick={() => toggle("favorites")}>{saved ? "已收藏" : "收藏"}</button>
    {!compact ? <button className="button ghost" type="button" aria-pressed={excluded} onClick={() => toggle("excluded")}>{excluded ? "取消暫時排除" : "暫時排除 24 小時"}</button> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
export function SavedRestaurants() {
  const choices = useChoices(); const [message, setMessage] = useState("");
  return <div className="form-grid">
    <p className="lead">儲存在此瀏覽器，不會跨裝置同步。最近抽選保留 20 間，暫時排除最多 10 間。</p>
    {([['favorites', '收藏餐廳'], ['recent', '最近抽選'], ['excluded', '暫時排除']] as const).map(([kind, title]) => <section className="panel form-grid" key={kind}>
      <h2>{title}</h2>{choices[kind].length ? <ul className="saved-list">{choices[kind].map((item) => <li key={item.id}><Link href={item.href}>{item.name}</Link><button className="button ghost" type="button" onClick={() => { try { const data = parse(snapshot()); save({ ...data, [kind]: data[kind].filter((entry) => entry.id !== item.id) }); } catch { setMessage("無法更新儲存內容，請稍後再試。"); } }}>移除</button></li>)}</ul> : <p>目前沒有餐廳。</p>}
    </section>)}{message ? <p role="status">{message}</p> : null}
  </div>;
}
