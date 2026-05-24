import { foodTypes, getRegions, getSections } from "@/lib/domain/sections";
import type { RestaurantView } from "@/lib/domain/types";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  restaurant?: RestaurantView;
  submitLabel: string;
};

export function RestaurantForm({ action, restaurant, submitLabel }: Props) {
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
        <span>美食類型</span>
        <select className="select" name="res_foodtype" defaultValue={restaurant?.res_foodtype ?? 1}>
          {foodTypes.map((foodType) => (
            <option key={foodType.id} value={foodType.id}>
              {foodType.label}
            </option>
          ))}
        </select>
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
        <span>備註</span>
        <textarea className="textarea" name="res_note" defaultValue={restaurant?.res_note} />
      </label>
      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
