import { getRegions, getSections } from "@/lib/domain/sections";
import type { AuxiliaryTagOption, CuisineTypeOption, RestaurantView } from "@/lib/domain/types";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  restaurant?: RestaurantView;
  cuisineTypes: CuisineTypeOption[];
  auxiliaryTags: AuxiliaryTagOption[];
  submitLabel: string;
};

export function RestaurantForm({ action, restaurant, cuisineTypes, auxiliaryTags, submitLabel }: Props) {
  const regions = getRegions();
  const sectionRegion = restaurant?.res_region ?? 1;

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
        <select className="select" name="res_region" defaultValue={restaurant?.res_region ?? 1}>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>區域</span>
        <select className="select" name="res_section" defaultValue={restaurant?.res_section ?? 2}>
          {getSections(sectionRegion).map((section) => (
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
        <p className="field-help">可複選既有標籤；取消選取會隱藏關聯並保留追溯資料。</p>
        <div className="admin-tag-options">
          {auxiliaryTags.map((tag) => (
            <label key={tag.id} className="admin-tag-option">
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
