import { expect, test } from "@playwright/test";

test("loads the public decision and list pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "生活總有太多選擇" })).toBeVisible();
  await expect(page.getByRole("button", { name: "吃什麼？" })).toBeVisible();

  await page.goto("/listdata/0/0/0/0/1");
  await expect(page.getByRole("heading", { name: "餐廳列表" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sushi House" })).toBeVisible();
});
