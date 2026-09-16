import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createRestaurantWithAuxiliaryTags, updateRestaurantWithAuxiliaryTags, restaurantFromAdminForm, listRestaurants, parseListFilters } from "@/lib/domain/restaurants";
import { buildListPath, filterCuisineTokens, priceRangeError } from "@/lib/domain/list-filters";
import { listRestaurantsForAdmin } from "@/lib/domain/admin";
import { approvePost, rejectPost } from "@/lib/domain/posts";
import { POST } from "@/app/jazamila_ajax/pick/route";

const ids: number[] = [], posts: number[] = [];
afterEach(async () => {
  await prisma.restaurant.deleteMany({ where: { id: { in: ids.splice(0) } } });
  await prisma.post.deleteMany({ where: { id: { in: posts.splice(0) } } });
});
async function row(data: Parameters<typeof prisma.restaurant.create>[0]["data"]) {
  const result = await prisma.restaurant.create({ data }); ids.push(result.id); return result;
}
function pick(body: Record<string, string>, cookie = "") {
  return POST(new Request("http://localhost/jazamila_ajax/pick", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: new URLSearchParams(body) }));
}
describe("review regression cases", () => {
  it("updates legacy price and photo consistently while preserving an unchanged range", async () => {
    const r = await row({ name: "review-data", price: 300, priceMin: 200, priceMax: 400, externalImageUrl: "https://example.com/old.jpg" });
    const same = await updateRestaurantWithAuxiliaryTags(r.id, { res_price: 300 }, [], []);
    expect(same?.priceLabel).toBe("每人 200–400 元");
    const changed = await updateRestaurantWithAuxiliaryTags(r.id, { res_price: 900, res_img_url: "new.jpg" }, [], []);
    expect(changed).toMatchObject({ priceLabel: "每人約 900 元", imagePath: "/assets/pics/new.jpg" });
    expect((await listRestaurants(parseListFilters(["0", "0", "400", "0", "1"], { search_keyword: "review-data" }))).totalRows).toBe(0);
  });
  it("accepts explicit ranges and external photos, then permits switching back to a single price", async () => {
    const created = await createRestaurantWithAuxiliaryTags(restaurantFromAdminForm({ res_name: "review-range", price_mode: "range", res_price_min: 200, res_price_max: 600, external_image_url: "https://example.com/new.jpg" }), [], []);
    ids.push(created.id);
    expect(created).toMatchObject({ res_price: 400, priceLabel: "每人 200–600 元", imagePath: "https://example.com/new.jpg" });
    const edited = await updateRestaurantWithAuxiliaryTags(created.id, restaurantFromAdminForm({ res_name: "review-range", price_mode: "single", res_price: 800, image_source: "local", res_img_url: "local.jpg" }), [], []);
    expect(edited).toMatchObject({ res_price: 800, res_price_min: null, res_price_max: null, priceLabel: "800 元左右", imagePath: "/assets/pics/local.jpg" });
  });
  it("preserves mobile numbers when an unrelated field is saved", async () => {
    const r = await row({ name: "mobile", areaNum: null, telNum: "0912345678", phone: "0912 345 678" });
    const result = await updateRestaurantWithAuxiliaryTags(r.id, restaurantFromAdminForm({ res_name: "renamed", res_area_num: "", res_tel_num: r.telNum }), [], []);
    expect(result?.phoneHref).toBe("tel:0912345678");
    expect(restaurantFromAdminForm({ res_name: "intl", res_tel_num: "+886912345678" }).res_area_num).toBe("");
  });
  it("preserves manual content across rejection and reapproval", async () => {
    const post = await prisma.post.create({ data: { name: "submission", region: 1, section: 2, foodType: 1 } }); posts.push(post.id);
    await approvePost(post.id);
    const r = await prisma.restaurant.findFirstOrThrow({ where: { postId: post.id } }); ids.push(r.id);
    await updateRestaurantWithAuxiliaryTags(r.id, { res_name: "corrected", res_price: 900 }, [], []);
    await rejectPost(post.id); await approvePost(post.id);
    expect(await prisma.restaurant.findUnique({ where: { id: r.id } })).toMatchObject({ name: "corrected", price: 900, closed: 0 });
  });
  it("round-trips multiple cuisines, keyword, sort and page in a list return path", () => {
    const filters = { ...parseListFilters(["1X2", "0", "900", "100", "3"]), cuisineTokens: ["legacy:1", "code:cafe"], keyword: "咖啡 館", sort: "rating" };
    const url = new URL(buildListPath(filters, 3), "http://localhost");
    const restored = parseListFilters(url.pathname.split("/").slice(2), Object.fromEntries(url.searchParams));
    expect(restored).toMatchObject({ keyword: "咖啡 館", sort: "rating", page: 3, minPrice: 100, maxPrice: 900 });
    expect(filterCuisineTokens(restored)).toEqual(filters.cuisineTokens);
  });
  it("does not reuse a stored cuisine when the current request explicitly clears it", async () => {
    const r = await row({ name: "review-pick-only", foodType: 1 });
    const response = await pick({ reuse_preferences: "1", cuisine_types: "", foodtype: "1", search_keyword: r.name }, "cuisine_types=code%3Acafe");
    expect(await response.json()).toEqual({ status: "success", res_id: r.id });
  });
  it("ignores obsolete personal exclusions and falls back when all matches were recently picked", async () => {
    const r = await row({ name: "review-exclude" });
    const response = await pick({ foodtype: "0", search_keyword: r.name }, `excluded_restaurants=${r.id}@${Date.now() + 60000}; recent_restaurants=${r.id}`);
    expect(await response.json()).toEqual({ status: "success", res_id: r.id });
  });
  it("rejects a reversed budget and accepts an unbounded maximum", async () => {
    expect(priceRangeError(900, 200)).not.toBe("");
    expect(priceRangeError(1000, 0)).toBe("");
    expect(priceRangeError(1000, 1100)).toBe("");
    expect((await pick({ foodmoney_min: "900", foodmoney_max: "200" })).status).toBe(422);
    expect(() => restaurantFromAdminForm({ res_name: "bad-range", res_price_min: 900, res_price_max: 100 })).toThrow();
  });
  it("keeps existing rounded prices and phone formatting on an unrelated edit", async () => {
    const r = await row({ name: "review-no-op", price: 400, priceMin: 200, priceMax: 500, areaNum: null, telNum: "0912345678", phone: "0912 345 678" });
    const input = restaurantFromAdminForm({ res_name: "review-no-op renamed", res_price_min: 200, res_price_max: 500, res_area_num: "", res_tel_num: "0912345678" });
    await updateRestaurantWithAuxiliaryTags(r.id, input, [], []);
    const saved = await prisma.restaurant.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved.price).toBe(400);
    expect(saved.phone).toBe("0912 345 678");
    expect(JSON.parse(saved.manualOverrideFields ?? "[]")).not.toContain("price");
  });
  it("supports one-sided restaurant prices and normalizes legacy unlimited URL values", async () => {
    await row({ name: "review-open-range", priceMin: 200, priceMax: null });
    expect((await listRestaurants(parseListFilters(["0", "0", "500", "0", "1"], { search_keyword: "review-open-range" }))).totalRows).toBe(1);
    expect((await listRestaurants(parseListFilters(["0", "0", "100", "0", "1"], { search_keyword: "review-open-range" }))).totalRows).toBe(0);
    expect(parseListFilters(["0", "0", "1100", "1100", "1"])).toMatchObject({ maxPrice: 0, minPrice: 1000 });
  });
  it("sorts matching restaurants and supports admin filters", async () => {
    const a = await row({ name: "review-sort a", price: 200, ratingScore: 4, ratingReviewCount: 100, region: 1, closed: 0 });
    const b = await row({ name: "review-sort b", price: 800, ratingScore: 5, ratingReviewCount: 20, region: 1, closed: 0 });
    const filters = { ...parseListFilters(), keyword: "review-sort" };
    expect((await listRestaurants({ ...filters, sort: "rating" })).restaurants.map((r) => r.id)).toEqual([b.id, a.id]);
    expect((await listRestaurants({ ...filters, sort: "reviews" })).restaurants.map((r) => r.id)).toEqual([a.id, b.id]);
    expect((await listRestaurantsForAdmin({ keyword: "review-sort", closed: 0, region: 1 })).totalRows).toBe(2);
    expect((await listRestaurantsForAdmin({ keyword: "review-sort", closed: 1 })).totalRows).toBe(0);
  });
});
