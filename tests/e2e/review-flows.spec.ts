import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasourceUrl: "file:./e2e.db" });
test.afterAll(async () => {
  await prisma.restaurant.deleteMany({ where: { name: { startsWith: "E2E Review" } } });
  await prisma.$disconnect();
});

test("restores keyword fields on back navigation and retains a search through another pick", async ({ page }) => {
  await page.goto("/listdata/0/0/0/0/1?search_keyword=Sushi");
  await page.getByRole("button", { name: "篩選", exact: true }).click();
  await page.getByLabel("關鍵字").fill("Burger");
  await page.getByRole("button", { name: "套用篩選" }).click();
  await expect(page).toHaveURL(/search_keyword=Burger/);
  await page.goBack();
  await expect(page).toHaveURL(/search_keyword=Sushi/);
  await expect(page.getByLabel("關鍵字")).toHaveValue("Sushi");
  await page.getByRole("link", { name: "Sushi House", exact: true }).click();
  await page.route("**/jazamila_ajax/pick", async (route) => {
    expect(route.request().postData()).toContain("Sushi");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", res_id: 1 }) });
  });
  await page.getByRole("button", { name: "再選一間" }).click();
  await expect(page).toHaveURL(/picked=1/);
  await page.getByRole("link", { name: "返回列表" }).click();
  await expect(page).toHaveURL(/search_keyword=Sushi/);
});

test("retains multiple cuisines when returning from a homepage pick", async ({ page }) => {
  await page.goto("/"); await page.getByText("篩選條件", { exact: true }).click();
  await page.locator("label.cuisine-tag", { hasText: "日式料理" }).click();
  await page.locator("label.cuisine-tag", { hasText: "美式料理" }).click();
  await page.getByRole("button", { name: "套用條件並抽選" }).click();
  await expect(page).toHaveURL(/detail\/\d+/);
  await page.getByRole("link", { name: "返回列表" }).click();
  await expect(page).toHaveURL(/ct=legacy/);
  await page.getByRole("button", { name: "篩選", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "日式料理", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "美式料理", exact: true })).toBeChecked();
});

test("uses a compact mobile menu and persists favorites, history and exclusions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect((await page.locator(".site-header").boundingBox())!.height).toBeLessThan(100);
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.getByRole("navigation", { name: "主要導覽" }).getByRole("link", { name: "餐廳列表" }).click();
  await page.getByRole("link", { name: "Sushi House", exact: true }).click();
  await page.locator(".detail-restaurant-panel").getByRole("button", { name: "收藏", exact: true }).click();
  await page.getByRole("button", { name: "暫時排除 24 小時" }).click();
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "收藏餐廳", exact: true }).locator("..").getByRole("link", { name: "Sushi House" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "暫時排除", exact: true }).locator("..").getByRole("link", { name: "Sushi House" })).toBeVisible();
  await page.goto("/detail/1?picked=1");
  await expect(page.getByRole("button", { name: "已收藏", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "回報資料有誤／已歇業" }).click();
  await expect(page.getByLabel("問題或建議 *", { exact: true })).toHaveValue(/Sushi House（ID 1）/);
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "最近抽選", exact: true }).locator("..").getByRole("link", { name: "Sushi House" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("creates and edits restaurant ranges without corrupting a phone, and preserves invalid input", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("帳號", { exact: true }).fill("e2e-admin");
  await page.getByLabel("密碼", { exact: true }).fill("e2e-only-password-2026");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/restaurants/new");
  await page.getByLabel("餐廳名稱", { exact: true }).fill("E2E Review range");
  await page.getByLabel("電話", { exact: true }).fill("0912345678");
  await page.getByLabel("價位顯示方式").selectOption("range");
  await page.getByLabel("每人最低價位").fill("200");
  await page.getByLabel("每人最高價位").fill("400");
  await page.getByRole("button", { name: "建立餐廳" }).click();
  await expect(page).toHaveURL(/\/admin\/restaurants\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split("/").pop());
  await expect(page.getByText("每人 200–400 元", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "編輯", exact: true }).click();
  await page.getByLabel("餐廳名稱", { exact: true }).fill("E2E Review " + "x".repeat(130));
  await page.getByRole("button", { name: "儲存變更" }).click();
  await expect(page.locator(".status[role=alert]")).toContainText("請修正以下欄位");
  await expect(page.getByLabel("電話", { exact: true })).toHaveValue("0912345678");
  await page.getByLabel("餐廳名稱", { exact: true }).fill("E2E Review renamed");
  await page.getByLabel("價位顯示方式").selectOption("single");
  await page.getByLabel("平均價位", { exact: true }).fill("900");
  await page.getByRole("button", { name: "儲存變更" }).click();
  await expect(page).toHaveURL(`/admin/restaurants/${id}`);
  await page.goto(`/detail/${id}`);
  await expect(page.getByRole("link", { name: "0912345678", exact: true })).toHaveAttribute("href", "tel:0912345678");
  await expect(page.getByText("900 元左右", { exact: true })).toBeVisible();
  await page.goto("/admin/restaurants");
  await page.getByLabel("名稱、電話、地址或 ID").fill("E2E Review renamed");
  await page.getByRole("button", { name: "搜尋餐廳" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
