"use client";

import { useMemo, useState } from "react";
import { regions, getSections } from "@/lib/domain/sections";
import type { AuxiliaryTagOption, CuisineTypeOption, RestaurantView } from "@/lib/domain/types";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  restaurant?: RestaurantView;
  cuisineTypes: CuisineTypeOption[];
  auxiliaryTags: AuxiliaryTagOption[];
  submitLabel: string;
};

const defaultVisibleTagCount = 40;

function normalizeTagSearch(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("zh-TW");
}

export function RestaurantForm({ action, restaurant, cuisineTypes, auxiliaryTags, submitLabel }: Props) {
  const initialRegionId = restaurant?.res_region ?? 1;
  const initialSections = getSections(initialRegionId);
  const requestedInitialSectionId = restaurant?.res_section ?? 2;
  const initialSectionId = initialSections.some((section) => section.id === requestedInitialSectionId)
    ? requestedInitialSectionId
    : initialSections[0]?.id ?? 0;
  const [regionId, setRegionId] = useState(initialRegionId);
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [tagQuery, setTagQuery] = useState("");
  const sections = getSections(regionId);
  const visibleTagIds = useMemo(() => {
    const normalizedQuery = normalizeTagSearch(tagQuery);
    if (normalizedQuery) {
      return new Set(
        auxiliaryTags
          .filter((tag) => normalizeTagSearch(tag.name).includes(normalizedQuery))
          .map((tag) => tag.id)
      );
    }

    const selectedTagIds = new Set(restaurant?.auxiliaryTagIds ?? []);
    const visibleIds = auxiliaryTags
      .filter((tag) => selectedTagIds.has(tag.id))
      .map((tag) => tag.id);
    for (const tag of auxiliaryTags) {
      if (visibleIds.length >= defaultVisibleTagCount || selectedTagIds.has(tag.id)) continue;
      visibleIds.push(tag.id);
    }
    return new Set(visibleIds);
  }, [auxiliaryTags, restaurant?.auxiliaryTagIds, tagQuery]);

  function handleRegionChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextRegionId = Number(event.target.value);
    const nextSections = getSections(nextRegionId);
    setRegionId(nextRegionId);
    setSectionId(nextSections[0]?.id ?? 0);
  }

  return (
    <form className="panel form-grid" action={action}>
      {restaurant ? <input type="hidden" name="id" value={restaurant.id} /> : null}
      <label className="field">
        <span>餐廳名稱</span>
        <input className="input" name="res_name" defaultValue={restaurant?.res_name} required />
      </label>
      <label className="field">
        <span>電話區碼</span>
        <input className="input" name="res_area_num" defaultValue={restaurant?.res_area_num ?? "02"} inputMode="numeric" />
      </label>
      <label className="field">
        <span>電話</span>
        <input className="input" name="res_tel_num" defaultValue={restaurant?.res_tel_num} inputMode="numeric" />
      </label>
      <label className="field">
        <span>縣市</span>
        <select className="select" name="res_region" value={regionId} onChange={handleRegionChange}>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>區域</span>
        <select
          className="select"
          name="res_section"
          value={sectionId}
          onChange={(event) => setSectionId(Number(event.target.value))}
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>地址</span>
        <input className="input" name="res_address" defaultValue={restaurant?.res_address} />
      </label>
      <label className="field">
        <span>料理類型</span>
        <input type="hidden" name="res_foodtype" value={restaurant?.res_foodtype ?? 0} />
        <select className="select" name="cuisine_type_id" defaultValue={restaurant?.cuisineTypeId ?? 0}>
          <option value={0} disabled>請選擇料理類型</option>
          {cuisineTypes.map((cuisineType) => (
            <option key={cuisineType.id} value={cuisineType.id}>
              {cuisineType.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field admin-tag-fieldset">
        <legend>公開輔助標籤</legend>
        <p className="field-help">可複選既有標籤；預設顯示最多 {defaultVisibleTagCount} 項，輸入關鍵字可搜尋全部標籤。</p>
        <input
          className="input"
          type="search"
          value={tagQuery}
          onChange={(event) => setTagQuery(event.target.value)}
          placeholder="搜尋輔助標籤"
          aria-label="搜尋輔助標籤"
        />
        {tagQuery && visibleTagIds.size === 0 ? <p className="field-help">找不到符合的標籤。</p> : null}
        <div className="admin-tag-options">
          {auxiliaryTags.map((tag) => (
            <label key={tag.id} className="admin-tag-option" hidden={!visibleTagIds.has(tag.id)}>
              <input
                type="checkbox"
                name="auxiliary_tag_ids"
                value={tag.id}
                defaultChecked={restaurant?.auxiliaryTagIds.includes(tag.id)}
              />
              <span>{tag.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>建立新的輔助標籤</span>
        <input className="input" name="new_auxiliary_tags" placeholder="以逗號分隔，例如：適合聚餐、可外帶" />
      </label>
      <label className="field">
        <span>平均價位</span>
        <input className="input" name="res_price" type="number" min={0} defaultValue={restaurant?.res_price ?? 100} inputMode="numeric" />
      </label>
      <label className="field">
        <span>圖片檔名</span>
        <input className="input" name="res_img_url" defaultValue={restaurant?.res_img_url ?? "preview_1380970870.jpg"} />
      </label>
      <label className="field">
        <span>餐廳狀態</span>
        <select className="select" name="res_close" defaultValue={restaurant?.res_close ?? 0}>
          <option value={0}>公開</option>
          <option value={1}>關閉</option>
        </select>
      </label>
      <label className="field">
        <span>備註</span>
        <textarea className="textarea" name="res_note" defaultValue={restaurant?.res_note} />
      </label>
      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
