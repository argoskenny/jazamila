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
  const listCount = page.locator(".list-header > .list-count");
  await expect(listCount).toHaveText(/共 [\d,]+ 間餐廳/);
  await expect(listCount).toHaveCSS("align-self", "flex-end");
  await expect(listCount).toHaveCSS("text-align", "right");
  await expect(page.locator(".restaurant-note")).toHaveCount(0);
  await expect(page.getByText(/料理與特色：/)).toHaveCount(0);
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
  await expect(restaurantCard.locator(".restaurant-classification p", { hasText: "價位：" })).toContainText("100 元左右");
  await expect(restaurantCard.locator(".restaurant-classification p", { hasText: "輔助標籤：" })).toHaveText("輔助標籤：無");
  await expect(page.getByText("查看詳細資料", { exact: true })).toHaveCount(0);
  await restaurantCard.click();
  await expect(page).toHaveURL(/\/detail\/1\?/);
  const detailPanel = page.locator(".detail-restaurant-panel");
  const restaurantNameLink = detailPanel.getByRole("link", { name: "Sushi House", exact: true });
  await expect(restaurantNameLink).toBeVisible();
  await expect(restaurantNameLink).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=Sushi%20House");
  await expect(restaurantNameLink).toHaveAttribute("target", "_blank");
  await expect(detailPanel.getByText("台北市・大同區", { exact: true })).toHaveCount(0);
  await expect(detailPanel.getByText("台北市大同區民生西路 100 號", { exact: true })).toBeVisible();
  await expect(detailPanel.getByText("電話：(02) 1234567", { exact: true })).toBeVisible();
  await expect(detailPanel.getByText("日式料理", { exact: true })).toBeVisible();
  await expect(detailPanel.getByText("100 元左右", { exact: true })).toBeVisible();
  await expect(detailPanel.locator(".tag")).toHaveCount(0);
  await expect(detailPanel.locator(".detail-restaurant-note")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "食記介紹" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sushi Blog" })).toHaveAttribute("href", "https://example.com/sushi");
  await expect(page.getByRole("heading", { name: "新增食記" })).toBeVisible();
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

test("preserves a keyword when returning from restaurant details", async ({ page }) => {
  await page.goto("/listdata/0/0/0/0/1?search_keyword=Sushi");

  await page.getByRole("link", { name: "Sushi House", exact: true }).click();
  await expect(page).toHaveURL(/\/detail\/1\?.*search_keyword=Sushi/);
  await page.getByRole("link", { name: "返回列表" }).click();

  await expect(page).toHaveURL("/listdata/0/0/0/0/1?search_keyword=Sushi");
  await expect(page.getByLabel("關鍵字")).toHaveValue("Sushi");
});

test("shows feedback success and clears the submitted fields", async ({ page }) => {
  await page.route("**/jazamila_ajax/save_feedback_post", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: "success" });
  });
  await page.goto("/about");

  await page.getByLabel("姓名 *", { exact: true }).fill("回饋測試");
  await page.getByLabel("電子郵件 *", { exact: true }).fill("feedback@example.com");
  await page.getByLabel("問題或建議 *", { exact: true }).fill("確認成功狀態與表單清空");
  await page.getByRole("button", { name: "確定送出" }).click();

  await expect(page.getByRole("status")).toHaveText("已送出你的問題或建議，感謝你。");
  await expect(page.getByLabel("姓名 *", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("電子郵件 *", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("問題或建議 *", { exact: true })).toHaveValue("");
});

test("does not pick the current restaurant again when no alternative matches", async ({ page }) => {
  await page.goto("/detail/3?ul=2X1&ut=0&uft=&uct=&umx=0&umi=0");
  await expect(page.getByRole("heading", { name: "Pasta Corner" })).toBeVisible();

  await page.getByRole("button", { name: "再選一間" }).click();

  await expect(page).toHaveURL(/\/detail\/3\?/);
  await expect(page.locator(".pick-again .status")).toHaveText("這組條件暫時沒有其他餐廳，可以放寬條件再試一次。");
});

test("uses route-specific social metadata and keeps admin pages out of search", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "http://127.0.0.1:3100/about");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "關於本站｜JAZAMILA");

  await page.goto("/listdata/0/0/0/0/1");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "http://127.0.0.1:3100/listdata/0/0/0/0/1");

  await page.goto("/admin/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
