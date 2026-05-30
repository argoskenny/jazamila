import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyRecaptcha } from "@/lib/recaptcha";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("recaptcha verification", () => {
  it("accepts a valid token with the expected action and score", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "secret");
    vi.stubEnv("RECAPTCHA_MIN_SCORE", "0.5");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jazamila.thelonesomeera.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          score: 0.9,
          action: "feedback",
          hostname: "jazamila.thelonesomeera.com"
        })
      )
    );

    await expect(verifyRecaptcha({ token: "token", expectedAction: "feedback" })).resolves.toEqual({
      ok: true
    });
  });

  it("rejects tokens with a mismatched action", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          score: 0.9,
          action: "blog_save",
          hostname: "jazamila.thelonesomeera.com"
        })
      )
    );

    await expect(verifyRecaptcha({ token: "token", expectedAction: "feedback" })).resolves.toMatchObject({
      ok: false,
      reason: "action"
    });
  });

  it("requires a secret in production", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");

    await expect(verifyRecaptcha({ token: "token", expectedAction: "feedback" })).rejects.toThrow(
      "RECAPTCHA_SECRET_KEY"
    );
  });
});
