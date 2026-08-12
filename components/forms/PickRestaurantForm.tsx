"use client";

import { useEffect, useMemo, useState } from "react";
import type { CuisineTypeOption, HomePreferences, Option } from "@/lib/domain/types";

type Props = {
  preferences: HomePreferences;
  regions: Option[];
  sectionsByRegion: Record<number, Option[]>;
  cuisineTypes: CuisineTypeOption[];
  moneyOptions: Option[];
};

export function PickRestaurantForm({ preferences, regions, sectionsByRegion, cuisineTypes, moneyOptions }: Props) {
  const [regionId, setRegionId] = useState(preferences.foodwhere_region);
  const [sectionId, setSectionId] = useState(preferences.foodwhere_section);
  const [selectedCuisineTypes, setSelectedCuisineTypes] = useState(() => {
    const saved = preferences.cuisineTypes ?? preferences.foodtypes.map((id) => `legacy:${id}`);
    return saved.filter((value) => cuisineTypes.some((cuisineType) => cuisineType.value === value));
  });
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
      form.set("cuisine_types", selectedCuisineTypes.join(","));
      form.set(
        "foodtype",
        selectedCuisineTypes
          .map((value) => cuisineTypes.find((cuisineType) => cuisineType.value === value)?.legacyFoodType)
          .filter((value): value is number => value != null)
          .join("-") || "0"
      );

      const response = await fetch("/jazamila_ajax/pick", {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        throw new Error(`Pick request failed with status ${response.status}`);
      }

      const data = (await response.json()) as { status: string; res_id: number };

      if (data.status === "success" && data.res_id > 0) {
        const location = regionId === 0 ? "0" : `${regionId}X${sectionId}`;
        const minPrice = Number(form.get("foodmoney_min") ?? 0);
        const maxPrice = Number(form.get("foodmoney_max") ?? 0);
        window.location.href = `/detail/${data.res_id}?ul=${encodeURIComponent(location)}&ut=0&uft=${selectedCuisineTypes
          .filter((value) => value.startsWith("legacy:"))
          .map((value) => value.slice("legacy:".length))
          .join("-")}&uct=${encodeURIComponent(selectedCuisineTypes.join(","))}&umx=${maxPrice}&umi=${minPrice}`;
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
      <input type="hidden" name="foodtype" value="0" />
      <input type="hidden" name="cuisine_types" value={selectedCuisineTypes.join(",")} />
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
                  checked={selectedCuisineTypes.length === 0}
                  onChange={() => setSelectedCuisineTypes([])}
                />
                <span>都可以</span>
              </label>
              {cuisineTypes.map((cuisineType) => (
                <label className="cuisine-tag" key={cuisineType.id}>
                  <input
                    type="checkbox"
                    checked={selectedCuisineTypes.includes(cuisineType.value)}
                    onChange={() => {
                      setSelectedCuisineTypes((current) =>
                        current.includes(cuisineType.value)
                          ? current.filter((value) => value !== cuisineType.value)
                          : [...current, cuisineType.value]
                      );
                    }}
                  />
                  <span>{cuisineType.label}</span>
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
