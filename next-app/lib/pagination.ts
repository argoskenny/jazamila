export type PaginationItem =
  | { type: "page"; page: number; active: boolean }
  | { type: "control"; label: string; page: number; disabled: boolean };

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, Math.max(totalPages, 1));
}

export function createPagination(page: number, totalPages: number): PaginationItem[] {
  const current = clampPage(page, totalPages);
  const last = Math.max(totalPages, 1);
  const items: PaginationItem[] = [
    { type: "control", label: "«", page: 1, disabled: current === 1 },
    { type: "control", label: "‹", page: Math.max(1, current - 1), disabled: current === 1 }
  ];

  for (let number = Math.max(1, current - 2); number <= Math.min(last, current + 2); number += 1) {
    items.push({ type: "page", page: number, active: number === current });
  }

  items.push(
    { type: "control", label: "›", page: Math.min(last, current + 1), disabled: current === last },
    { type: "control", label: "»", page: last, disabled: current === last }
  );

  return items;
}
