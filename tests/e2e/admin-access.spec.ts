import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/admin",
  "/admin/restaurants",
  "/admin/restaurants/1",
  "/admin/restaurants/1/edit",
  "/admin/restaurants/new",
  "/admin/blogs",
  "/admin/posts",
  "/admin/feedback",
  "/admin/cuisine-candidates",
  "/admin/res_list/1",
  "/admin/res_detail/1",
  "/admin/res_edit/1"
];

test("redirects unauthenticated visitors from admin pages to a usable login page", async ({ page }) => {
  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL("/admin/login");
    await expect(page.getByRole("button", { name: "登入", exact: true })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  }
});

test("rejects an invalid admin session cookie", async ({ page, context }) => {
  await context.addCookies([{ name: "jazamila_admin", value: "invalid-session", url: "http://127.0.0.1:3100" }]);
  await page.goto("/admin/restaurants/1/edit");
  await expect(page).toHaveURL("/admin/login");
  await expect(page.getByRole("button", { name: "登入", exact: true })).toBeVisible();
});
