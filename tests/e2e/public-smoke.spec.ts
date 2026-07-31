import { expect, test } from "@playwright/test";

test("loads the public decision and list pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "等一下吃什麼？" })).toBeVisible();
  await expect(page.getByRole("button", { name: "幫我選" })).toBeVisible();
  await expect(page.getByRole("link", { name: "看全部" })).toHaveCount(0);

  const filters = page.getByText("篩選條件", { exact: true });
  await expect(page.getByLabel("吃哪邊？")).not.toBeVisible();
  await filters.click();
  await expect(page.getByLabel("吃哪邊？")).toBeVisible();

  await page.goto("/listdata/0/0/0/0/1");
  await expect(page.getByRole("heading", { name: "餐廳列表" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sushi House" })).toBeVisible();
});

test("picks a restaurant from the homepage", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "幫我選" }).click();

  await expect(page).toHaveURL(/\/detail\/\d+$/);
  await expect(page.locator("main h1")).toBeVisible();
});
