#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "res_data");
const EVIDENCE_PATH = path.join(ROOT, "docs", "operation-status-web-fallback-evidence.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s*cite[^]*\s*/gu, "\n")
    .replace(/\s*\[wordlim[^\]]*\]\s*/giu, " ")
    .replace(/\bturn\d+(?:search|fetch|view|reddit)\d+\b/giu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

let filesUpdated = 0;
let fieldsUpdated = 0;
for (const file of fs.readdirSync(DATA_DIR).filter((name) => name.endsWith("-restaurants.json"))) {
  const filePath = path.join(DATA_DIR, file);
  const document = readJson(filePath);
  let changed = false;
  for (const record of document.restaurants || []) {
    for (const field of ["store_status_check", "operation_status_fallback_search_excerpt"]) {
      if (typeof record[field] !== "string" || !/(?:cite|\[wordlim|\bturn\d+(?:search|fetch|view|reddit)\d+\b)/u.test(record[field])) continue;
      record[field] = cleanText(record[field]);
      changed = true;
      fieldsUpdated += 1;
    }
  }
  if (changed) {
    writeJson(filePath, document);
    filesUpdated += 1;
  }
}

if (fs.existsSync(EVIDENCE_PATH)) {
  const evidenceDocument = readJson(EVIDENCE_PATH);
  for (const item of evidenceDocument.evidence || []) {
    if (typeof item.source_excerpt === "string") item.source_excerpt = cleanText(item.source_excerpt);
  }
  writeJson(EVIDENCE_PATH, evidenceDocument);
}

console.log(JSON.stringify({files_updated:filesUpdated, fields_updated:fieldsUpdated}));
