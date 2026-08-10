#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "res_data");

for (const file of fs.readdirSync(DATA_DIR).filter((name) => name.endsWith("-restaurants.json")).sort()) {
  const filePath = path.join(DATA_DIR, file);
  const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!document.collection || !Array.isArray(document.restaurants)) continue;
  document.collection.record_count = document.restaurants.length;
  if (document.collection.operation_status_checked_at) {
    document.collection.record_count_after_operation_check = document.restaurants.length;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({ updated: fs.readdirSync(DATA_DIR).filter((name) => name.endsWith("-restaurants.json")).length }));
