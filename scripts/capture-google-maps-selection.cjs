#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const basePath = process.argv[2];
const storageKey = process.argv[3] || "codex.google.cards.shulin";
const cityName = process.argv[4] || "新北市";
const districtName = process.argv[5] || "樹林區";
const selectionCount = process.argv[6] || "100";
const outputPath = process.argv[7] || "/private/tmp/jazamila-google-shulin-selection.json";
const cliPath = "/Users/strongbuy/.codex/skills/playwright/scripts/playwright_cli.sh";
const session = process.env.PLAYWRIGHT_SESSION || "restaurant-maps";
const preparePath = path.join(__dirname, "prepare-google-maps-selection.cjs");

if (!basePath) throw new Error("Usage: capture-google-maps-selection.cjs <base-json> [storage-key] [city] [district] [count] [output]");

const cards = spawnSync(cliPath, [`-s=${session}`, "--raw", "eval", `JSON.parse(localStorage.getItem('${storageKey}'))`], { encoding: "utf8" });
if (cards.status !== 0) process.exit(cards.status || 1);
const prepared = spawnSync(process.execPath, [preparePath, basePath, cityName, districtName, selectionCount], {
  input: cards.stdout,
  encoding: "utf8",
});
if (prepared.status !== 0) {
  process.stderr.write(prepared.stderr || "Selection preparation failed\n");
  process.exit(prepared.status || 1);
}
fs.writeFileSync(outputPath, prepared.stdout, "utf8");
const selection = JSON.parse(prepared.stdout);
console.log(`selected ${selection.cards.length} Google Maps candidates -> ${outputPath}`);
