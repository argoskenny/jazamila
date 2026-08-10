import { expect, test as base } from "@playwright/test";

const test = base.extend<{ browserErrorGate: void }>({
  browserErrorGate: [async ({ page }, use) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
        browserErrors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("response", (response) => {
      if (response.url().startsWith("http://127.0.0.1:3100/") && response.status() >= 400) {
        browserErrors.push(`http ${response.status()}: ${response.url()}`);
      }
    });
    page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText ?? "unknown";
      if (request.url().startsWith("http://127.0.0.1:3100/") && errorText !== "net::ERR_ABORTED") {
        browserErrors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
      }
    });

    await use();

    expect(browserErrors, "public pages must not emit console or page errors").toEqual([]);
  }, { auto: true }]
});

test("loads the public decision and list pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "等一下吃什麼？" })).toBeVisible();
  await expect(page.getByRole("button", { name: "幫我選" })).toBeVisible();
  await expect(page.getByRole("link", { name: "看全部" })).toHaveCount(0);

  const filters = page.getByText("篩選條件", { exact: true });
  await expect(page.getByLabel("城市")).not.toBeVisible();
  await filters.click();
  await expect(page.getByLabel("城市")).toBeVisible();
  await expect(page.getByLabel("地區或商圈")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "日式料理" })).toBeVisible();

  await page.goto("/listdata/0/0/0/0/1");
  await expect(page.getByRole("heading", { name: "餐廳列表" })).toBeVisible();
  await expect(page.getByText("所有的餐廳", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "篩選", exact: true }).click();
  await expect(page.getByLabel("城市")).toBeVisible();
  await page.locator("label.cuisine-tag", { hasText: "日式料理" }).click();
  await page.getByRole("button", { name: "套用篩選" }).click();
  await expect(page).toHaveURL(/\/listdata\/0\/1\/0\/0\/1$/);
  const restaurantCard = page.getByRole("link", { name: "Sushi House", exact: true });
  await expect(restaurantCard).toBeVisible();
  await expect(restaurantCard.locator(".restaurant-address")).toContainText("台北市大同區民生西路 100 號");
  await expect(restaurantCard.getByText("日式料理", { exact: true })).toBeVisible();
  await expect(restaurantCard.getByText("100 元左右", { exact: true })).toBeVisible();
  await expect(page.getByText("查看詳細資料", { exact: true })).toHaveCount(0);
  await restaurantCard.click();
  await expect(page).toHaveURL(/\/detail\/1\?/);
  const detailPanel = page.locator(".detail-restaurant-panel");
  await expect(detailPanel.getByRole("heading", { name: "Sushi House", exact: true })).toBeVisible();
  await expect(detailPanel.getByText("台北市大同區民生西路 100 號", { exact: true })).toBeVisible();
  await expect(detailPanel.getByText("電話：(02) 1234567", { exact: true })).toBeVisible();
  await expect(detailPanel.getByText("日式料理", { exact: true })).toBeVisible();
  await expect(detailPanel.getByText("100 元左右", { exact: true })).toBeVisible();
  await expect(detailPanel.locator(".tag")).toHaveCount(0);
});

test("supports multiple cuisine tags and saves filters automatically", async ({ page, context }) => {
  await page.goto("/");
  await page.getByText("篩選條件", { exact: true }).click();

  await page.locator("label.cuisine-tag", { hasText: "日式料理" }).click();
  await page.locator("label.cuisine-tag", { hasText: "美式料理" }).click();
  await expect(page.getByRole("checkbox", { name: "日式料理" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "美式料理" })).toBeChecked();

  await page.getByRole("button", { name: "幫我選" }).click();
  await expect(page).toHaveURL(/\/detail\/\d+(?:\?.*)?$/);

  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "foodtype")?.value).toBe("1-2");
});

test("picks a restaurant from the homepage", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "幫我選" }).click();

  await expect(page).toHaveURL(/\/detail\/\d+(?:\?.*)?$/);
  await expect(page.locator("main h1")).toBeVisible();
});
