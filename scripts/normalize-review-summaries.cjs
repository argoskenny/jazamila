#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { reviewSummaryToArray } = require("./review-summary-utils.cjs");

const DATA_DIR = path.resolve(__dirname, "../docs/res_data");
const SHOULD_WRITE = process.argv.includes("--write");

function main() {
  const files = fs.readdirSync(DATA_DIR)
    .filter((file) => file.endsWith("-restaurants.json"))
    .sort();
  const stats = {
    files: files.length,
    records: 0,
    changed: 0,
    arrays: 0,
    remaining_wrappers: 0,
    remaining_ellipsis: 0,
    remaining_multiline: 0,
    examples: [],
  };

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
    let fileChanged = false;
    for (const restaurant of document.restaurants || []) {
      stats.records += 1;
      if (!restaurant.online_rating || !Object.prototype.hasOwnProperty.call(restaurant.online_rating, "review_summary")) continue;
      const current = restaurant.online_rating.review_summary;
      const normalized = reviewSummaryToArray(current);
      const changed = !Array.isArray(current) || JSON.stringify(current) !== JSON.stringify(normalized);
      if (changed) {
        if (stats.examples.length < 5) stats.examples.push({ file, name: restaurant.name, before: current, after: normalized });
        restaurant.online_rating.review_summary = normalized;
        fileChanged = true;
        stats.changed += 1;
      }
      if (Array.isArray(restaurant.online_rating.review_summary)) stats.arrays += 1;
      const joined = restaurant.online_rating.review_summary.join("；");
      if (/公開食記整理顯示|以上為來源頁面的公開摘要整理，未包含完整評論全文。|原始公開摘要在此處截斷，未包含完整評論全文。/u.test(joined)) stats.remaining_wrappers += 1;
      if (/(?:\.{2,}|…+)/u.test(joined)) stats.remaining_ellipsis += 1;
      if (/[\r\n]/u.test(joined)) stats.remaining_multiline += 1;
    }
    if (fileChanged && SHOULD_WRITE) {
      fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    }
  }

  stats.mode = SHOULD_WRITE ? "write" : "dry-run";
  console.log(JSON.stringify(stats, null, 2));
}

main();
