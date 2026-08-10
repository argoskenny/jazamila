"use client";

import { useState } from "react";

type Props = {
  currentRestaurantId: number;
  location?: string;
  foodType?: number;
  foodTypes?: number[];
  minPrice?: number;
  maxPrice?: number;
};

export function PickAgainButton({ currentRestaurantId, location = "0", foodType = 0, foodTypes = [], minPrice = 0, maxPrice = 0 }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function pickAgain() {
    setIsSubmitting(true);
    setStatus("");

    try {
      const [regionId = "0", sectionId = "0"] = location === "0" ? ["0", "0"] : location.split("X");
      const form = new FormData();
      form.set("reuse_preferences", "1");
      form.set("exclude_restaurant_id", String(currentRestaurantId));
      form.set("foodwhere_region", regionId);
      form.set("foodwhere_section", sectionId);
      form.set("foodmoney_min", String(minPrice));
      form.set("foodmoney_max", String(maxPrice));
      form.set("foodtype", foodTypes.length > 0 ? foodTypes.join("-") : foodType > 0 ? String(foodType) : "0");

      const response = await fetch("/jazamila_ajax/pick", { method: "POST", body: form });
      if (!response.ok) throw new Error(`Pick request failed with status ${response.status}`);

      const data = (await response.json()) as { status: string; res_id: number };
      if (data.status === "success" && data.res_id > 0) {
        window.location.href = `/detail/${data.res_id}?ul=${encodeURIComponent(location)}&ut=${foodType}&uft=${foodTypes.join("-")}&umx=${maxPrice}&umi=${minPrice}`;
        return;
      }
      setStatus("這組條件暫時沒有其他餐廳，可以放寬條件再試一次。");
    } catch {
      setStatus("目前無法重新抽選，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pick-again">
      <button className="button" type="button" disabled={isSubmitting} onClick={pickAgain}>
        {isSubmitting ? "抽選中..." : "再選一間"}
      </button>
      {status ? <p className="status" role="alert">{status}</p> : null}
    </div>
  );
}
