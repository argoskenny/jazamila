"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAdminSession, setAdminSession, verifyAdminCredentials } from "@/lib/auth/admin";
import { adminLoginRateLimiter, rateLimitKey } from "@/lib/rate-limit";

export async function loginAction(formData: FormData) {
  const requestHeaders = await headers();
  const rateLimit = adminLoginRateLimiter.check(rateLimitKey("admin-login", requestHeaders));
  if (!rateLimit.allowed) {
    redirect("/admin/login?error=rate_limit");
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!verifyAdminCredentials(username, password)) {
    redirect("/admin/login?error=1");
  }

  await setAdminSession(username);
  redirect("/admin");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
