# Cuisine data conversion runbook

這份 runbook 是 JAZAMILA 料理類型轉換的操作閘門。所有分類輸出先留在 JSON／JSONL artifact，只有經過人工審核的結果才能進入 apply CLI。

## 1. 備份與 staging

不要直接對 `prisma/dev.db` 做 migration 或分類套用。先建立可還原副本，並記錄副本路徑、時間、SHA-256 與餐廳／tag／關聯筆數。

```bash
cp prisma/dev.db /private/tmp/jazamila-before-cuisine.sqlite
cp prisma/dev.db /private/tmp/jazamila-staging.sqlite
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" node prisma/ensure-sqlite.cjs
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  ./node_modules/.bin/prisma migrate resolve --applied 00000000000000_legacy_baseline
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  ./node_modules/.bin/prisma migrate deploy
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  node scripts/seed-cuisine-types.cjs --dry-run
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  node scripts/seed-cuisine-types.cjs --apply
```

`migrate resolve --applied 00000000000000_legacy_baseline` 只適用於已確認與 legacy baseline 相符、且沒有 `_prisma_migrations` history 的既有資料庫。新資料庫不應手動 resolve baseline；先用 `DATABASE_URL=... node prisma/ensure-sqlite.cjs` 建立 SQLite 檔案，再直接使用 `prisma migrate deploy`。

## 2. 固定輸入快照

```bash
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  node scripts/classify-cuisine-deterministic.cjs \
  --report /private/tmp/jazamila-cuisine-deterministic.json

DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  node scripts/export-cuisine-types.cjs \
  --output /private/tmp/jazamila-active-cuisine-types.json
```

報告中的每筆 `inputFingerprint` 與 `snapshot.inputHash` 必須保留。後續 AI、Web 與 apply 結果不得使用不同快照；fingerprint 不符時必須停止該筆套用。

## 3. Provider pilot 設定

真實 AI／Web 呼叫是唯讀的，但會將餐廳資料送到外部服務，因此必須由操作者明確設定 provider 並確認 pilot 範圍；不要把 secret 寫入 repository 或命令列歷史。

```bash
export OPENAI_API_ENDPOINT="https://<openai-compatible-host>/v1/chat/completions"
export OPENAI_API_KEY="<secret-from-secret-store>"
export AI_MODEL_VERSION="<pinned-ai-model-version>"
export WEB_SEARCH_ENDPOINT="https://<search-provider>/search"
export WEB_SEARCH_API_KEY="<secret-from-secret-store>"
export AI_WEB_MODEL_VERSION="<pinned-web-model-version>"
```

AI endpoint 必須接受 OpenAI Chat Completions 形式的 `messages`、`response_format.type=json_schema` 與 `custom_id` 對應資訊，並回傳可解析的 structured JSON。Web search adapter 接受 `results`、`organic_results`、`webPages.value` 或 `items` 陣列；每個 hit 至少要有 URL、標題與摘要。Web workflow 會另外抓取頁面全文，搜尋摘要不會直接成為證據。

先以小批次執行，結果仍只寫 JSONL：

```bash
node scripts/prepare-cuisine-ai-classification.cjs \
  --input /private/tmp/jazamila-staging-cuisine-deterministic.json \
  --cuisine-types /private/tmp/jazamila-staging-active-cuisine-types.json \
  --model-version "$AI_MODEL_VERSION" \
  --limit 20 \
  --requests /private/tmp/jazamila-cuisine-ai-pilot-requests.jsonl
node scripts/run-cuisine-ai-classification.cjs \
  --requests /private/tmp/jazamila-cuisine-ai-pilot-requests.jsonl \
  --results /private/tmp/jazamila-cuisine-ai-pilot-results.jsonl \
  --run --limit 20
```

Web pilot 必須使用相同 snapshot，且應在 AI 結果完成後重新準備 request：

```bash
node scripts/prepare-cuisine-web-research.cjs \
  --input /private/tmp/jazamila-staging-cuisine-deterministic.json \
  --ai-results /private/tmp/jazamila-cuisine-ai-pilot-results.jsonl \
  --cuisine-types /private/tmp/jazamila-staging-active-cuisine-types.json \
  --model-version "$AI_WEB_MODEL_VERSION" \
  --limit 20 \
  --requests /private/tmp/jazamila-cuisine-web-pilot-requests.jsonl
node scripts/run-cuisine-web-research.cjs \
  --requests /private/tmp/jazamila-cuisine-web-pilot-requests.jsonl \
  --results /private/tmp/jazamila-cuisine-web-pilot-results.jsonl \
  --run --limit 20
```

### 3.1 Codex CLI agent 模式（不接專案 API）

若由 Codex CLI／Codex agent 直接整理資料，不設定 `OPENAI_API_KEY`、`OPENAI_API_ENDPOINT` 或 Web provider key。先確認 Codex session 實際使用的 model，再設定 `CODEX_MODEL_VERSION`；`to-confirm`、`unconfigured`、`pending` 與 `placeholder` 會被 batch preparation 拒絕。

