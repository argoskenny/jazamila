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
  const [selectedFoodTypes, setSelectedFoodTypes] = useState(() =>
    preferences.foodtypes.filter((id) => foodTypes.some((foodType) => foodType.id === id && id > 0))
  );
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
    <form className="form-grid decision-form" aria-busy={isSubmitting} onSubmit={onSubmit}>
      <input type="hidden" name="foodtype" value={selectedFoodTypes.join("-")} />
      <div className="decision-primary">
        <button className="button decision-button" type="submit" disabled={!isReady || isSubmitting}>
          {isSubmitting ? "抽選中..." : "幫我選"}
        </button>
        <p className="decision-hint">直接隨機選擇，或展開條件縮小範圍。</p>
      </div>

      {status ? <p className="status" role="alert">{status}</p> : null}

      <div className={`filter-disclosure${isFilterOpen ? " is-open" : ""}`}>
        <button
          className="filter-summary"
          type="button"
          aria-expanded={isFilterOpen}
          aria-controls="restaurant-filter-fields"
          onClick={() => setIsFilterOpen((current) => !current)}
        >
          篩選條件
        </button>
        <div
          className="filter-content"
          id="restaurant-filter-fields"
          aria-hidden={!isFilterOpen}
          inert={!isFilterOpen}
        >
          <div className="filter-fields">
          <fieldset className="filter-group">
            <legend>吃哪邊？</legend>
            <div className="form-row location-row">
              <label className="field">
                <select
                  className="select"
                  name="foodwhere_region"
                  aria-label="城市"
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
                <select
                  className="select"
                  aria-label="地區或商圈"
                  value={sectionId}
                  disabled={regionId === 0}
                  onChange={(event) => setSectionId(Number(event.target.value))}
                >
                  <option value={0}>全區</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

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

          <fieldset className="filter-group cuisine-filter">
            <legend>吃哪種？ <span>可複選</span></legend>
            <div className="cuisine-tags">
              <label className="cuisine-tag">
                <input
                  type="checkbox"
                  checked={selectedFoodTypes.length === 0}
                  onChange={() => setSelectedFoodTypes([])}
                />
                <span>都可以</span>
              </label>
              {foodTypes.filter((foodType) => foodType.id > 0).map((foodType) => (
                <label className="cuisine-tag" key={foodType.id}>
                  <input
                    type="checkbox"
                    checked={selectedFoodTypes.includes(foodType.id)}
                    onChange={() => {
                      setSelectedFoodTypes((current) =>
                        current.includes(foodType.id)
                          ? current.filter((id) => id !== foodType.id)
                          : [...current, foodType.id]
                      );
                    }}
                  />
                  <span>{foodType.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          </div>
        </div>
      </div>
    </form>
  );
}
