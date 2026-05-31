import { describe, expect, it } from "vitest";
import { blogLinkSchema } from "@/lib/validation/forms";

describe("form validation", () => {
  it("accepts http and https blog links", () => {
    expect(
      blogLinkSchema.safeParse({
        res_id: 1,
        res_blogname: "食記",
        res_bloglink: "https://example.com/post"
      }).success
    ).toBe(true);

    expect(
      blogLinkSchema.safeParse({
        res_id: 1,
        res_blogname: "食記",
        res_bloglink: "http://example.com/post"
      }).success
    ).toBe(true);
  });

  it("rejects executable or inline-data blog link schemes", () => {
    for (const res_bloglink of ["javascript:alert(1)", "data:text/html,hello"]) {
      expect(
        blogLinkSchema.safeParse({
          res_id: 1,
          res_blogname: "食記",
          res_bloglink
        }).success
      ).toBe(false);
    }
  });
});
