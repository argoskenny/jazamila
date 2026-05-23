import type { HomePreferences } from "@/lib/domain/types";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export const preferenceCookieNames = [
  "remember",
  "foodwhere_region",
  "foodwhere_section",
  "foodmoney_max",
  "foodmoney_min",
  "foodtype"
] as const;

export function defaultPreferences(): HomePreferences {
  return {
    remember: 0,
    foodwhere_region: 0,
    foodwhere_section: 0,
    foodmoney_max: 0,
    foodmoney_min: 0,
    foodtype: 0
  };
}

function toSafeInt(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function readHomePreferences(cookies: CookieReader): HomePreferences {
  const remember = toSafeInt(cookies.get("remember")?.value);

  if (remember !== 1) {
    return defaultPreferences();
  }

  return {
    remember,
    foodwhere_region: toSafeInt(cookies.get("foodwhere_region")?.value),
    foodwhere_section: toSafeInt(cookies.get("foodwhere_section")?.value),
    foodmoney_max: toSafeInt(cookies.get("foodmoney_max")?.value),
    foodmoney_min: toSafeInt(cookies.get("foodmoney_min")?.value),
    foodtype: toSafeInt(cookies.get("foodtype")?.value)
  };
}
