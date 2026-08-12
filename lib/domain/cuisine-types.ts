import catalog from "@/lib/domain/cuisine-types.json";
import type { CuisineTypeOption } from "@/lib/domain/types";

export type CuisineTypeStatus = "active" | "candidate" | "disabled";

export type CuisineTypeCatalogEntry = {
  code: string;
  name: string;
  normalizedName: string;
  status: CuisineTypeStatus;
  createdBy: "seed" | "ai" | "manual";
  legacyFoodType: number | null;
};

export type CuisineTypeRecord = CuisineTypeCatalogEntry & {
  id: number;
};

export const cuisineTypeCatalog = catalog.cuisineTypes as CuisineTypeCatalogEntry[];

export const legacyFoodTypeToCuisineCode: Readonly<Record<number, string>> = Object.fromEntries(
  cuisineTypeCatalog
    .filter((cuisineType) => cuisineType.legacyFoodType !== null)
    .map((cuisineType) => [cuisineType.legacyFoodType as number, cuisineType.code])
);

export function cuisineTypeCodeForLegacyFoodType(foodType: number): string | null {
  return legacyFoodTypeToCuisineCode[foodType] ?? null;
}

export function cuisineTypeForLegacyFoodType(foodType: number): CuisineTypeCatalogEntry | null {
  const code = cuisineTypeCodeForLegacyFoodType(foodType);
  return cuisineTypeCatalog.find((cuisineType) => cuisineType.code === code) ?? null;
}

export function cuisineTypeTokenFor(type: Pick<CuisineTypeRecord, "code" | "legacyFoodType">): string {
  return type.legacyFoodType === null ? `code:${type.code}` : `legacy:${type.legacyFoodType}`;
}

export function parseCuisineTypeToken(value: string): { kind: "legacy"; legacyFoodType: number } | { kind: "code"; code: string } | null {
  const token = String(value ?? "").trim();
  if (token.startsWith("legacy:")) {
    const legacyFoodType = Number.parseInt(token.slice("legacy:".length), 10);
    return Number.isInteger(legacyFoodType) && legacyFoodType > 0 ? { kind: "legacy", legacyFoodType } : null;
  }
  if (token.startsWith("code:")) {
    const code = token.slice("code:".length).trim();
    return code ? { kind: "code", code } : null;
  }
  return null;
}

export function normalizeCuisineTypeQueryTokens(value: string): string[] {
  return Array.from(new Set(
    String(value ?? "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => token.startsWith("legacy:") || token.startsWith("code:") ? token : `code:${token}`)
      .filter((token) => parseCuisineTypeToken(token) !== null)
  ));
}

export function listSegmentForCuisineTypeTokens(tokens: readonly string[]): string | null {
  if (tokens.length !== 1) return null;
  const token = tokens[0];
  if (token.startsWith("legacy:")) return token.slice("legacy:".length) || null;
  if (token.startsWith("code:")) return `c:${encodeURIComponent(token.slice("code:".length))}`;
  return null;
}

export function cuisineTypeOptionFor(type: CuisineTypeRecord): CuisineTypeOption {
  return {
    id: type.id,
    label: type.name,
    name: type.name,
    code: type.code,
    normalizedName: type.normalizedName,
    status: type.status,
    createdBy: type.createdBy,
    legacyFoodType: type.legacyFoodType,
    value: cuisineTypeTokenFor(type),
  };
}

export function getPublicCuisineTypes(
  types: readonly CuisineTypeCatalogEntry[] = cuisineTypeCatalog
): CuisineTypeCatalogEntry[] {
  return types.filter((cuisineType) => cuisineType.status === "active");
}
