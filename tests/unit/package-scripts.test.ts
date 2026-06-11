import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("package scripts", () => {
  it("defines lint and e2e verification gates", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(pkg.scripts.lint).toBeTruthy();
    expect(pkg.scripts.e2e).toBeTruthy();
    expect(pkg.devDependencies?.playwright).toBeTruthy();
  });
});
