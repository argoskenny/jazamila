# JAZAMILA Codex agent handoff

這份文件是給另一個 Codex CLI／Codex agent session 的執行入口。它不會接 JAZAMILA 的 AI API，也不會直接寫 SQLite。

## 先準備 shell 設定

```bash
cd /Users/strongbuy/dev/frontend/jazamila
export CODEX_CLI_VERSION="codex-cli-0.146.0"
export CODEX_MODEL_VERSION="GPT 5.6 Luna Max"
export CODEX_AI_BATCH_SIZE="20"
export CODEX_WEB_BATCH_SIZE="5"
```

目前 pilot 已確認使用 `GPT 5.6 Luna Max`。後續若 Codex session 改用其他模型，必須同步更新此值與該批次的 provenance；`CODEX_MODEL_VERSION` 不能留在 `<...>`、`unconfigured-model` 或 `pending-*`，也不能自行捏造模型版本。

## Stage 4：AI 分類

先產生 deterministic report、active CuisineType export 與 AI request JSONL。這些命令只讀 SQLite，輸出寫到 `/private/tmp`：

```bash
export DATABASE_URL="file:/Users/strongbuy/dev/frontend/jazamila/prisma/dev.db"

node scripts/classify-cuisine-deterministic.cjs \
  --dry-run \
  --report /private/tmp/jazamila-cuisine-deterministic.json

node scripts/export-cuisine-types.cjs \
  --output /private/tmp/jazamila-active-cuisine-types.json

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
  --limit "$CODEX_AI_BATCH_SIZE" \
  --output-dir /private/tmp/jazamila-codex-runs/ai-pilot-20260811-002 \
  --codex-cli-version "$CODEX_CLI_VERSION"
```

接著把產生的檔案貼給 Codex agent 執行：

```text
請先讀取並完整遵守：
/private/tmp/jazamila-codex-runs/ai-pilot-20260811-002/codex-prompt.md

這是一個受控 dry-run。只處理 manifest 指定的 batch，只能寫入指定的 /private/tmp artifact；不要修改 repository、不要呼叫 API、不要使用網路、不要寫入任何 SQLite。
```

Codex 完成後，預期檔案為：

```text
/private/tmp/jazamila-codex-runs/ai-pilot-20260811-002/raw-results.jsonl
/private/tmp/jazamila-codex-runs/ai-pilot-20260811-002/validated-results.jsonl
/private/tmp/jazamila-codex-runs/ai-pilot-20260811-002/validation-summary.json
```

只有 `validated-results.jsonl` 通過 validator 的 `status=ok` 結果，才可進入候選審核與 apply dry-run；本文件不授權 `--apply`。

## Stage 5：Web 查核

Web 只處理 `needsWebResearch=true`、低信心、衝突、候選或分店身份風險資料。必須先完成 Stage 4 的 AI 結果，再重新產生 Web requests：

```bash
node scripts/prepare-cuisine-web-research.cjs \
  --dry-run \
  --input /private/tmp/jazamila-cuisine-deterministic.json \
  --ai-results /private/tmp/jazamila-codex-runs/ai-pilot-20260811-002/validated-results.jsonl \
  --cuisine-types /private/tmp/jazamila-active-cuisine-types.json \
  --model-version "$CODEX_MODEL_VERSION" \
  --requests /private/tmp/jazamila-cuisine-web-requests.jsonl

node scripts/prepare-cuisine-codex-batch.cjs \
  --stage web \
  --requests /private/tmp/jazamila-cuisine-web-requests.jsonl \
  --batch-id jazamila-cuisine-web-pilot-001 \
  --limit "$CODEX_WEB_BATCH_SIZE" \
  --output-dir /private/tmp/jazamila-codex-runs/web-pilot-001 \
  --codex-cli-version "$CODEX_CLI_VERSION"
```

Web batch 必須在明確允許網路／瀏覽的 Codex session 執行。搜尋摘要不可作為證據；完整頁面、URL、標題、匹配名稱／地址／電話、retrievedAt 與 contentHash 都必須寫入 evidence sidecar。查無可確認來源時回傳 unresolved，不可猜測。

## 絕對停止條件

遇到以下任一情況，停止該批並保留 raw artifact，不要修改輸入或資料庫：

- manifest 的 snapshot、prompt version、model version 或 request SHA-256 不一致。
- 任何 customId／restaurantId／inputFingerprint 無法一一對回。
- Codex 輸出不是一行一個 JSONL object，或出現額外欄位。
- AI 階段需要上網，或 Web 階段無法保存完整來源內容與 hash。
- 同名不同地址、分店身份不明、來源衝突或資料不足。
- validator 產生 invalid／unresolved 結果。

下一個階段必須由操作者另外執行 candidate review、全量 audit、apply dry-run；除非另有明確批准，不得使用 `--apply`。
