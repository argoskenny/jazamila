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
    expect(pkg.scripts.e2e).toContain("e2e:release");
    expect(pkg.scripts["e2e:prepare"]).toContain("e2e.db");
    expect(pkg.scripts["e2e:prepare"]).toContain("prisma db push --skip-generate");
    expect(pkg.scripts["e2e:prepare"]).toContain("node prisma/seed.cjs");
    expect(pkg.scripts["e2e:release"]).toContain("npm run build");
    expect(pkg.scripts["db:import:res-data:dry"]).toContain("--dry-run");
    expect(pkg.scripts["db:import:res-data"]).toBeTruthy();
    expect(pkg.scripts["db:check:res-data-lookups"]).toBeTruthy();
    expect(pkg.devDependencies?.playwright).toBeTruthy();
  });
});
