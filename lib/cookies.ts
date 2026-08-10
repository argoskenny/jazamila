import type { HomePreferences } from "@/lib/domain/types";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function defaultPreferences(): HomePreferences {
  return {
    foodwhere_region: 0,
    foodwhere_section: 0,
    foodmoney_max: 0,
    foodmoney_min: 0,
    foodtypes: []
  };
}

function toSafeInt(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parsePreferenceFoodTypes(value: string | undefined): number[] {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(/[^0-9]+/)
        .map((item) => toSafeInt(item))
        .filter((item) => item > 0)
    )
  );
}

export function readHomePreferences(cookies: CookieReader): HomePreferences {
  return {
    foodwhere_region: toSafeInt(cookies.get("foodwhere_region")?.value),
    foodwhere_section: toSafeInt(cookies.get("foodwhere_section")?.value),
    foodmoney_max: toSafeInt(cookies.get("foodmoney_max")?.value),
    foodmoney_min: toSafeInt(cookies.get("foodmoney_min")?.value),
    foodtypes: parsePreferenceFoodTypes(cookies.get("foodtype")?.value)
  };
}
