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

  it("rejects over-limit bodies even when content-length is absent", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content: "x".repeat(2048) })
    });

    await expect(readRequestInput(request, { maxBodyBytes: 1024 })).rejects.toThrow("Request body too large");
  });

  it("still parses form data after enforcing the byte limit", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ name: "JAZAMILA" })
    });

    await expect(readRequestInput(request, { maxBodyBytes: 1024 })).resolves.toMatchObject({ name: "JAZAMILA" });
  });
});
