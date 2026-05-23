import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMeetUser } from "@/lib/domain/meet";
import type { MeetUser } from "@/lib/domain/types";

const cookieName = "jazamila_meet";

function secret(): string {
  return process.env.MEET_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "jazamila-local-meet-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createMeetToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyMeetToken(token: string | undefined): { userId: number } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: number;
      issuedAt?: number;
    };
    if (!data.userId || !data.issuedAt) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

export async function setMeetSession(userId: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, createMeetToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearMeetSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getMeetSession(): Promise<MeetUser | null> {
  const cookieStore = await cookies();
  const token = verifyMeetToken(cookieStore.get(cookieName)?.value);
  if (!token) return null;
  return getMeetUser(token.userId);
}

export async function requireMeetUser(): Promise<MeetUser> {
  const user = await getMeetSession();
  if (!user) redirect("/meet/login");
  return user;
}
