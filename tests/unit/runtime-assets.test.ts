import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { linkRuntimeAssets } = require("../../scripts/link-runtime-assets.cjs") as {
  linkRuntimeAssets: (input: { releaseRoot: string; sharedAssetsRoot: string }) => Array<{
    directory: string;
    target: string;
  }>;
};

describe("runtime asset linker", () => {
  it("preserves release assets and links every runtime directory to shared storage", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "jazamila-assets-"));
    const releaseRoot = path.join(root, "release");
    const sharedAssetsRoot = path.join(root, "shared", "assets");

    try {
      for (const directory of ["pics", "post", "tmp"]) {
        fs.mkdirSync(path.join(releaseRoot, "public", "assets", directory), { recursive: true });
      }
      fs.writeFileSync(path.join(releaseRoot, "public", "assets", "post", "default.jpg"), "seed");

      const linked = linkRuntimeAssets({ releaseRoot, sharedAssetsRoot });

      expect(linked.map((entry) => entry.directory)).toEqual(["pics", "post", "tmp"]);
      expect(fs.readFileSync(path.join(sharedAssetsRoot, "post", "default.jpg"), "utf8")).toBe("seed");
      for (const directory of ["pics", "post", "tmp"]) {
        const source = path.join(releaseRoot, "public", "assets", directory);
        expect(fs.lstatSync(source).isSymbolicLink()).toBe(true);
        expect(fs.realpathSync(source)).toBe(fs.realpathSync(path.join(sharedAssetsRoot, directory)));
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
