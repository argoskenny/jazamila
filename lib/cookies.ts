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

export function parsePreferenceCuisineTypes(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^(legacy:\d+|code:[A-Za-z0-9_-]+)$/u.test(item))
  ));
}

export function readHomePreferences(cookies: CookieReader): HomePreferences {
  const preferences: HomePreferences = {
    foodwhere_region: toSafeInt(cookies.get("foodwhere_region")?.value),
    foodwhere_section: toSafeInt(cookies.get("foodwhere_section")?.value),
    foodmoney_max: toSafeInt(cookies.get("foodmoney_max")?.value),
    foodmoney_min: toSafeInt(cookies.get("foodmoney_min")?.value),
    foodtypes: parsePreferenceFoodTypes(cookies.get("foodtype")?.value)
  };
  const cuisineTypes = parsePreferenceCuisineTypes(cookies.get("cuisine_types")?.value);
  if (cuisineTypes.length > 0) preferences.cuisineTypes = cuisineTypes;
  return preferences;
}