```bash
export CODEX_CLI_VERSION="codex-cli-0.146.0"
export CODEX_MODEL_VERSION="GPT 5.6 Luna Max"

node scripts/prepare-cuisine-ai-classification.cjs \
  --dry-run \
  --input /private/tmp/jazamila-cuisine-deterministic.json \
  --cuisine-types /private/tmp/jazamila-active-cuisine-types.json \
  --model-version "$CODEX_MODEL_VERSION" \
  --requests /private/tmp/jazamila-cuisine-ai-requests-gpt-5-6-luna-max.jsonl

node scripts/prepare-cuisine-codex-batch.cjs \
  --stage ai \
  --requests /private/tmp/jazamila-cuisine-ai-requests-gpt-5-6-luna-max.jsonl \
  --batch-id jazamila-cuisine-ai-pilot-20260811-002 \
  --limit 20 \
  --output-dir /private/tmp/jazamila-codex-runs/ai-pilot-20260811-002 \
  --codex-cli-version "$CODEX_CLI_VERSION"
```

把產生的 `codex-prompt.md` 貼給 Codex agent。AI agent 只可寫入該 batch 的 `/private/tmp` artifact，不可使用網路或修改 repository；完成後必須執行：

```bash
node scripts/validate-cuisine-codex-output.cjs \
  --stage ai \
  --manifest /private/tmp/jazamila-codex-runs/ai-pilot-20260811-002/manifest.json
```

Web agent 只能在明確允許網路的獨立 session 執行，並且同時產生 `raw-results.jsonl` 與 `evidence.jsonl`；validator 會檢查完整頁面內容、identity、contentHash、來源層級與 fingerprint。Codex handoff 的完整提示詞與 Web 版本位於 `docs/cuisine-codex-agent-prompt.md`。

## 4. 分類輸出順序

1. deterministic dry-run。
2. 只對 `needsAi=true` 產生 AI request；模型輸出必須通過 strict JSON Schema。
3. 只對符合資格的低信心／衝突／候選／分店風險資料產生 Web request。
4. 對 AI／Web 提出的新類型產生候選清單。
5. 人工逐筆 `approve`、`merge` 或 `reject`；pending candidate 不得套用。
6. staging 全量 apply dry-run。
7. 以 100–500 筆代表性資料建立第一個 apply batch，確認報表與 rollback 後再擴大。

### 4.1 Unresolved 與「其他餐飲」語意

- 證據不足、證據衝突、模糊詞、身分風險或現行 taxonomy 沒有適用類型時，結果必須維持 `classificationStatus=unresolved`。
- unresolved 結果必須是 `needsWebResearch=true`，且不得只因流程需要終態就自動選擇「其他餐飲」。
- 「其他餐飲」只能由明確證據支持或經人工決策選定；它不是錯誤、拒答或缺資料的 fallback。
- AI unresolved envelope 與 Web `unresolved` 都不會被 apply normalization 當成可套用分類。

對已匯出的 unverified 備份，可在完全不讀寫 SQLite、不使用網路的情況下重新執行 deterministic 分層：

```bash
node scripts/classify-cuisine-unverified-backup.cjs \
  --input data_tmp/cuisine-unverified-other-20260812/records.jsonl \
  --output-dir artifacts/cuisine/<new-batch-id>
```

輸出目錄必須是新目錄。完成 artifact 包含 `classified-results.jsonl`、`unresolved-results.jsonl`、`summary.json` 與 `sha256-manifest.json`；任何 fingerprint mismatch 都不得進入後續套用。

## 5. 實際套用閘門

```bash
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  node scripts/apply-cuisine-classification.cjs \
  --deterministic-report /path/to/deterministic.json \
  --ai-results /path/to/ai-results.jsonl \
  --web-results /path/to/web-results.jsonl \
  --review /path/to/candidate-review.json \
  --batch-id cuisine-2026-08-11-pilot
```

上面的命令預設為 dry-run。只有明確加上 `--apply` 才會寫入；`--apply` 必須同時提供 `--batch-id`。每批會在同一 transaction 內寫入 `Restaurant.cuisineTypeId`、tag ownership／visibility 與 before／after audit。

正式資料庫套用前必須確認：

- migration、seed、foreign key 與備份還原已在 staging 通過。
- deterministic、AI、Web 的 taxonomy／prompt／model 版本已固定。
- 所有 candidate 已完成決策，沒有 pending 或 invalid result。
- 沒有 fingerprint mismatch，且人工鎖定的 cuisine／tag 欄位未被覆蓋。
- source tag 仍可由 `sourceName` 與 owner=`source` 追溯，即使被設為非公開。

## 6. Rollback

```bash
DATABASE_URL="file:/private/tmp/jazamila-staging.sqlite" \
  node scripts/apply-cuisine-classification.cjs \
  --rollback --batch-id cuisine-2026-08-11-pilot
```

Rollback 依照該批的 before／after 與 fingerprint 還原；若人工已在套用後修改鎖定欄位，該欄位會受保護。被其他批次共用的 CuisineType 不應因單一 batch rollback 自動刪除，需另行人工審核。
