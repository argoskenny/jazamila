import { describe, expect, it } from "vitest";
import { POST } from "@/app/jazamila_ajax/pick/route";

describe("restaurant pick route", () => {
  it("keeps the legacy response while excluding the current and recent restaurants", async () => {
    const request = new Request("http://localhost/jazamila_ajax/pick", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "recent_restaurants=1-2"
      },
      body: new URLSearchParams({
        foodwhere_region: "0",
        foodwhere_section: "0",
        foodmoney_max: "0",
        foodmoney_min: "0",
        foodtype: "0",
        exclude_restaurant_id: "4"
      })
    });

    const response = await POST(request);
    const data = (await response.json()) as { status: string; res_id: number };

    expect(response.status).toBe(200);
    expect(data.status).toBe("success");
    expect(data.res_id).toBeGreaterThan(0);
    expect([1, 2, 4]).not.toContain(data.res_id);
    expect(response.headers.get("set-cookie")).toContain("recent_restaurants=");
  });
});
