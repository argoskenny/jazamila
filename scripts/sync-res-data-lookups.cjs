#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  buildLocationCatalog,
  loadDocuments,
  lookupDataFromCatalog,
} = require("./res-data-importer.cjs");

const ROOT = path.resolve(__dirname, "..");
const dataDir = path.join(ROOT, "docs", "res_data");
const lookupPath = path.join(ROOT, "lib", "domain", "lookup-data.json");
const shouldWrite = process.argv.includes("--write");

const current = JSON.parse(fs.readFileSync(lookupPath, "utf8"));
const loaded = loadDocuments(dataDir);
if (loaded.fileErrors.length > 0) {
  throw new Error(`Cannot build lookup data: ${JSON.stringify(loaded.fileErrors)}`);
}
const catalog = buildLocationCatalog(loaded.documents, current);
const next = lookupDataFromCatalog(catalog, current.foodTypes);
const serialized = `${JSON.stringify(next, null, 2)}\n`;
const matches = fs.readFileSync(lookupPath, "utf8") === serialized;

if (shouldWrite && !matches) fs.writeFileSync(lookupPath, serialized, "utf8");

console.log(JSON.stringify({
  mode: shouldWrite ? "write" : "check",
  matches: shouldWrite ? true : matches,
  changed: !matches,
  cities: next.regions.length - 1,
  districts: Object.values(next.sectionsByRegion).reduce((sum, sections) => sum + sections.length, 0),
  path: path.relative(ROOT, lookupPath),
}, null, 2));

if (!shouldWrite && !matches) process.exitCode = 1;
