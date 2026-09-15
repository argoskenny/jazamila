import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createPageFetcher, estimatePriceRange, mapWithConcurrency } = require("../../scripts/fonfood-utils.cjs") as {
  createPageFetcher: (options: { cacheDir: string; requestDelayMs: number }) => (url: string) => Promise<string>;
  estimatePriceRange: (values: number[], cuisineTypes: string[], intro: string) => { min: number; max: number };
  mapWithConcurrency: <T, R>(items: T[], worker: (item: T, index: number) => Promise<R>, concurrency: number) => Promise<R[]>;
};

afterEach(() => vi.unstubAllGlobals());

it("reuses cached HTML across fetcher instances without another request", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-fonfood-test-"));
  const fetch = vi.fn().mockResolvedValue(new Response("<h1>餐廳</h1>"));
  vi.stubGlobal("fetch", fetch);
  try {
    const options = { cacheDir, requestDelayMs: 0 };
    await expect(createPageFetcher(options)("https://example.test/store/42")).resolves.toBe("<h1>餐廳</h1>");
    await expect(createPageFetcher(options)("https://example.test/store/42")).resolves.toBe("<h1>餐廳</h1>");
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

it("retries a failed HTTP response and only caches successful HTML", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-fonfood-retry-"));
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    .mockResolvedValueOnce(new Response("recovered"));
  vi.stubGlobal("fetch", fetch);
  try {
    const fetchPage = createPageFetcher({ cacheDir, requestDelayMs: 0 });
    await expect(fetchPage("https://example.test/store/42")).resolves.toBe("recovered");
    await expect(fetchPage("https://example.test/store/42")).resolves.toBe("recovered");
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

it("bounds concurrent work and preserves input order when requests finish out of order", async () => {
  let active = 0;
  let peak = 0;
  const completed: number[] = [];
  const result = await mapWithConcurrency([30, 1, 1, 1], async (delay, index) => {
    active += 1;
    peak = Math.max(peak, active);
    await sleep(delay);
    active -= 1;
    completed.push(index);
    return `restaurant-${index}`;
  }, 2);
  expect(peak).toBe(2);
  expect(completed[0]).toBe(1);
  expect(result).toEqual(["restaurant-0", "restaurant-1", "restaurant-2", "restaurant-3"]);
  await expect(mapWithConcurrency([], async () => "unused", 2)).resolves.toEqual([]);
});

it("prefers menu prices and retains cuisine-based estimates when prices are unavailable", () => {
  expect(estimatePriceRange([10, 80, 250], ["吃到飽"], "")).toMatchObject({ min: 80, max: 250 });
  expect(estimatePriceRange([10, 20], [], "")).toMatchObject({ min: 10, max: 20 });
  expect(estimatePriceRange([], ["吃到飽"], "")).toMatchObject({ min: 400, max: 1500 });
  expect(estimatePriceRange([], ["小吃"], "")).toMatchObject({ min: 80, max: 400 });
});
