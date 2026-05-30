import { describe, expect, it } from "vitest";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

describe("rate limit", () => {
  it("blocks a key after the allowed attempts until the window resets", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

    expect(limiter.check("client-a", 0)).toMatchObject({ allowed: true });
    expect(limiter.check("client-a", 100)).toMatchObject({ allowed: true });
    expect(limiter.check("client-a", 200)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 1
    });
    expect(limiter.check("client-a", 1001)).toMatchObject({ allowed: true });
  });

  it("prefers forwarded client IP headers over the fallback", () => {
    const request = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.2",
        "x-real-ip": "198.51.100.8"
      }
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });
});
