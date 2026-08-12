#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  snapshotHashForResults,
} = require("./classify-cuisine-deterministic.cjs");
const {
  validateClassificationResult,
} = require("../lib/ai/cuisine-classification-contract.cjs");
const {
  validateSchemaOnly: validateWebSchemaOnly,
} = require("../lib/web-research/web-research-contract.cjs");

const ROOT = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/audit-cuisine-conversion.cjs --deterministic-report <path> [options]

Read-only validation of the versioned classification artifacts before apply.
It never calls providers and never writes SQLite.

Options:
  --deterministic-report <path>  Phase 3 report (required)
  --ai-requests <path>           Phase 4 request JSONL
  --ai-results <path>            Phase 4 result JSONL
  --web-requests <path>          Phase 5 request JSONL
  --web-results <path>           Phase 5 result JSONL
  --review <path>                Candidate review artifact
  --cuisine-types <path>         Active CuisineType export for AI validation
  --require-complete             Fail if prepared requests remain pending/invalid
  --output <path>                Write audit JSON
  --help                         Show this help
`;
}

function parseArgs(argv) {
  const options = {
    deterministicReport: null,
    aiRequests: null,
    aiResults: null,
    webRequests: null,
    webResults: null,
    review: null,
    cuisineTypes: null,
    requireComplete: false,
    output: null,
    help: false,
  };
  const valueOptions = new Map([
    ["--deterministic-report", "deterministicReport"],
    ["--ai-requests", "aiRequests"],
    ["--ai-results", "aiResults"],
    ["--web-requests", "webRequests"],
    ["--web-results", "webResults"],
    ["--review", "review"],
    ["--cuisine-types", "cuisineTypes"],
    ["--output", "output"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--require-complete") options.requireComplete = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else {
      const [name, inlineValue] = argument.split("=", 2);
      const key = valueOptions.get(name);
      if (!key) throw new Error(`Unknown option: ${argument}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      options[key] = path.resolve(ROOT, String(value));
    }
  }
  if (options.help) return options;
  if (!options.deterministicReport) throw new Error("--deterministic-report is required");
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at ${filePath}:${index + 1}`, { cause: error });
      }
    });
}

function readRecords(filePath) {
  if (!filePath) return [];
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.results)) return parsed.results;
    return [parsed];
  } catch {
    return readJsonl(filePath);
  }
}

function fileHash(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function statusCounts(records) {
  return records.reduce((counts, record) => {
    const status = String(record?.status || "raw");
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function requestIndex(records, prefix) {
  const index = new Map();
  const errors = [];
  for (const request of records) {
    const customId = String(request?.customId || "");
    if (!customId.startsWith(prefix)) errors.push(`invalid customId: ${customId || "<empty>"}`);
    if (index.has(customId)) errors.push(`duplicate customId: ${customId}`);
    index.set(customId, request);
  }
  return { index, errors };
}

function auditResultSet({ label, requests, results, prefix, suppliedCuisineTypes = [] }) {
  const errors = [];
  const warnings = [];
  const warningCounts = {};
  function addWarning(message, status = "warning") {
    warningCounts[status] = (warningCounts[status] || 0) + 1;
    if (warnings.length < 10) warnings.push(message);
  }
  const requestAudit = requestIndex(requests, prefix);
  errors.push(...requestAudit.errors.map((error) => `${label}: ${error}`));
  const seen = new Set();
  for (const record of results) {
    const customId = String(record?.customId || "");
    const request = requestAudit.index.get(customId);
    if (!request) {
      errors.push(`${label}: result has no matching request: ${customId || "<empty>"}`);
      continue;
    }
    if (seen.has(customId)) errors.push(`${label}: duplicate result customId: ${customId}`);
    seen.add(customId);
    if (Number(record.restaurantId) !== Number(request.restaurantId)) errors.push(`${label}: restaurantId mismatch for ${customId}`);
    if (record.inputFingerprint !== request.inputFingerprint) errors.push(`${label}: inputFingerprint mismatch for ${customId}`);
    if ((record.snapshotHash ?? null) !== (request.snapshotHash ?? null)) errors.push(`${label}: snapshotHash mismatch for ${customId}`);
    if (!Array.isArray(record.sourceReferences)) errors.push(`${label}: result lacks sourceReferences for ${customId}`);
    if (["pending", "invalid", "error", "refusal", "unresolved", "skipped"].includes(record.status)) {
      addWarning(`${label}: ${record.status} for ${customId}`, record.status);
    }
    if (label === "ai" && record.status === "ok") {
      const validation = validateClassificationResult(record.result, {
        restaurantId: request.restaurantId,
        inputFingerprint: request.inputFingerprint,
        suppliedCuisineTypes: request.suppliedCuisineTypes ?? suppliedCuisineTypes,
        currentTags: request.input?.currentTags ?? [],
      });
      if (!validation.success) errors.push(`${label}: schema validation failed for ${customId}`);
    }
    if (label === "web" && record.status === "ok") {
      const validation = validateWebSchemaOnly(record.result);
      if (!validation.success) errors.push(`${label}: schema validation failed for ${customId}`);
      if (!record.result?.evidenceUrls?.length || !record.audit?.fetchedSources?.length) {
        errors.push(`${label}: successful result lacks fetched evidence audit for ${customId}`);
      }
    }
    if (label === "web" && record.status === "unresolved") {
      const validation = validateWebSchemaOnly(record.result);
      if (!validation.success) errors.push(`${label}: unresolved result failed schema validation for ${customId}`);
      if (!record.audit || !Array.isArray(record.audit.searchQueries)) {
        errors.push(`${label}: unresolved result lacks search audit for ${customId}`);
      } else if (JSON.stringify(record.audit.searchQueries) !== JSON.stringify(request.searchQueries)) {
        errors.push(`${label}: unresolved search audit does not match request for ${customId}`);
      }
    }
  }
  for (const request of requests) {
    if (!seen.has(request.customId)) addWarning(`${label}: request has no result: ${request.customId}`, "missing-result");
  }
  return {
    requestCount: requests.length,
    resultCount: results.length,
    statuses: statusCounts(results),
    errors,
    warnings,
    warningCounts,
  };
}

function auditArtifacts(options) {
  const deterministic = readJson(options.deterministicReport);
  const errors = [];
  const warnings = [];
  if (deterministic.mode !== "dry-run" || deterministic.readOnly !== true) errors.push("deterministic report is not read-only dry-run");
  const deterministicResults = Array.isArray(deterministic.results) ? deterministic.results : [];
  const ids = new Set();
  for (const result of deterministicResults) {
    if (ids.has(result.restaurantId)) errors.push(`duplicate deterministic restaurantId: ${result.restaurantId}`);
    ids.add(result.restaurantId);
    if (!/^[a-f0-9]{64}$/u.test(String(result.inputFingerprint))) errors.push(`invalid deterministic fingerprint: ${result.restaurantId}`);
  }
  const expectedSnapshotHash = snapshotHashForResults(deterministicResults);
  if (deterministic.snapshot?.inputHash !== expectedSnapshotHash) errors.push("deterministic snapshot inputHash does not match result rows");

  const cuisineTypesArtifact = options.cuisineTypes ? readJson(options.cuisineTypes) : [];
  const cuisineTypes = Array.isArray(cuisineTypesArtifact)
    ? cuisineTypesArtifact
    : (cuisineTypesArtifact.cuisineTypes ?? []);
  const aiRequests = readRecords(options.aiRequests);
  const aiResults = readRecords(options.aiResults);
  const webRequests = readRecords(options.webRequests);
  const webResults = readRecords(options.webResults);
  const ai = auditResultSet({ label: "ai", requests: aiRequests, results: aiResults, prefix: "jazamila-cuisine-ai-v1:", suppliedCuisineTypes: cuisineTypes });
  const web = auditResultSet({ label: "web", requests: webRequests, results: webResults, prefix: "jazamila-cuisine-web-v1:" });
  errors.push(...ai.errors, ...web.errors);
  warnings.push(...ai.warnings, ...web.warnings);

  let review = null;
  if (options.review) {
    review = readJson(options.review);
    if (review.readOnly !== true || review.reviewVersion !== "cuisine-candidate-review-v1") errors.push("candidate review is not a versioned read-only artifact");
    const pending = (review.candidates ?? []).filter((candidate) => candidate.decision === "pending").length;
    if (pending > 0) warnings.push(`candidate review has ${pending} pending candidate(s)`);
    if (options.requireComplete && pending > 0) errors.push("candidate review has pending candidates");
  }
  if (options.requireComplete) {
    for (const [label, audit] of [["ai", ai], ["web", web]]) {
      if (audit.resultCount !== audit.requestCount) errors.push(`${label}: not every request has a terminal result`);
      const allowedStatuses = label === "ai" ? new Set(["ok"]) : new Set(["ok", "unresolved"]);
      const nonTerminal = Object.entries(audit.statuses)
        .filter(([status]) => !allowedStatuses.has(status))
        .map(([status, count]) => `${status}(${count})`);
      if (nonTerminal.length > 0) errors.push(`${label}: non-terminal statuses remain: ${nonTerminal.join(", ")}`);
    }
  }
  return {
    mode: "dry-run",
    readOnly: true,
    writesDatabase: false,
    pass: errors.length === 0,
    snapshot: {
      reportPath: options.deterministicReport,
      inputHash: deterministic.snapshot?.inputHash ?? null,
      resultCount: deterministicResults.length,
    },
    deterministic: {
      summary: deterministic.summary ?? null,
      statusCounts: {
        classified: deterministicResults.filter((result) => result.proposedCuisineType).length,
        needsAi: deterministicResults.filter((result) => result.needsAi === true).length,
      },
    },
    ai,
    web,
    review: review ? { summary: review.summary ?? null } : null,
    artifactHashes: Object.fromEntries([
      ["deterministicReport", options.deterministicReport],
      ["aiRequests", options.aiRequests],
      ["aiResults", options.aiResults],
      ["webRequests", options.webRequests],
      ["webResults", options.webResults],
      ["review", options.review],
    ].filter(([, filePath]) => filePath).map(([name, filePath]) => [name, fileHash(filePath)])),
    errors,
    warnings,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  const audit = auditArtifacts(options);
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify({ ...audit, output: options.output }, null, 2)}\n`);
  if (!audit.pass) process.exitCode = 2;
  return audit;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { auditArtifacts, main, parseArgs, usage };
