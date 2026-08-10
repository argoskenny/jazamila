"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ListFilters, Option } from "@/lib/domain/types";

type Props = {
  filters: ListFilters;
  regions: Option[];
  sectionsByRegion: Record<number, Option[]>;
  foodTypes: Option[];
  moneyOptions: Option[];
};

export function RestaurantListFilter({ filters, regions, sectionsByRegion, foodTypes, moneyOptions }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [regionId, setRegionId] = useState(filters.regionId);
  const [sectionId, setSectionId] = useState(filters.sectionId);
  const [foodType, setFoodType] = useState(filters.foodType);
  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [keyword, setKeyword] = useState(filters.keyword);

  const sections = useMemo(() => sectionsByRegion[regionId] ?? [], [regionId, sectionsByRegion]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location = regionId === 0 ? "0" : `${regionId}X${sectionId}`;
    const query = keyword.trim() ? `?search_keyword=${encodeURIComponent(keyword.trim())}` : "";
    router.push(`/listdata/${location}/${foodType}/${maxPrice}/${minPrice}/1${query}`);
  }

  return (
    <div className={`filter-disclosure list-filter-disclosure${isOpen ? " is-open" : ""}`}>
      <button
        className="filter-summary"
        type="button"
        aria-label="篩選"
        aria-expanded={isOpen}
        aria-controls="list-filter-fields"
        onClick={() => setIsOpen((current) => !current)}
      >
        篩選
      </button>
      <div className="filter-content" id="list-filter-fields" aria-hidden={!isOpen} inert={!isOpen}>
        <form className="filter-fields" onSubmit={applyFilters}>
          <fieldset className="filter-group">
            <legend>吃哪邊？</legend>
            <div className="form-row location-row">
              <label className="field">
                <select
                  className="select"
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
              <select className="select" value={minPrice} onChange={(event) => setMinPrice(Number(event.target.value))}>
                {moneyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id === 0 ? "0元" : option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>至</span>
              <select className="select" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}>
                {moneyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="filter-group cuisine-filter">
            <legend>吃哪種？</legend>
            <div className="cuisine-tags">
              {foodTypes.map((option) => (
                <label className="cuisine-tag" key={option.id}>
                  <input
                    type="radio"
                    name="list-food-type"
                    checked={foodType === option.id}
                    onChange={() => setFoodType(option.id)}
                  />
                  <span>{option.id === 0 ? "都可以" : option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>關鍵字</span>
            <input
              className="input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="請輸入關鍵字"
            />
          </label>

          <button className="button" type="submit">
            套用篩選
          </button>
        </form>
      </div>
    </div>
  );
}
