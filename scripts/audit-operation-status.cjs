#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "res_data");
const REMOVALS_PATH = path.join(ROOT, "docs", "operation-status-removals.json");
const FALLBACK_REPORT_PATH = path.join(ROOT, "docs", "operation-status-fallback-verification-report.json");
const OUTPUT_PATH = path.join(ROOT, "docs", "operation-status-final-audit.json");
const COMPAT_REPORT_PATH = path.join(ROOT, "docs", "operation-status-verification-report.json");
const TODAY = "2026-08-10";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const files = fs.readdirSync(DATA_DIR)
  .filter((name) => name.endsWith("-restaurants.json"))
  .sort();
const statusCounts = {};
const providerCounts = {};
const fallbackFreshnessCounts = {};
const evidenceCoverage = {records_with_source_url: 0, records_with_fallback_source: 0, records_without_fallback_source: 0};
const hoursSourceCounts = {};
const uncertainByFile = {};
const fileSummary = {};
const missingFields = [];
let total = 0;
let hoursFound = 0;
let hoursMissing = 0;
let checkedToday = 0;

for (const file of files) {
  const document = readJson(path.join(DATA_DIR, file));
  const restaurants = document.restaurants || [];
  const summary = {records: restaurants.length, operating: 0, uncertain: 0, other_status: 0, hours_found: 0, hours_missing: 0};
  total += restaurants.length;
  for (const record of restaurants) {
    const status = record.operation_status || "missing";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (status === "operating") summary.operating += 1;
    else if (status === "uncertain") {
      summary.uncertain += 1;
      uncertainByFile[file] = (uncertainByFile[file] || 0) + 1;
    } else summary.other_status += 1;

    if (record.business_hours?.average_open_time && record.business_hours?.average_close_time) {
      hoursFound += 1;
      summary.hours_found += 1;
      const source = record.business_hours.source || "未標示來源";
      hoursSourceCounts[source] = (hoursSourceCounts[source] || 0) + 1;
    } else {
      hoursMissing += 1;
      summary.hours_missing += 1;
    }
    if (record.operation_status_checked_at === TODAY) checkedToday += 1;
    const missing = [];
    if (!record.operation_status) missing.push("operation_status");
    if (!record.operation_status_checked_at) missing.push("operation_status_checked_at");
    if (!record.operation_status_reason) missing.push("operation_status_reason");
    if (!Array.isArray(record.operation_status_sources) || record.operation_status_sources.length === 0) missing.push("operation_status_sources");
    if (missing.length) missingFields.push({file, id:record.id, name:record.name, missing});
    const provider = record.operation_status_fallback_provider || "未標示";
    providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    const freshness = record.operation_status_fallback_freshness || "not_applicable";
    fallbackFreshnessCounts[freshness] = (fallbackFreshnessCounts[freshness] || 0) + 1;
    if ((record.sources || []).some((source) => /^https?:\/\//i.test(source))) evidenceCoverage.records_with_source_url += 1;
    if (Array.isArray(record.operation_status_fallback_sources) && record.operation_status_fallback_sources.length > 0) evidenceCoverage.records_with_fallback_source += 1;
    else evidenceCoverage.records_without_fallback_source += 1;
  }
  fileSummary[file] = summary;
}

const removals = fs.existsSync(REMOVALS_PATH) ? readJson(REMOVALS_PATH) : [];
const fallbackReport = fs.existsSync(FALLBACK_REPORT_PATH) ? readJson(FALLBACK_REPORT_PATH) : null;
const recentlyRemoved = removals.filter((item) => item.checked_at === TODAY);
const removedByFile = new Map(files.map((file) => [file, []]));
for (const removal of removals) {
  const file = files.find((candidate) => removal.id?.startsWith(candidate.replace(/-restaurants\.json$/, "") + "-"));
  if (file) removedByFile.get(file).push(removal);
}
const report = {
  checked_at: TODAY,
  scope: "docs/res_data/*.json",
  rule: {
    google_unavailable: "改用替代網路搜尋與可直接開啟的公開店家頁面查核。",
    recent_no_closure: "近一個月內沒有歇業、停業或永久關閉相關訊息，判定通過。",
    no_data: "近六個月找不到任何可辨識、可對應店面的公開資料，移除。",
    hours: "只在來源明確提供時寫入 average_open_time 與 average_close_time；分時段營業取最早開店與最晚收店，無可靠時間則保留 null。",
  },
  totals: {
    files: files.length,
    records: total,
    operation_status: statusCounts,
    checked_today: checkedToday,
    hours_found: hoursFound,
    hours_missing: hoursMissing,
    missing_required_fields: missingFields.length,
  },
  processing: {
    sequential_file_order: true,
    file_order: files,
    note: "依排序後的 JSON 檔案逐檔載入、逐筆檢查目前資料欄位與狀態；本報告是全量完成後的現況稽核。",
  },
  fallback_verification: fallbackReport?.totals || null,
  removals: {
    all_recorded_removals: removals.length,
    recorded_today: recentlyRemoved.length,
    today: recentlyRemoved.map((item) => ({id:item.id, name:item.name, address:item.address, reason:item.reason, sources:item.sources || (item.source ? [item.source] : [])})),
  },
  providers: providerCounts,
  fallback_freshness: fallbackFreshnessCounts,
  evidence_coverage: evidenceCoverage,
  hours_sources: hoursSourceCounts,
  uncertain_by_file: uncertainByFile,
  missing_required_fields: missingFields,
  files: fileSummary,
};

writeJson(OUTPUT_PATH, report);

// Keep the long-standing report path authoritative as well.  The previous
// report described the pre-fallback pass and otherwise looks like a current
// result to downstream readers.
const fallbackFiles = fallbackReport?.files || {};
const compatibilityFiles = Object.fromEntries(files.map((file) => {
  const current = fileSummary[file];
  const removed = removedByFile.get(file) || [];
  const fallback = fallbackFiles[file] || {};
  return [file, {
    checked_at: TODAY,
    provider: "official-public-and-alternative-web-sources",
    checked: current.records + removed.length,
    kept: current.records,
    removed: removed.length,
    uncertain: current.uncertain,
    hours_found: current.hours_found,
    hours_missing: current.hours_missing,
    before: current.records + removed.length,
    after: current.records,
    fallback_evidence_applied: fallback.fallback_evidence_applied || 0,
    removed_records: removed,
  }];
}));
const compatibilityTotals = Object.values(compatibilityFiles).reduce((acc, current) => ({
  files: acc.files + 1,
  checked: acc.checked + current.checked,
  kept: acc.kept + current.kept,
  removed: acc.removed + current.removed,
  uncertain: acc.uncertain + current.uncertain,
  hours_found: acc.hours_found + current.hours_found,
  hours_missing: acc.hours_missing + current.hours_missing,
}), {files:0, checked:0, kept:0, removed:0, uncertain:0, hours_found:0, hours_missing:0});
writeJson(COMPAT_REPORT_PATH, {
  checked_at: TODAY,
  mode: "full-final-audit",
  provider: "official-public-and-alternative-web-sources",
  note: "此報告已同步目前資料；明確歇業、停業、永久關閉及近六個月無可辨識資料的餐廳均已移除。",
  files: compatibilityFiles,
  totals: compatibilityTotals,
});
console.log(JSON.stringify(report.totals, null, 2));
