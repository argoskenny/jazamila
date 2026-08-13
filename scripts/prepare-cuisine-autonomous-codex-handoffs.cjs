#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const {
  buildManifest,
  outputPaths,
  sha256File,
  writeJsonl,
  writeManifest,
} = require("../lib/ai/cuisine-codex-batch.cjs");
const { loadSuppliedCuisineTypes } = require("../lib/ai/cuisine-classification-pipeline.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.join(ROOT, "data_tmp/cuisine-unverified-other-20260812/records.jsonl");
const DEFAULT_RECOVERY = path.join(ROOT, "artifacts/cuisine/cuisine-unverified-recovery-20260813-002");
const DEFAULT_TYPES = path.join(ROOT, "data_tmp/cuisine-unverified-other-20260812/cuisine-types.json");
const RESULT_SCHEMA = path.join(ROOT, "lib/ai/cuisine-classification-schema.json");
const PROMPT_VERSION = "cuisine-autonomous-codex-handoff-v1";
const MODEL_VERSION = "codex-session-autonomous";
const DEVELOPMENT_DATABASE_URL = `file:${path.join(ROOT, "prisma", "dev.db")}`;

function usage() {
  return `Usage: node scripts/prepare-cuisine-autonomous-codex-handoffs.cjs --output-dir <path> [options]

Split the unverified restaurant snapshot into two Codex-session handoff bundles.
This preparation command never uses the network and never reads or writes SQLite.

Options:
  --source <path>          Original exported records JSONL
  --recovery-dir <path>    Directory containing classified-results.jsonl and unresolved-results.jsonl
  --cuisine-types <path>   Active CuisineType export
  --output-dir <path>      New output directory (required; must not exist)
  --batch-prefix <value>   Stable batch prefix (default: cuisine-autonomous-20260813)
  --help                   Show this help
`;
}

function parseArgs(argv) {
  const options = {
    sourcePath: DEFAULT_SOURCE,
    recoveryDir: DEFAULT_RECOVERY,
    cuisineTypesPath: DEFAULT_TYPES,
    outputDir: null,
    batchPrefix: "cuisine-autonomous-20260813",
    help: false,
  };
  const names = new Map([
    ["--source", "sourcePath"],
    ["--recovery-dir", "recoveryDir"],
    ["--cuisine-types", "cuisineTypesPath"],
    ["--output-dir", "outputDir"],
    ["--batch-prefix", "batchPrefix"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else {
      const [name, inline] = argument.split("=", 2);
      const key = names.get(name);
      if (!key) throw new Error(`Unknown option: ${argument}`);
      const value = inline ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      options[key] = value;
    }
  }
  if (options.help) return options;
  if (!options.outputDir) throw new Error("--output-dir is required");
  for (const key of ["sourcePath", "recoveryDir", "cuisineTypesPath", "outputDir"]) {
    options[key] = path.resolve(ROOT, String(options[key]));
  }
  if (!String(options.batchPrefix).trim()) throw new Error("--batch-prefix cannot be empty");
  return options;
}

function readJsonlIndex(filePath, expectedStatus) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean);
  const index = new Map();
  for (const [lineIndex, line] of lines.entries()) {
    let value;
    try { value = JSON.parse(line); } catch (error) {
      throw new Error(`invalid JSONL at ${filePath}:${lineIndex + 1}: ${error.message}`, { cause: error });
    }
    if (value.classificationStatus !== expectedStatus) throw new Error(`unexpected status in ${filePath}:${lineIndex + 1}`);
    if (index.has(Number(value.restaurantId))) throw new Error(`duplicate restaurant ${value.restaurantId} in ${filePath}`);
    index.set(Number(value.restaurantId), value);
  }
  return index;
}

function compactAssessment(result) {
  return {
    classificationStatus: result.classificationStatus,
    proposedCuisineType: result.proposedCuisineType,
    confidence: result.confidence,
    decisionReason: result.decisionReason,
    candidateEvidence: result.candidateEvidence,
    ambiguousMatches: result.ambiguousMatches,
    unsupportedCategoryMatches: result.unsupportedCategoryMatches,
    entityRiskMatches: result.entityRiskMatches,
  };
}

function requestFor(record, assessment, group, suppliedCuisineTypes) {
  const source = record.source ?? {};
  const input = record.input ?? {};
  const fingerprint = String(source.inputFingerprint ?? assessment.inputFingerprint ?? "");
  if (!/^[a-f0-9]{64}$/u.test(fingerprint) || fingerprint !== assessment.inputFingerprint) {
    throw new Error(`fingerprint mismatch for restaurant ${record.restaurantId}`);
  }
  const currentTags = Array.isArray(input.currentTags) ? input.currentTags : [];
  const database = record.currentDatabase ?? {};
  let reviewSummaries = [];
  if (database.reviewSummaryJson) {
    try {
      const parsed = JSON.parse(database.reviewSummaryJson);
      if (Array.isArray(parsed)) reviewSummaries = parsed.map(String);
    } catch { /* retain an empty list for malformed legacy JSON */ }
  }
  return {
    customId: source.customId || `jazamila-cuisine-ai-v1:r${record.restaurantId}:f${fingerprint}`,
    restaurantId: Number(record.restaurantId),
    inputFingerprint: fingerprint,
    snapshotHash: source.snapshotHash ?? null,
    taxonomyVersion: assessment.taxonomyVersion ?? null,
    classificationSchemaVersion: "cuisine-classification-schema-v1",
    promptVersion: PROMPT_VERSION,
    modelVersion: MODEL_VERSION,
    preparationGroup: group,
    input: {
      name: String(input.name ?? ""),
      note: String(input.note ?? ""),
      address: String(input.address ?? ""),
      phone: String(input.phone ?? ""),
      currentFoodType: Number(input.currentFoodType ?? 0),
      currentTags,
      knownSourceReferences: Array.isArray(input.knownSourceReferences) ? input.knownSourceReferences : [],
      savedSourceCuisineTypes: Array.isArray(input.savedSourceCuisineTypes) ? input.savedSourceCuisineTypes : [],
      reviewSummaries,
    },
    currentDatabaseSnapshot: {
      cuisineTypeId: database.cuisineTypeId ?? null,
      cuisineType: database.cuisineType ?? null,
      manualOverrideFields: database.manualOverrideFields ?? null,
      updatedAtUnix: database.updatedAtUnix ?? null,
    },
    recoveryAssessment: compactAssessment(assessment),
    suppliedCuisineTypes,
    systemPrompt: "依本 bundle 的 codex-prompt.md，以寬鬆標準為餐廳選一個主要料理類型；優先使用既有 CuisineType。",
    userPrompt: "請依此 request 的 input、recoveryAssessment 與 suppliedCuisineTypes 輸出 result-schema.json 規定的單一 JSON 物件。",
  };
}

function handoffPrompt({ group, manifestPath, requestCount, otherCuisineTypeId }) {
  const isDirect = group === "direct";
  if (!isDirect) {
    return `# Codex session 任務：資料不足，簡單搜尋後直接分類並寫入開發資料庫

你已獲得本批次的完整判定與資料庫寫入授權。請自行完成 manifest 中 ${requestCount.toLocaleString("en-US")} 筆餐廳，不需要逐筆詢問，也不需要再次要求 DATABASE_URL。

## 固定範圍與資料庫

- manifest: \`${manifestPath}\`
- 目標 SQLite：\`${DEVELOPMENT_DATABASE_URL}\`
- batch-id：\`cuisine-autonomous-20260813-001-research\`
- manifest 頂層的 readOnly/writesDatabase 旗標只描述「分類輸出檔」本身；本提示詞已另外明確授權你將最終結果寫入上述開發資料庫。
- 只處理 manifest 列出的 restaurantId；只更新 Restaurant.cuisineTypeId、必要的 CuisineType，以及既有套用稽核資料，不修改餐廳其他欄位。

## 寬鬆判定規則

1. 先看 request 內的名稱、備註、地址、標籤、評論摘要與 recoveryAssessment，大致看得出來就直接判定。
2. 本地資料真的看不出來時才做簡單網路搜尋。用「店名＋地區」搜尋，通常看 1～2 個結果即可，不要求完整研究、內容快照或來源雜湊。
3. 優先使用資料庫現有 CuisineType；只要大致接近即可，不追求過度精確。
4. 現有類型真的不適合時，由你直接新增一個可重用的大類型並使用，不需要 candidate 人工審核。相同或近似的新名稱要先合併去重。
5. 飲料店、烘焙店等若現有類型不合適，可以新增穩定的大類；不能用品牌名、單一道菜或行銷詞當類型。
6. 最後仍看不出來就設為「其他餐飲」（CuisineType id ${otherCuisineTypeId}）。每間餐廳都必須有結果，不留下 unresolved。

## 簡化執行方式

1. 讀取 manifest/requests，分批處理並保留進度，避免 session 中斷後重做。
2. 每批完成判定後即可直接操作 \`${DEVELOPMENT_DATABASE_URL}\`。不需要等待人工確認、candidate review、完整 dry-run、額外備份或繁複安全檢查。
3. 可使用 Prisma 或 SQLite transaction；自動建立必要的 CuisineType，再更新該批 Restaurant.cuisineTypeId。遇到已是正確類型就算 no-change。
4. 基本確認 restaurantId 存在即可；單筆搜尋或資料問題不要阻塞整批，寬鬆選最合理類型後繼續。
5. 完成後只需回報：總處理數、更新數、no-change、仍為其他餐飲數、新增的 CuisineType、失敗數。

這次仍在開發階段，料理類型判定與資料庫操作全權交由你完成；不要因為缺少人工審核或額外安全流程而停下。
`;
  }
  const researchRule = isDirect
    ? "禁止使用網路。recoveryAssessment 是線索而非必須照抄的答案；只用 request 內的本地資料做寬鬆判定。"
    : "先用 request 內資料判定；只有資料仍不足時才上網搜尋。搜尋須用店名加地址或電話鎖定同一分店，記錄實際採用的來源 URL；搜尋摘要本身不是證據。";
  return `# Codex session 任務：${isDirect ? "本地資料可直接判定" : "資料不足，必要時網路補充"}

你要全權完成此 manifest 中 ${requestCount.toLocaleString("en-US")} 筆餐廳的料理類型判定，驗證結果，然後寫回操作人員明確指定的 SQLite 資料庫。無需人工逐筆審核，但不得猜測資料庫路徑。

## 固定輸入

- manifest: \`${manifestPath}\`
- requests、schema、raw/validated results 路徑一律以 manifest 為準。
- 只處理 manifest 列出的 restaurantId；不得擴大範圍。
- ${researchRule}

## 判定規則

1. 每間餐廳必須得到一個主要料理類型，採寬鬆、大略判定。
2. 優先選 suppliedCuisineTypes 內最接近的既有類型，不要求完美精確。
3. 只有確實沒有合適的大分類時才提出 proposedNewCuisineType；新類型必須可重用，不能是品牌、單一道菜、行銷詞或過度細分名稱。
4. 若最後仍無法辨識，選「其他餐飲」（CuisineType id ${otherCuisineTypeId}）；不得留下 needsWebResearch=true 或無分類結果。
5. keptTags 與 removedTags 必須完整且不重疊地涵蓋 currentTags；不要任意新增行銷 tag。
6. 最終每筆輸出須符合 result-schema.json，且 restaurantId/inputFingerprint 必須原樣保留。

## 執行流程

1. 先驗證 manifest、requests SHA-256、筆數與 schema；分段處理並可續跑，確保 raw-results.jsonl 對每個 request 恰有一筆。
2. 執行：\`node scripts/validate-cuisine-codex-output.cjs --stage ai --manifest ${manifestPath}\`。任何 missing/duplicate/invalid 都要修正，直到 validated-results.jsonl 全數 status=ok。
3. 將所有 proposedNewCuisineType 集中去重：與執行當下資料庫既有類型同義者一律 merge；真正的新大類可自動 approve。不可核准純輔助詞。
4. 寫入前，要求/確認操作人員給定明確的 \`DATABASE_URL\`。若未設定、仍是預設 dev/test DB、或無法確認目標，停止，不要寫入。
5. 對指定 DB 做唯讀 preflight：確認 Restaurant/CuisineType/CuisineApplyBatch/CuisineApplyChange 結構、每筆 restaurant 存在、inputFingerprint 未漂移、manual override 未被覆蓋；另建立可復原備份。
6. 使用既有 scripts/review-cuisine-type-candidates.cjs 產生並自動完成 candidate decisions；先用 scripts/apply-cuisine-classification.cjs 做 dry-run。只有 ready 加 already-correct/no-change 的總數等於 manifest requestCount、無 pending candidate、無 fingerprint/manual-lock/找不到餐廳等問題時，才用唯一 batch-id 在單一 transaction 加上 --apply。原本已是「其他餐飲」且最後仍判為「其他餐飲」可列為 no-change，不必假裝更新。
7. 套用後重新查 DB，確認 manifest 中每間餐廳都有 active CuisineType，且 CuisineApplyBatch/Change 有完整稽核記錄；輸出套用摘要與 rollback dry-run 指令。

兩個 bundle 不可同時寫同一個 DB。執行順序固定為 direct 先、research 後；research 寫入前必須重新載入最新 CuisineType 清單。
`;
}

async function createBundle({ group, directory, requests, batchId, otherCuisineTypeId }) {
  const paths = outputPaths(directory, "ai");
  fs.mkdirSync(directory, { recursive: true });
  writeJsonl(paths.requestPath, requests);
  writeJsonl(paths.rawResultPath, []);
  writeJsonl(paths.validatedResultPath, []);
  fs.copyFileSync(RESULT_SCHEMA, paths.schemaPath);
  const manifest = buildManifest({
    stage: "ai",
    batchId,
    paths,
    requests,
    requestSha256: sha256File(paths.requestPath),
    schemaSha256: sha256File(paths.schemaPath),
  });
  manifest.workflow = {
    classificationGroup: group,
    autonomousDecision: true,
    databaseWriteAuthorizedOnlyAfterValidation: group === "direct",
    databaseWriteAuthorized: group === "research",
    databaseTarget: group === "research" ? DEVELOPMENT_DATABASE_URL : "REQUIRED_EXPLICIT_DATABASE_URL_AT_EXECUTION",
    candidateReviewRequired: group === "direct",
    simplifiedDevelopmentWorkflow: group === "research",
    runOrder: group === "direct" ? 1 : 2,
    mustNotRunConcurrently: true,
  };
  if (group === "research") manifest.networkPolicy = "simple-web-search-allowed";
  writeManifest(paths.manifestPath, manifest);
  fs.writeFileSync(paths.promptPath, `${handoffPrompt({ group, manifestPath: paths.manifestPath, requestCount: requests.length, otherCuisineTypeId })}\n`, "utf8");
  return { paths, manifest };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { process.stdout.write(usage()); return null; }
  if (fs.existsSync(options.outputDir)) throw new Error(`refusing to use existing output directory: ${options.outputDir}`);
  for (const filePath of [options.sourcePath, options.cuisineTypesPath]) {
    if (!fs.existsSync(filePath)) throw new Error(`input does not exist: ${filePath}`);
  }
  const classified = readJsonlIndex(path.join(options.recoveryDir, "classified-results.jsonl"), "classified");
  const unresolved = readJsonlIndex(path.join(options.recoveryDir, "unresolved-results.jsonl"), "unresolved");
  const overlap = [...classified.keys()].filter((id) => unresolved.has(id));
  if (overlap.length) throw new Error(`recovery groups overlap at restaurant ${overlap[0]}`);
  const suppliedCuisineTypes = loadSuppliedCuisineTypes(options.cuisineTypesPath);
  const other = suppliedCuisineTypes.find((type) => type.code === "other" || type.normalizedName === "其他餐飲");
  if (!other) throw new Error("active CuisineType export does not contain 其他餐飲");

  const directRequests = [];
  const researchRequests = [];
  const seen = new Set();
  const reader = readline.createInterface({ input: fs.createReadStream(options.sourcePath), crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of reader) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); } catch (error) {
      throw new Error(`invalid source JSONL at line ${lineNumber}: ${error.message}`, { cause: error });
    }
    const id = Number(record.restaurantId);
    if (seen.has(id)) throw new Error(`duplicate source restaurant ${id}`);
    seen.add(id);
    const assessment = classified.get(id) ?? unresolved.get(id);
    if (!assessment) throw new Error(`source restaurant ${id} is missing from recovery outputs`);
    const group = classified.has(id) ? "direct" : "research";
    (group === "direct" ? directRequests : researchRequests).push(requestFor(record, assessment, group, suppliedCuisineTypes));
  }
  if (seen.size !== classified.size + unresolved.size) throw new Error("source/recovery restaurant counts do not match");

  fs.mkdirSync(options.outputDir, { recursive: false });
  const direct = await createBundle({ group: "direct", directory: path.join(options.outputDir, "direct"), requests: directRequests, batchId: `${options.batchPrefix}-direct`, otherCuisineTypeId: other.id });
  const research = await createBundle({ group: "research", directory: path.join(options.outputDir, "research"), requests: researchRequests, batchId: `${options.batchPrefix}-research`, otherCuisineTypeId: other.id });
  fs.copyFileSync(options.cuisineTypesPath, path.join(options.outputDir, "cuisine-types.json"));
  const summary = {
    mode: "codex-autonomous-handoffs-prepared",
    readOnlyPreparation: true,
    callsNetwork: false,
    readsDatabase: false,
    writesDatabase: false,
    sourcePath: options.sourcePath,
    recoveryDir: options.recoveryDir,
    total: seen.size,
    direct: { count: directRequests.length, manifestPath: direct.paths.manifestPath, promptPath: direct.paths.promptPath, databaseTarget: "must be supplied explicitly" },
    research: { count: researchRequests.length, manifestPath: research.paths.manifestPath, promptPath: research.paths.promptPath, databaseTarget: DEVELOPMENT_DATABASE_URL, directWriteAuthorized: true },
    runOrder: ["direct", "research"],
    databaseTarget: "see per-group databaseTarget",
  };
  fs.writeFileSync(path.join(options.outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const files = [];
  for (const relative of [
    "cuisine-types.json", "summary.json",
    "direct/requests.jsonl", "direct/raw-results.jsonl", "direct/validated-results.jsonl", "direct/result-schema.json", "direct/manifest.json", "direct/codex-prompt.md",
    "research/requests.jsonl", "research/raw-results.jsonl", "research/validated-results.jsonl", "research/result-schema.json", "research/manifest.json", "research/codex-prompt.md",
  ]) {
    const absolute = path.join(options.outputDir, relative);
    files.push({ path: relative, bytes: fs.statSync(absolute).size, sha256: sha256File(absolute) });
  }
  const integrity = { algorithm: "sha256", createdAt: new Date().toISOString(), files };
  fs.writeFileSync(path.join(options.outputDir, "sha256-manifest.json"), `${JSON.stringify(integrity, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { compactAssessment, handoffPrompt, main, parseArgs, requestFor, usage };
