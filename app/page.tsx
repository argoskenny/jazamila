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
        <h1>生活總有太多選擇</h1>
        <p>無法作出決定？別擔心，我可以幫你</p>
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
