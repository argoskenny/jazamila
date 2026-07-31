"use client";

import { useEffect, useMemo, useState } from "react";
import type { HomePreferences, Option } from "@/lib/domain/types";

type Props = {
  preferences: HomePreferences;
  regions: Option[];
  sectionsByRegion: Record<number, Option[]>;
  foodTypes: Option[];
  moneyOptions: Option[];
};

export function PickRestaurantForm({ preferences, regions, sectionsByRegion, foodTypes, moneyOptions }: Props) {
  const [regionId, setRegionId] = useState(preferences.foodwhere_region);
  const [sectionId, setSectionId] = useState(preferences.foodwhere_section);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const sections = useMemo(() => sectionsByRegion[regionId] ?? [], [regionId, sectionsByRegion]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    try {
      const form = new FormData(event.currentTarget);
      form.set("foodwhere_section", String(sectionId));
      form.set("remember", form.get("remember") === "1" ? "1" : "0");

      const response = await fetch("/jazamila_ajax/pick", {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        throw new Error(`Pick request failed with status ${response.status}`);
      }

      const data = (await response.json()) as { status: string; res_id: number };

      if (data.status === "success" && data.res_id > 0) {
        window.location.href = `/detail/${data.res_id}`;
        return;
      }

      setStatus("找不到餐廳耶...也許你該換個條件試試？");
    } catch {
      setStatus("目前無法取得餐廳，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel form-grid decision-form" aria-busy={isSubmitting} onSubmit={onSubmit}>
      <div className="decision-primary">
        <p className="decision-kicker">今天就吃這間</p>
        <button className="button decision-button" type="submit" disabled={!isReady || isSubmitting}>
          {isSubmitting ? "抽選中..." : "幫我選"}
        </button>
        <p className="decision-hint">直接隨機選擇，或展開條件縮小範圍。</p>
      </div>

      {status ? <p className="status" role="alert">{status}</p> : null}

      <details className="filter-disclosure">
        <summary>篩選條件</summary>
        <div className="filter-fields">
          <label className="field">
            <span>吃哪邊？</span>
            <select
              className="select"
              name="foodwhere_region"
              value={regionId}
              onChange={(event) => {
                setRegionId(Number(event.target.value));
                setSectionId(0);
              }}
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>地區或商圈</span>
            <select className="select" value={sectionId} onChange={(event) => setSectionId(Number(event.target.value))}>
              <option value={0}>全區</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label className="field">
              <span>吃多少？</span>
              <select className="select" name="foodmoney_min" defaultValue={preferences.foodmoney_min}>
                {moneyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id === 0 ? "0元" : option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>至</span>
              <select className="select" name="foodmoney_max" defaultValue={preferences.foodmoney_max}>
                {moneyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>吃哪種？</span>
            <select className="select" name="foodtype" defaultValue={preferences.foodtype}>
              {foodTypes.map((foodType) => (
                <option key={foodType.id} value={foodType.id}>
                  {foodType.label}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-row">
            <input name="remember" value="1" type="checkbox" defaultChecked={preferences.remember === 1} />
            記得我選的條件。
          </label>
        </div>
      </details>
    </form>
  );
}
