#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "docs", "res_data", "chiayi-city-xi-restaurants.json");
const REPORT_PATH = path.join(ROOT, "docs", "operation-status-verification-report.json");
const REMOVALS_PATH = path.join(ROOT, "docs", "operation-status-removals.json");
const TODAY = "2026-08-10";

const VERIFIED_REMOVALS = new Map([
  ["7746560", {
    reason: "Google 搜尋結果與愛食記頁面均標示該地址的好客燒烤嘉義秀泰店已歇業。",
    source: "https://ifoodie.com.tw/review/64b40519e94eda31e0b5e2d2",
  }],
  ["373707", {
    reason: "Google 搜尋店家資訊面板在相符地址標示「永久歇業」。",
    source: "https://www.google.com.tw/search?hl=zh-TW&gl=tw&q=%22%E8%80%81%E6%B4%8B%E6%88%BF1931%22+%22%E5%98%89%E7%BE%A9%E5%B8%82%E8%A5%BF%E5%8D%80%E6%B0%91%E7%94%9F%E5%8C%97%E8%B7%AF228%E8%99%9F%22+%E6%B0%B8%E4%B9%85%E6%AD%87%E6%A5%AD",
  }],
  ["773344", {
    reason: "Google 搜尋店家資訊面板在相符地址標示「永久歇業」。",
    source: "https://www.google.com.tw/search?hl=zh-TW&gl=tw&q=%22%E5%B0%8F%E8%92%99%E7%89%9B%E9%A0%82%E7%B4%9A%E9%BA%BB%E8%BE%A3%E9%A4%8A%E7%94%9F%E9%8D%8B%22+%22%E5%98%89%E7%BE%A9%E5%B8%82%E8%A5%BF%E5%8D%80%E5%8D%9A%E6%84%9B%E8%B7%AF%E4%BA%8C%E6%AE%B5461%E8%99%9F%22+%E6%B0%B8%E4%B9%85%E6%AD%87%E6%A5%AD",
  }],
]);

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const document = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const original = document.restaurants || [];
const removals = [];
const kept = original.filter((restaurant) => {
  const evidence = VERIFIED_REMOVALS.get(String(restaurant.source_id));
  if (!evidence) return true;
  removals.push({
    source_id: restaurant.source_id,
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    reason: evidence.reason,
    source: evidence.source,
    checked_at: TODAY,
    original: restaurant,
  });
  return false;
});

if (removals.length !== VERIFIED_REMOVALS.size) {
  throw new Error(`預期移除 ${VERIFIED_REMOVALS.size} 筆，實際找到 ${removals.length} 筆；停止寫入。`);
}

document.collection = {
  ...(document.collection || {}),
  operation_status_provider: "Google 搜尋（少量可疑案例）與官方資料、公開店家頁面",
  record_count_before_operation_check: original.length,
  record_count_after_operation_check: kept.length,
};
document.restaurants = kept;
writeJson(DATA_PATH, document);

const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
const fileStats = report.files["chiayi-city-xi-restaurants.json"];
if (!fileStats) throw new Error("報告中找不到 chiayi-city-xi-restaurants.json");
fileStats.provider = "google-search-plus-official-and-public-pages";
fileStats.removed = (fileStats.removed || 0) + removals.length;
fileStats.kept = kept.length;
fileStats.after = kept.length;
fileStats.hours_found = kept.filter((restaurant) => restaurant.business_hours?.average_open_time).length;
fileStats.hours_missing = kept.length - fileStats.hours_found;
fileStats.removed_records = [...(fileStats.removed_records || []), ...removals];
report.totals = Object.values(report.files).reduce((totals, value) => ({
  files: totals.files + 1,
  checked: totals.checked + value.checked,
  kept: totals.kept + value.kept,
  removed: totals.removed + value.removed,
  uncertain: totals.uncertain + value.uncertain,
  hours_found: totals.hours_found + value.hours_found,
  hours_missing: totals.hours_missing + value.hours_missing,
}), { files: 0, checked: 0, kept: 0, removed: 0, uncertain: 0, hours_found: 0, hours_missing: 0 });
writeJson(REPORT_PATH, report);

const existingRemovals = JSON.parse(fs.readFileSync(REMOVALS_PATH, "utf8"));
const existingIds = new Set(existingRemovals.map((item) => `${item.source_id}:${item.id}`));
writeJson(REMOVALS_PATH, [
  ...existingRemovals,
  ...removals.filter((item) => !existingIds.has(`${item.source_id}:${item.id}`)),
]);

console.log(JSON.stringify({ file: path.basename(DATA_PATH), removed: removals.map((item) => ({ id: item.id, name: item.name })), after: kept.length }));
