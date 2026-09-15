"use client";

import { useState } from "react";
import { executeRecaptcha } from "@/components/forms/recaptcha";
import type { Option } from "@/lib/domain/types";

type Props = {
  regions: Option[];
  sectionsByRegion: Record<number, Option[]>;
  foodTypes: Option[];
};

export function RestaurantPostForm({ regions, sectionsByRegion, foodTypes }: Props) {
  const [regionId, setRegionId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sections = regionId === "" ? [] : sectionsByRegion[regionId] ?? [];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSubmitting(true);
    setStatus("");

    try {
      const formData = new FormData(form);
      formData.set("recaptcha_token", await executeRecaptcha("restaurant_post"));

      const response = await fetch("/save_post_data", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { status: string; errors?: Record<string, string[]> };
      if (data.status === "success") {
        setStatus("已儲存成功，感謝你的分享！");
        form.reset();
        setRegionId("");
        setSectionId("");
      } else {
        const fieldError = Object.values(data.errors ?? {}).flat()[0];
        setStatus(fieldError ?? "投稿失敗，請確認必填欄位。");
      }
    } catch {
      setStatus("驗證失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
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
          onChange={(event) => {
            const nextRegionId = Number(event.target.value);
            setRegionId(nextRegionId);
            setSectionId("");
          }}
          required
        >
          <option value="" disabled>請選擇縣市</option>
          {regions.filter((region) => region.id > 0).map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>地區 *</span>
        <select
          className="select"
          name="post_section"
          value={sectionId}
          onChange={(event) => setSectionId(Number(event.target.value))}
          required
          disabled={regionId === ""}
        >
          <option value="" disabled>請選擇地區</option>
          {sections.filter((section) => section.id > 0).map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>餐廳地址 *</span>
        <input className="input" name="post_address" placeholder="請輸入餐廳地址" required />
      </label>
      <label className="field">
        <span>餐廳電話區碼</span>
        <input className="input" name="post_area_num" inputMode="numeric" />
      </label>
      <label className="field">
        <span>餐廳電話</span>
        <input className="input" name="post_tel_num" inputMode="numeric" />
      </label>
      <label className="field">
        <span>美食類別 *</span>
        <select className="select" name="post_foodtype" defaultValue="" required>
          <option value="" disabled>請選擇美食類別</option>
          {foodTypes.filter((foodType) => foodType.id > 0).map((foodType) => (
            <option key={foodType.id} value={foodType.id}>
              {foodType.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>平均價位</span>
        <input className="input" name="post_price" type="number" min={0} inputMode="numeric" />
      </label>
      <label className="field">
        <span>餐廳介紹</span>
        <textarea className="textarea" name="post_note" placeholder="請輸入餐廳介紹" />
      </label>
      <button className="button" type="submit" disabled={isSubmitting}>
        確定送出
      </button>
      {status ? <p className="status" role="status">{status}</p> : null}
    </form>
  );
}
