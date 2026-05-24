import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminToken, verifyAdminCredentials, verifyAdminToken } from "@/lib/auth/admin";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin auth", () => {
  it("keeps local development fallback credentials", () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(verifyAdminCredentials("admin", "password")).toBe(true);
    expect(verifyAdminCredentials("admin", "wrong")).toBe(false);
  });

  it("rejects missing production admin credentials instead of using defaults", () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => verifyAdminCredentials("admin", "password")).toThrow("ADMIN_USERNAME");
  });

  it("rejects weak production session secrets", () => {
    vi.stubEnv("ADMIN_USERNAME", "owner");
    vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
    vi.stubEnv("ADMIN_SESSION_SECRET", "short");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => createAdminToken("owner")).toThrow("ADMIN_SESSION_SECRET");
  });

  it("rejects weak production admin passwords", () => {
    vi.stubEnv("ADMIN_USERNAME", "owner");
    vi.stubEnv("ADMIN_PASSWORD", "password");
    vi.stubEnv("ADMIN_SESSION_SECRET", "abcdefghijklmnopqrstuvwxyz123456");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => verifyAdminCredentials("owner", "password")).toThrow("ADMIN_PASSWORD");
  });

  it("expires admin tokens after the configured session lifetime", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "local-test-secret");
    vi.stubEnv("NODE_ENV", "development");

    const issuedAt = Date.now() - 9 * 60 * 60 * 1000;
    const token = createAdminToken("admin", issuedAt);

    expect(verifyAdminToken(token)).toBeNull();
  });
});
