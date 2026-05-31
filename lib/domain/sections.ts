import lookupData from "@/lib/domain/lookup-data.json";
import type { Option } from "@/lib/domain/types";

type LookupData = {
  regions: Option[];
  sectionsByRegion: Record<string, Option[]>;
  foodTypes: Option[];
};

const data = lookupData as LookupData;

export const regions: Option[] = data.regions;

export const sectionsByRegion: Record<number, Option[]> = Object.fromEntries(
  Object.entries(data.sectionsByRegion).map(([regionId, sections]) => [Number(regionId), sections])
);

export const foodTypes: Option[] = data.foodTypes;

export const moneyOptions: Option[] = Array.from({ length: 12 }, (_, index) => {
  const value = index * 100;
  if (value === 0) return { id: value, label: "都可以" };
  if (value === 1100) return { id: value, label: "1000元以上" };
  return { id: value, label: `${value}元左右` };
});

export function getRegions(): Option[] {
  return regions;
}

export function getSections(regionId: number): Option[] {
  return sectionsByRegion[regionId] ?? [];
}

export function getFoodTypes(): Option[] {
  return foodTypes;
}

export function labelFor(options: Option[], id: number, fallback = "未分類"): string {
  return options.find((option) => option.id === id)?.label ?? fallback;
}

export function renderSectionOptions(regionId: number, selectedId = 0): string {
  return getSections(regionId)
    .map((section) => {
      const selected = section.id === selectedId ? ' selected="selected"' : "";
      return `<option value="${section.id}"${selected}>${section.label}</option>`;
    })
    .join("");
}

export function renderListSectionLinks(regionId: number): string {
  const allLink = `<li><a href="javascript:void(0);" onclick="section_click('0','全區');">全區</a></li>`;
  const sectionLinks = getSections(regionId)
    .map(
      (section) =>
        `<li><a href="javascript:void(0);" onclick="section_click('${section.id}','${section.label}');">${section.label}</a></li>`
    )
    .join("");

  return allLink + sectionLinks;
}
