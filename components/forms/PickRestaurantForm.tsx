"use client";

import { useMemo, useState } from "react";
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

  const sections = useMemo(() => sectionsByRegion[regionId] ?? [], [regionId, sectionsByRegion]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const form = new FormData(event.currentTarget);
    form.set("foodwhere_section", String(sectionId));
    form.set("remember", form.get("remember") === "1" ? "1" : "0");

    const response = await fetch("/jazamila_ajax/pick", {
      method: "POST",
      body: form
    });
    const data = (await response.json()) as { status: string; res_id: number };

    if (data.status === "success" && data.res_id > 0) {
      window.location.href = `/detail/${data.res_id}`;
      return;
    }

    setStatus("找不到餐廳耶...也許你該換個條件試試？");
    setIsSubmitting(false);
  }

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>吃什麼？</h2>
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

      <div className="actions">
        <button className="button" type="submit" disabled={isSubmitting}>
          吃什麼？
        </button>
        <a className="button ghost" href="/listdata/0/0/0/0/1">
          看全部
        </a>
      </div>
      {status ? <p className="status">{status}</p> : null}
    </form>
  );
}
