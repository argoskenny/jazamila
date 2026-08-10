#!/usr/bin/env node

/*
 * Apply the curated alternative-web-search evidence to the records that
 * remained uncertain after the first operation-status pass.
 *
 * This script deliberately treats a blocked search as unavailable evidence;
 * only a curated no_data_confirmed result removes a restaurant.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "res_data");
const EVIDENCE_PATH = path.join(ROOT, "docs", "operation-status-web-fallback-evidence.json");
const REPORT_PATH = path.join(ROOT, "docs", "operation-status-fallback-verification-report.json");
const REMOVALS_PATH = path.join(ROOT, "docs", "operation-status-removals.json");
const TODAY = "2026-08-10";
const RULE = "若 Google 搜尋不可用，改用替代網路搜尋；近一個月無歇業相關訊息則通過；近六個月找不到任何可辨識公開資料則移除。";
const FRESHNESS_ALLOWED = new Set(["within_1_month", "within_6_months"]);
const CLOSED_PATTERN = /(永久歇業|永久關閉|已歇業|停業中|停止營業|暫停營業|暫時關閉|已搬遷|已不存在)/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function evidenceSources(evidence) {
  return unique(evidence.source_urls || [evidence.source_url]);
}

function isStrongClosure(evidence) {
  return Boolean(evidence.closure && CLOSED_PATTERN.test(String(evidence.closure)));
}

function canKeep(evidence) {
  if (!evidence || evidence.no_data_confirmed || isStrongClosure(evidence)) return false;
  return evidence.evidence_kind === "direct-page"
    || (Number(evidence.match_score) >= 5 && FRESHNESS_ALLOWED.has(evidence.freshness));
}

function applyHours(record, evidence) {
  if (!evidence.hours) return;
  record.business_hours = {
    ...(record.business_hours || {}),
    average_open_time: evidence.hours.average_open_time ?? null,
    average_close_time: evidence.hours.average_close_time ?? null,
    display: evidence.hours.display ?? null,
    source: evidence.hours.source ?? null,
    open_days_considered: evidence.hours.open_days_considered ?? 0,
    note: evidence.note || "依替代網路搜尋取得的公開營業時間整理；分時段營業取最早開店與最晚收店時間。",
  };
}

function markOperating(record, evidence) {
  const sources = evidenceSources(evidence);
  const isDirect = evidence.evidence_kind === "direct-page";
  const freshnessText = evidence.freshness === "within_1_month"
    ? "近一個月"
    : "近六個月內";
  const reason = `${isDirect ? "替代網路搜尋直連公開店家頁面" : "替代網路搜尋找到可辨識公開來源"}；${freshnessText}未見明確歇業、停業或永久關閉訊息，判定為目前可通過營運檢查。${evidence.alias_note ? ` ${evidence.alias_note}` : ""}`;
  record.operation_status = "operating";
  record.operation_status_checked_at = TODAY;
  record.operation_status_sources = unique([...(record.operation_status_sources || []), ...sources]);
  record.operation_status_reason = reason;
  record.store_status_check = `已於 ${TODAY} 使用替代網路搜尋查核；${evidence.source_excerpt || "找到可辨識公開店家資料，未見歇業相關訊息。"}`;
  record.operation_status_fallback_checked_at = TODAY;
  record.operation_status_fallback_provider = isDirect ? "既有公開店家頁面直連（替代網路驗證）" : "替代網路搜尋";
  record.operation_status_fallback_freshness = evidence.freshness;
  record.operation_status_fallback_sources = sources;
  record.operation_status_fallback_search_excerpt = evidence.source_excerpt || null;
  if (evidence.alias_note) record.operation_status_fallback_alias_note = evidence.alias_note;
  record.sources = unique([...(record.sources || []), ...sources]);
  applyHours(record, evidence);
  return record;
}

function removalEntry(record, evidence) {
  const reason = evidence.no_data_confirmed
    ? "替代網路搜尋已完成以店名、地址及名稱變體查詢；近六個月沒有任何可辨識、可對應該店面的公開資料，依規則移除。"
    : `公開來源出現明確歇業或停業訊息：${evidence.closure}`;
  return {
    source_id: record.source_id,
    id: record.id,
    name: record.name,
    address: record.address,
    reason,
    source: evidenceSources(evidence)[0] || null,
    sources: evidenceSources(evidence),
    checked_at: TODAY,
    evidence_freshness: evidence.freshness || "unavailable",
    evidence_kind: evidence.evidence_kind || "alternative-web-search",
    evidence_excerpt: evidence.source_excerpt || null,
    original: record,
  };
}

const evidenceDocument = readJson(EVIDENCE_PATH);
const evidenceById = new Map((evidenceDocument.evidence || []).map((item) => [item.id, item]));
const fileNames = fs.readdirSync(DATA_DIR)
  .filter((name) => name.endsWith("-restaurants.json"))
  .sort();
const removals = [];
const reportFiles = {};
let totalBefore = 0;
let totalAfter = 0;

for (const file of fileNames) {
  const filePath = path.join(DATA_DIR, file);
  const document = readJson(filePath);
  if (!document.collection || !Array.isArray(document.restaurants)) continue;
  const before = document.restaurants;
  const fileRemovals = [];
  const after = [];
  let applied = 0;
  let unresolved = 0;

  for (const record of before) {
    const evidence = evidenceById.get(record.id);
    if (record.operation_status !== "uncertain" || !evidence) {
      after.push(record);
      continue;
    }
    if (evidence.no_data_confirmed || isStrongClosure(evidence)) {
      const removal = removalEntry(record, evidence);
      removals.push(removal);
      fileRemovals.push(removal);
      continue;
    }
    if (canKeep(evidence)) {
      markOperating(record, evidence);
      applied += 1;
      after.push(record);
      continue;
    }
    unresolved += 1;
    after.push(record);
  }

  document.collection = {
    ...document.collection,
    operation_status_provider: "官方資料、公開來源頁面與替代網路搜尋",
    operation_status_checked_at: TODAY,
    operation_status_rule: RULE,
    record_count_before_operation_fallback_check: before.length,
    record_count_after_operation_fallback_check: after.length,
    record_count_before_operation_check: document.collection.record_count_before_operation_check ?? before.length,
    record_count_after_operation_check: after.length,
    record_count: after.length,
  };
  document.restaurants = after;
  writeJson(filePath, document);
  reportFiles[file] = {
    before: before.length,
    after: after.length,
    checked: before.length,
    fallback_evidence_applied: applied,
    removed: fileRemovals.length,
    unresolved,
    hours_found: after.filter((record) => Boolean(record.business_hours?.average_open_time && record.business_hours?.average_close_time)).length,
    hours_missing: after.filter((record) => !record.business_hours?.average_open_time || !record.business_hours?.average_close_time).length,
    removed_records: fileRemovals,
  };
  totalBefore += before.length;
  totalAfter += after.length;
}

const existingRemovals = fs.existsSync(REMOVALS_PATH) ? readJson(REMOVALS_PATH) : [];
const removalMap = new Map(existingRemovals.map((item) => [`${item.source_id || ""}:${item.id || ""}`, item]));
for (const item of removals) removalMap.set(`${item.source_id || ""}:${item.id || ""}`, item);
writeJson(REMOVALS_PATH, [...removalMap.values()]);

const totals = Object.values(reportFiles).reduce((acc, stats) => ({
  files: acc.files + 1,
  checked: acc.checked + stats.checked,
  before: acc.before + stats.before,
  after: acc.after + stats.after,
  fallback_evidence_applied: acc.fallback_evidence_applied + stats.fallback_evidence_applied,
  removed: acc.removed + stats.removed,
  unresolved: acc.unresolved + stats.unresolved,
  hours_found: acc.hours_found + stats.hours_found,
  hours_missing: acc.hours_missing + stats.hours_missing,
}), {files:0, checked:0, before:0, after:0, fallback_evidence_applied:0, removed:0, unresolved:0, hours_found:0, hours_missing:0});

writeJson(REPORT_PATH, {
  checked_at: TODAY,
  provider: "替代網路搜尋（web search）",
  rule: RULE,
  totals,
  files: reportFiles,
  removal_ids: removals.map((item) => item.id),
});

console.log(JSON.stringify({
  files: fileNames.length,
  total_before: totalBefore,
  total_after: totalAfter,
  fallback_evidence_applied: totals.fallback_evidence_applied,
  removed: removals.map((item) => ({id:item.id,name:item.name})),
  unresolved: totals.unresolved,
}, null, 2));
