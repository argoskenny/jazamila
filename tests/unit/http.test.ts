import { describe, expect, it } from "vitest";
import { readRequestInput } from "@/lib/http";

describe("http helpers", () => {
  it("rejects request bodies larger than the configured limit before parsing", async () => {
    await expect(
      readRequestInput(
        new Request("https://example.test", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": "2048"
          },
          body: "{}"
        }),
        { maxBodyBytes: 1024 }
      )
    ).rejects.toThrow("Request body too large");
  });
});
