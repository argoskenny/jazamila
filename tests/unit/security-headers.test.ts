import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("security headers", () => {
  it("applies baseline browser security headers to all routes", async () => {
    const headers = await nextConfig.headers?.();
    const allRoutes = headers?.find((entry) => entry.source === "/(.*)");

    expect(allRoutes?.headers).toEqual(
      expect.arrayContaining([
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" }
      ])
    );
    expect(allRoutes?.headers.find((header) => header.key === "Content-Security-Policy")?.value).toContain(
      "https://www.google.com/recaptcha/"
    );
  });
});
