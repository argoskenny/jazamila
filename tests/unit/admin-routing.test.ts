import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

describe("admin routing", () => {
  it("centralizes protected admin pages under a guarded route group", () => {
    const appAdmin = path.join(process.cwd(), "app/admin");
    const protectedLayout = path.join(appAdmin, "(protected)/layout.tsx");

    expect(fs.existsSync(path.join(appAdmin, "login/page.tsx"))).toBe(true);
    expect(fs.existsSync(protectedLayout)).toBe(true);
    expect(fs.readFileSync(protectedLayout, "utf8")).toContain("requireAdmin");

    const ungroupedPages = walk(appAdmin)
      .filter((file) => file.endsWith("page.tsx"))
      .filter((file) => !file.includes(`${path.sep}(protected)${path.sep}`))
      .map((file) => path.relative(appAdmin, file));

    expect(ungroupedPages).toEqual(["login/page.tsx"]);
  });

  it("does not duplicate requireAdmin calls in protected page components", () => {
    const protectedDir = path.join(process.cwd(), "app/admin/(protected)");
    const protectedPages = walk(protectedDir).filter((file) => file.endsWith("page.tsx"));

    for (const file of protectedPages) {
      expect(fs.readFileSync(file, "utf8"), path.relative(process.cwd(), file)).not.toContain("requireAdmin");
    }
  });
});
