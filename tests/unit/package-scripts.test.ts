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
    expect(pkg.scripts["db:classify:cuisine:dry"]).toContain("--dry-run");
    expect(pkg.scripts["db:classify:cuisine:unverified:dry"]).toContain("classify-cuisine-unverified-backup");
    expect(pkg.scripts["db:classify:cuisine:ai:dry"]).toContain("--dry-run");
    expect(pkg.scripts["db:classify:cuisine:ai:run"]).toContain("run-cuisine-ai-classification");
    expect(pkg.scripts["db:classify:cuisine:web:dry"]).toContain("--dry-run");
    expect(pkg.scripts["db:classify:cuisine:web:run"]).toContain("run-cuisine-web-research");
    expect(pkg.scripts["db:classify:cuisine:codex:prepare"]).toContain("prepare-cuisine-codex-batch");
    expect(pkg.scripts["db:classify:cuisine:codex:validate"]).toContain("validate-cuisine-codex-output");
    expect(pkg.scripts["db:seed:cuisine:dry"]).toContain("--dry-run");
    expect(pkg.scripts["db:export:cuisine-types"]).toContain("export-cuisine-types");
    expect(pkg.scripts["db:classify:cuisine:candidates:dry"]).toContain("review-cuisine-type-candidates");
    expect(pkg.scripts["db:classify:cuisine:audit:dry"]).toContain("audit-cuisine-conversion");
    expect(pkg.scripts["db:classify:cuisine:apply:dry"]).toContain("apply-cuisine-classification");
    expect(pkg.scripts["db:classify:cuisine:cleanup:dry"]).toContain("cleanup-cuisine-tags");
    expect(pkg.scripts["db:classify:cuisine:target:audit"]).toContain("audit-cuisine-target");
    expect(pkg.scripts["db:check:res-data-lookups"]).toBeTruthy();
    expect(pkg.devDependencies?.playwright).toBeTruthy();
  });
});
