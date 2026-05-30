type RateLimitOptions = {
  maxRequests: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  check: (key: string, now?: number) => RateLimitResult;
};

export function createRateLimiter({ maxRequests, windowMs }: RateLimitOptions): RateLimiter {
  const entries = new Map<string, RateLimitEntry>();

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const existing = entries.get(key);

      if (!existing || existing.resetAt <= now) {
        entries.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (existing.count >= maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
        };
      }

      existing.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
  };
}

export function getClientIp(source: Request | Headers): string {
  const headers = source instanceof Request ? source.headers : source;
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function rateLimitKey(scope: string, source: Request | Headers): string {
  return `${scope}:${getClientIp(source)}`;
}

export function rateLimitedJsonResponse(result: RateLimitResult): Response {
  return Response.json(
    { status: "fail", error: "rate_limited" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds)
      }
    }
  );
}

export function rateLimitedHtmlResponse(result: RateLimitResult): Response {
  return new Response("fail", {
    status: 429,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Retry-After": String(result.retryAfterSeconds)
    }
  });
}

export const adminLoginRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000
});

export const publicWriteRateLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000
});
