import { cookies } from "next/headers";
import { PickRestaurantForm } from "@/components/forms/PickRestaurantForm";
import { readHomePreferences } from "@/lib/cookies";
import { foodTypes, getRegions, moneyOptions, sectionsByRegion } from "@/lib/domain/sections";

export default async function HomePage() {
  const cookieStore = await cookies();
  const preferences = readHomePreferences(cookieStore);

  return (
    <section className="page-shell hero-grid">
      <div className="hero-copy">
        <h1>JAZAMILA</h1>
        <p>
          選擇生活，選擇今天別再把午餐想成一場會議。條件填一填，剩下交給站長當年留下來的精神。
        </p>
      </div>
      <PickRestaurantForm
        preferences={preferences}
        regions={getRegions()}
        sectionsByRegion={sectionsByRegion}
        foodTypes={foodTypes}
        moneyOptions={moneyOptions}
      />
    </section>
  );
}
