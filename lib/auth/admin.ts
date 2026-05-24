import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "jazamila_admin";
const sessionMaxAgeSeconds = 60 * 60 * 8;
const sessionMaxAgeMs = sessionMaxAgeSeconds * 1000;
const minProductionPasswordLength = 16;
const minProductionSecretLength = 32;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function requiredProductionEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (!isProduction()) return "";
  throw new Error(`${name} must be set in production`);
}

function adminUsername(): string {
  return requiredProductionEnv("ADMIN_USERNAME") || "admin";
}

function adminPassword(): string {
  const password = requiredProductionEnv("ADMIN_PASSWORD") || "password";
  if (isProduction()) {
    if (password === "password") throw new Error("ADMIN_PASSWORD must not use the development default");
    if (password.length < minProductionPasswordLength) {
      throw new Error(`ADMIN_PASSWORD must be at least ${minProductionPasswordLength} characters in production`);
    }
  }
  return password;
}

function secret(): string {
  const value = requiredProductionEnv("ADMIN_SESSION_SECRET") || "jazamila-local-development-secret";
  if (isProduction()) {
    if (value === "jazamila-local-development-secret") {
      throw new Error("ADMIN_SESSION_SECRET must not use the development default");
    }
    if (value.length < minProductionSecretLength) {
      throw new Error(`ADMIN_SESSION_SECRET must be at least ${minProductionSecretLength} characters in production`);
    }
  }
  return value;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = adminUsername();
  const expectedPassword = adminPassword();
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function createAdminToken(username: string, issuedAt = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ username, issuedAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined): { username: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      username?: string;
      issuedAt?: number;
    };
    if (!data.username || !data.issuedAt) return null;
    if (!Number.isFinite(data.issuedAt)) return null;
    if (data.issuedAt > Date.now() + 60 * 1000) return null;
    if (Date.now() - data.issuedAt > sessionMaxAgeMs) return null;
    return { username: data.username };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(cookieName)?.value);
}

export async function requireAdmin(): Promise<{ username: string }> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function setAdminSession(username: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, createAdminToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}
