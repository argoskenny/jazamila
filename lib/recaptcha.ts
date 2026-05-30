import "server-only";

import { getClientIp } from "@/lib/rate-limit";

type RecaptchaVerifyInput = {
  token: string;
  expectedAction: string;
  remoteIp?: string;
};

type RecaptchaApiResponse = {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export type RecaptchaResult = {
  ok: boolean;
  reason?: "missing-token" | "google" | "score" | "action" | "hostname";
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function minScore(): number {
  const value = Number.parseFloat(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
  return Number.isFinite(value) ? value : 0.5;
}

function allowedHostnames(): string[] {
  const configured = process.env.RECAPTCHA_ALLOWED_HOSTNAMES?.split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  if (configured?.length) return configured;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return [];

  try {
    return [new URL(appUrl).hostname];
  } catch {
    return [];
  }
}

export async function verifyRecaptcha({
  token,
  expectedAction,
  remoteIp
}: RecaptchaVerifyInput): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();

  if (!secret) {
    if (isProduction()) throw new Error("RECAPTCHA_SECRET_KEY must be set in production");
    return { ok: true };
  }

  if (!token) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({
    secret,
    response: token
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = (await response.json()) as RecaptchaApiResponse;

  if (!data.success) return { ok: false, reason: "google" };
  if (typeof data.score === "number" && data.score < minScore()) return { ok: false, reason: "score" };
  if (data.action && data.action !== expectedAction) return { ok: false, reason: "action" };

  const hostnames = allowedHostnames();
  if (hostnames.length && data.hostname && !hostnames.includes(data.hostname)) {
    return { ok: false, reason: "hostname" };
  }

  return { ok: true };
}

export async function verifyRequestRecaptcha(
  request: Request,
  input: Record<string, FormDataEntryValue | string>,
  expectedAction: string
): Promise<RecaptchaResult> {
  return verifyRecaptcha({
    token: String(input.recaptcha_token ?? ""),
    expectedAction,
    remoteIp: getClientIp(request)
  });
}
