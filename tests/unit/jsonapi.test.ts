import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/jsonapi/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("jsonapi", () => {
  it("uses the configured public app URL for restaurant image URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.jazamila.test/");

    const response = await GET();
    const data = (await response.json()) as Array<{ res_img_url: string }>;

    expect(data[0].res_img_url).toBe("https://www.jazamila.test/assets/pics/preview_1380970870.jpg");
    expect(data[0].res_img_url).not.toContain("http://jazamila.com");
  });
});
