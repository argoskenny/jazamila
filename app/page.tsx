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
        <div className="hero-heading">
          <h1>等一下吃什麼？</h1>
          <p>不用再想了，交給 JAZAMILA 幫你選一間。</p>
        </div>
        <PickRestaurantForm
          preferences={preferences}
          regions={getRegions()}
          sectionsByRegion={sectionsByRegion}
          foodTypes={foodTypes}
          moneyOptions={moneyOptions}
        />
      </div>
    </section>
  );
}
