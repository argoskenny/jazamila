#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function main(argv = process.argv.slice(2)) {
  const directory = path.resolve(argv[0] || "");
  const output = path.resolve(argv[1] || path.join(directory, "sha256-manifest.json"));
  if (!fs.statSync(directory).isDirectory()) throw new Error("artifact directory is required");
  const files = walk(directory).filter((file) => file !== output).sort();
  const manifest = {
    manifestVersion: "sha256-artifact-manifest-v1",
    generatedAt: new Date().toISOString(),
    root: directory,
    files: files.map((file) => ({
      path: path.relative(directory, file),
      bytes: fs.statSync(file).size,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    })),
  };
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ output, files: manifest.files.length }, null, 2)}\n`);
}

if (require.main === module) main(process.argv.slice(2));
