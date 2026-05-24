"use client";

import { useMemo, useState } from "react";
import type { Option } from "@/lib/domain/types";

type Props = {
  regions: Option[];
  sectionsByRegion: Record<number, Option[]>;
  foodTypes: Option[];
};

export function RestaurantPostForm({ regions, sectionsByRegion, foodTypes }: Props) {
  const [regionId, setRegionId] = useState(0);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sections = useMemo(() => sectionsByRegion[regionId] ?? [], [regionId, sectionsByRegion]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const response = await fetch("/save_post_data", {
      method: "POST",
      body: new FormData(event.currentTarget)
    });
    const data = (await response.json()) as { status: string };
    setStatus(data.status === "success" ? "已儲存成功，感謝你的分享！" : "投稿失敗，請確認必填欄位。");
    setIsSubmitting(false);
    if (data.status === "success") event.currentTarget.reset();
  }

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>餐廳分享</h2>
      <label className="field">
        <span>餐廳名稱 *</span>
        <input className="input" name="post_name" placeholder="請輸入餐廳名稱" required />
      </label>
      <label className="field">
        <span>縣市 *</span>
        <select
          className="select"
          name="post_region"
          value={regionId}
          onChange={(event) => setRegionId(Number(event.target.value))}
        >
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>地區 *</span>
        <select className="select" name="post_section">
          <option value={0}>全區</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>餐廳地址 *</span>
        <input className="input" name="post_address" placeholder="請輸入餐廳地址" />
      </label>
      <label className="field">
        <span>餐廳電話區碼</span>
        <input className="input" name="post_area_num" />
      </label>
      <label className="field">
        <span>餐廳電話</span>
        <input className="input" name="post_tel_num" />
      </label>
      <label className="field">
        <span>美食類別 *</span>
        <select className="select" name="post_foodtype">
          {foodTypes.map((foodType) => (
            <option key={foodType.id} value={foodType.id}>
              {foodType.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>平均價位</span>
        <input className="input" name="post_price" type="number" min={0} />
      </label>
      <label className="field">
        <span>餐廳介紹</span>
        <textarea className="textarea" name="post_note" placeholder="請輸入餐廳介紹" />
      </label>
      <button className="button" type="submit" disabled={isSubmitting}>
        確定送出
      </button>
      {status ? <p className="status">{status}</p> : null}
    </form>
  );
}
