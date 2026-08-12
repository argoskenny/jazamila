# JAZAMILA 料理類型轉換：Codex `/goal` 工作流

這份文件是 JAZAMILA 料理類型資料轉換的單一執行入口與進度紀錄。請在 Codex desktop、Codex CLI 或 IDE session 中使用 `/goal` 啟動；Codex 會依照這份文件逐階段執行，每個階段通過驗證後才可進入下一階段。

這不是一次性自由代理 prompt。所有資料處理都必須受 manifest、JSONL schema、inputFingerprint、snapshot hash、validator 與 progress ledger 約束。

## `/goal` 啟動文字

將以下文字貼到 Codex 的 `/goal`：

```text
請在 JAZAMILA repository 執行料理類型資料轉換工作流。

先完整讀取並遵守：
/Users/strongbuy/dev/frontend/jazamila/docs/cuisine-codex-goal-workflow.md
/Users/strongbuy/dev/frontend/jazamila/AGENTS.md

以該 workflow 的 Progress Ledger 作為目前進度來源。從目前尚未完成的階段繼續；每個階段只能在所有 gate 通過後進入下一階段。每完成一個 batch，更新 Progress Ledger，保留 artifact 路徑、hash、筆數、驗證結果與下一步。

允許 Codex 直接執行 AI 結構化分類與必要的 Web 查核，但必須只處理 manifest 指定資料。AI 階段不可使用網路、API 或 SQLite；Web 階段才可在明確 eligibility 下使用網路。本次 active 全自動 goal 已明確授權指定 target 的正式資料庫寫入；仍必須先通過 full audit、target schema、backup、fingerprint、人工鎖定欄位、transaction 與 rollback gates。

不要使用 git reset、restore、checkout、clean 或覆蓋既有 dirty state 的命令。遇到 invalid、fingerprint mismatch、source identity 不明、schema／CuisineType ID 不一致或任何未預期錯誤，立即停止並更新進度，不要猜測或繞過 gate。candidate pending、target confirmation 與 apply confirmation 僅在沒有本次 goal 明確全自動政策時構成 blocker。
```

官方 OpenAI 文件說明，`/goal` 的 goal text 同時會成為初始 prompt 與完成條件；長流程可在同一 session 中暫停、繼續或要求進度摘要。因此本文件把「完成條件」與「可恢復進度」寫成明確契約。

## 1. 固定範圍與安全不變量

### 1.1 專案與模型

- Repository：`/Users/strongbuy/dev/frontend/jazamila`
- 實際 Codex model provenance：`GPT 5.6 Luna Max`
- Codex agent prompt version：`cuisine-codex-agent-prompt-v1`
- AI classification prompt version：`cuisine-ai-prompt-v1`
- Web research prompt version：`cuisine-web-research-prompt-v1`
- 目前 active CuisineType export：`/private/tmp/jazamila-active-cuisine-types.json`
- 目前 deterministic report：`/private/tmp/jazamila-cuisine-deterministic.json`
- 完整 AI request source：`/private/tmp/jazamila-cuisine-ai-requests-gpt-5-6-luna-max.jsonl`

### 1.2 不可違反的限制

- 每間餐廳最多一個 `cuisineTypeId`；未確定時保留 `null`。
- candidate CuisineType 不得直接進入 active 或公開篩選器。
- AI 不得自由建立大量相似類型；新類型必須進 candidate review。
- AI 階段不可使用網路、搜尋、瀏覽器、外部 API、provider runner 或 SQLite。
- Web 階段只能查核 manifest 內、且符合 eligibility 的餐廳。
- Web 搜尋必須保存完整頁面內容、URL、標題、retrievedAt、contentHash、匹配名稱／地址／電話與來源層級；搜尋摘要不是證據。
- 不可捏造餐廳資訊、評論性 tag 或來源。
- 不可直接覆蓋人工鎖定欄位或未被本次決策明確處理的人工 tag。
- 所有批次預設 dry-run；只有明確的 `--apply` 才能寫 SQLite。
- 不能把 `prisma/dev.db` 當成正式 target staging DB。若 target 缺少新 schema，停止並要求先處理 schema，不得自行對預設 dev DB migration。
- 不得修改與本工作無關的既有 dirty state。

### 1.3 Codex 執行責任

Codex 可以在本 goal session 中直接做模型推論與 Web 查核，但必須遵守以下邊界：

- 模型推論：逐 batch 讀取 `requests.jsonl`，只寫 manifest 指定的 raw artifact，然後執行 validator。
- Web 查核：逐 batch 讀取精確的 `searchQueries`，只寫 raw result 與 evidence sidecar，然後執行 validator。
- 本地腳本：準備 request、合併結果、candidate review、audit、target staging dry-run 由 Codex 在 repository terminal 執行。
- 正式 DB apply：本次 goal 已明確授權固定 target 的 `--apply`；只有 full audit、target preflight、dry-run、transaction 與 rollback gates 全部通過後才可執行。

### 1.4 本次 active 全自動執行政策

- Candidate 決策：`客家料理=approve`、`西班牙料理=approve`；這兩筆決策由本次 goal 提供，寫入獨立 decision artifact，不等待額外人工確認。
- 後續 candidate 自動決策：能以 active CuisineType 的 exact／synonym 唯一對應時使用 `merge`；通過 taxonomy、不是 auxiliary／品牌／菜名且沒有唯一既有對應時使用 `approve`；無法可靠判斷時使用 `reject` 並保留餐廳未分類。身份、來源與 evidence 仍不可猜測。
- Target 僅允許 `file:/private/tmp/jazamila-cuisine-staging.sqlite`；不得使用 `prisma/dev.db` 或任何其他資料庫。target confirmation 不再是額外停點，但 path、schema、CuisineType ID、backup 與 baseline 不符仍必須停止。
- Full audit 與 apply dry-run 通過後，本次 goal 已授權直接執行固定 target 的 `--apply`，不等待額外 apply confirmation。任何 transaction／fingerprint／rollback safety gate 失敗仍立即停止。

## 2. Artifact 目錄與命名

所有執行產物優先寫到 `/private/tmp/jazamila-codex-runs/`，不寫入 repository。每個 batch 必須有獨立目錄：

```text
/private/tmp/jazamila-codex-runs/<batch-id>/
  manifest.json
  codex-prompt.md
  requests.jsonl
  raw-results.jsonl
  validated-results.jsonl
  validation-summary.json
  result-schema.json
  evidence.jsonl                 # 只有 Web batch
  evidence-schema.json            # 只有 Web batch
```

不可把不同 batch 的 raw 或 validated 結果互相覆蓋。若需要彙整完整結果，產生新的 `/private/tmp` consolidated artifact，保留每個 batch 原始檔不變。

## 3. 階段總覽與進入條件

| 階段 | 內容 | 完成 gate |
|---|---|---|
| 0 | 恢復工作區與權限檢查 | AGENTS、git status/diff、target 範圍確認完成 |
| 1 | Schema、CuisineType、target staging 基線 | schema、active IDs、backup／hash 契約成立 |
| 2 | Deterministic 全量 dry-run | 31,293 筆 report 與 snapshot 通過 |
| 3 | AI 分類 batches | 所有 AI request 有 `status=ok` 且 fingerprint 對應 |
| 4 | Web 查核 batches | 所有 eligible request 有 `ok` 或明確 `unresolved`，證據完整 |
| 5 | Candidate review | 所有 candidate 有 goal decision 或自動決策；沒有 pending candidate |
| 6 | 全量 audit 與 target staging apply dry-run | 所有 gate 通過、預計變更與保護欄位可審查 |
| 7 | 全自動正式 apply | full audit、target dry-run、transaction、before／after、rollback 全部可追溯後執行 |

任何階段失敗都要停在該階段，不得自動跳過、猜測、刪除失敗資料或進入下一階段。

## 4. Stage 0：恢復工作區

1. 讀取 `/Users/strongbuy/dev/frontend/jazamila/AGENTS.md`。
2. 執行唯讀檢查：

   ```bash
   cd /Users/strongbuy/dev/frontend/jazamila
   git status --short
   git diff --stat
   git diff --check
   ```

3. 記錄既有 dirty state；不得 reset、restore、checkout、clean 或覆蓋不相關變更。
4. 確認本文件與 Progress Ledger 可讀寫；若只能修改 workflow 而不能寫 `/private/tmp`，停止。
5. 確認沒有另一個 Codex goal 同時寫入同一個 batch 目錄或 target DB。

完成後更新 Progress Ledger 的 `currentStage`、時間、git state 摘要與下一步。

## 5. Stage 1：Schema、CuisineType 與 target staging 基線

### 5.1 目標 DB 必須明確

要求操作者明確提供或確認 target staging database URL。不要從 `prisma/dev.db` 推測 target。執行前只讀確認：

- `r_restaurant.cuisine_type_id` 存在且 nullable。
- `r_cuisine_type` 存在，`normalizedName` unique。
- apply batch/change、source reference、人工保護所需欄位存在。
- target active CuisineType 的 `id`、`name`、`normalizedName`、`status` 與 `/private/tmp/jazamila-active-cuisine-types.json` 一致。
- candidate 不會被 active filter 匯出。

若 target 缺 schema，狀態改為 `awaiting-target-schema` 並停止。不得自動對 `prisma/dev.db` 執行 migration，也不得在未確認 backup 前 migration target。

### 5.2 Backup 與 ID 基線

在任何正式 apply 前，對實際 target staging 做可恢復 copy 與 SHA-256 記錄。backup 必須包含：

- database path／URL（避免寫入 secrets）。
- backup path。
- before SHA-256。
- CuisineType export SHA-256。
- restaurant count、tag count、RestaurantTag count。
- `manualOverrideFields` 欄位存在性與人工鎖定數量。

本階段只可讀取與複製 backup；不可寫入分類結果。

## 6. Stage 2：Deterministic 全量 dry-run

若既有 artifact 的 input hash 與 Progress Ledger 一致，重用並重新驗證；否則重新產生：

```bash
cd /Users/strongbuy/dev/frontend/jazamila

node scripts/classify-cuisine-deterministic.cjs \
  --dry-run \
  --report /private/tmp/jazamila-cuisine-deterministic.json

node scripts/export-cuisine-types.cjs \
  --output /private/tmp/jazamila-active-cuisine-types.json

node scripts/prepare-cuisine-ai-classification.cjs \
  --dry-run \
  --input /private/tmp/jazamila-cuisine-deterministic.json \
  --cuisine-types /private/tmp/jazamila-active-cuisine-types.json \
  --model-version "GPT 5.6 Luna Max" \
  --requests /private/tmp/jazamila-cuisine-ai-requests-gpt-5-6-luna-max.jsonl
```

至少確認：

- restaurant rows：31,293。
- active CuisineType：目前 export 的 22 筆，ID 不漂移。
- `needsAi` request count、snapshot hash、request hash 已記錄。
- deterministic 結果沒有 duplicate restaurantId 或 invalid fingerprint。
- 未寫 SQLite。

若 deterministic report 的輸入內容、CuisineType ID 或 hash 變更，所有後續 AI／Web 結果視為過期，必須停止並重建。

## 7. Stage 3：AI 全量分批執行

### 7.1 分批規則

完整 AI request 目前約 22,496 筆。Codex 可以自動連續處理 batches，但每次只能處理一份 manifest，不可用一個無界限 prompt 讀完並寫出全部結果。

- 首兩個驗證批次維持 20 筆。
- 首兩批皆通過後，才可將後續 batch size 提高；建議先提高到 100，並把理由記錄到 Progress Ledger。
- 每批使用唯一 `batchId`、`offset`、`limit` 與獨立目錄。
- 不得因 token／時間不足而跳過 request；若需要 pause，保存 offset 與 manifest 後停止。

範例：

```bash
node scripts/prepare-cuisine-codex-batch.cjs \
  --stage ai \
  --requests /private/tmp/jazamila-cuisine-ai-requests-gpt-5-6-luna-max.jsonl \
  --batch-id <unique-ai-batch-id> \
  --offset <next-offset> \
  --limit <batch-size> \
  --output-dir /private/tmp/jazamila-codex-runs/<unique-ai-batch-id> \
  --codex-cli-version codex-cli-0.146.0
```

接著讀取該 batch 的 `codex-prompt.md`，由目前 Codex model 直接處理。AI batch 的硬性規則：

- 只讀 manifest 指定的 `requests.jsonl`。
- 不使用網路、API、`OPENAI_API_KEY`、provider runner 或 SQLite。
- raw result 一行一個 JSON object，順序與 request 相同。
- `restaurantId`、`inputFingerprint` 必須逐字對應。
- `selectedCuisineTypeId` 與 candidate 只能擇一；資料不足時保持 null 並要求 Web。
- 不把人氣、平價、古早味、聚餐、排隊等變成 CuisineType。
- 不在 raw output 中加入 schema 未允許的自由欄位。

完成 raw output 後立即執行：

```bash
node scripts/validate-cuisine-codex-output.cjs \
  --stage ai \
  --manifest /private/tmp/jazamila-codex-runs/<unique-ai-batch-id>/manifest.json
```

只有 `validResults=requestCount`、`invalidResults=0`、所有 status 都是 `ok`、customId／restaurantId／fingerprint 全部匹配時，才可標記該 batch 完成。任何 invalid、refusal、error、duplicate 或 hash mismatch 都要停止。

### 7.2 AI 結果彙整

所有 batch 完成後，建立一份新的 consolidated AI result JSONL，不能修改任何原始 batch artifact。彙整時必須驗證：

- 結果總數等於完整 AI request count。
- customId unique，且每一筆只出現一次。
- snapshot hash、prompt version、model version 全部一致。
- 所有 status 都是 `ok`。
- consolidated 檔案 hash 已寫入 Progress Ledger。

若尚未有專用 merge utility，Codex 必須在 `/private/tmp` 產生一次性、唯讀輸入且可重跑的 merge artifact；不得把臨時 merge script 寫入 repository，除非另行取得實作批准。

## 8. Stage 4：完整 AI 後重新產生 Web requests

不要使用只包含部分 AI 結果的舊 Web request。AI consolidated result 完成後，重新執行：

```bash
node scripts/prepare-cuisine-web-research.cjs \
  --dry-run \
  --input /private/tmp/jazamila-cuisine-deterministic.json \
  --ai-results /private/tmp/jazamila-cuisine-ai-results-full.jsonl \
  --cuisine-types /private/tmp/jazamila-active-cuisine-types.json \
  --model-version "GPT 5.6 Luna Max" \
  --requests /private/tmp/jazamila-cuisine-web-requests-full.jsonl
```

Web eligibility 可以包含 explicit `needsWebResearch`、低信心、衝突、新 candidate、同名／分店風險與資訊不足，不應硬編成只有上一個 AI pilot 的筆數。記錄 eligibility 總數、各 reason 分布與 request hash。

## 9. Stage 5：Web 查核分批執行

每個 Web batch 都要有獨立 manifest。Web batch 才能使用網路，且只能查核 manifest 指定 request：

```bash
node scripts/prepare-cuisine-codex-batch.cjs \
  --stage web \
  --requests /private/tmp/jazamila-cuisine-web-requests-full.jsonl \
  --batch-id <unique-web-batch-id> \
  --offset <next-offset> \
  --limit <batch-size> \
  --output-dir /private/tmp/jazamila-codex-runs/<unique-web-batch-id> \
  --codex-cli-version codex-cli-0.146.0
```

Web agent 必須：

- 使用完整名稱、完整地址、城市／行政區、電話與分店名稱建立匹配。
- 開啟完整頁面；搜尋摘要不能作證據。
- 優先官方網站／官方菜單、官方社群、地址可辨認店家頁、可靠平台。
- 對每個 evidence 保存 URL、title、完整 content、contentHash、retrievedAt、sourceTier、identityMatch。
- 名稱／地址／電話或分店不一致且無法合理確認時回傳 unresolved，不猜測。
- `addedTags` 必須由 evidence 明確支持；不能把評論者主觀詞變成正式 tag。

完成後執行：

```bash
node scripts/validate-cuisine-codex-output.cjs \
  --stage web \
  --manifest /private/tmp/jazamila-codex-runs/<unique-web-batch-id>/manifest.json
```

Web batch 的允許終態是 `ok` 或結構完整的 `unresolved`。任何成功結果缺 evidence、content hash 不符、customId／fingerprint 不符或搜尋摘要代替完整頁面，都必須停止。

所有 Web batches 完成後，建立新的 consolidated Web result 與 evidence 索引，保留每個 batch 原始 artifact。

## 10. Stage 6：Candidate review

執行 read-only candidate review：

```bash
node scripts/review-cuisine-type-candidates.cjs \
  --ai-results /private/tmp/jazamila-cuisine-ai-results-full.jsonl \
  --web-results /private/tmp/jazamila-cuisine-web-results-full.jsonl \
  --ai-requests /private/tmp/jazamila-cuisine-ai-requests-gpt-5-6-luna-max.jsonl \
  --web-requests /private/tmp/jazamila-cuisine-web-requests-full.jsonl \
  --cuisine-types /private/tmp/jazamila-active-cuisine-types.json \
  --output /private/tmp/jazamila-cuisine-candidate-review.json
```

- candidate 必須依 `normalizedName`、同義詞與近似名稱比對既有類型。
- review 必須顯示候選名稱、合併建議、受影響餐廳、代表餐廳、來源、平均／最低信心。
- `approve`、`merge`、`reject` 必須來自本次 goal decision artifact 或上述可追溯的自動決策規則。
- 本次 goal 的兩個指定 candidate 不得保留 pending；後續無法可靠判斷的 candidate 自動 `reject` 並保留未分類，不停止整個批次。
- 沒有 candidate 時也要保存 `0 candidates / 0 pending` 的 review artifact。

## 11. Stage 7：全量 audit 與 target staging apply dry-run

在 target staging 上執行前，先重新確認：

- target schema 已存在 `cuisine_type_id` 與 apply audit tables。
- target CuisineType ID 與 active export 完全一致。
- target restaurant row、tag、RestaurantTag、人工鎖定欄位的 baseline 已備份並 hash。
- deterministic、AI、Web、candidate review 的 snapshot／fingerprint／model／prompt 版本一致。

執行 read-only audit：

```bash
node scripts/audit-cuisine-conversion.cjs \
  --deterministic-report /private/tmp/jazamila-cuisine-deterministic.json \
  --ai-requests /private/tmp/jazamila-cuisine-ai-requests-gpt-5-6-luna-max.jsonl \
  --ai-results /private/tmp/jazamila-cuisine-ai-results-full.jsonl \
  --web-requests /private/tmp/jazamila-cuisine-web-requests-full.jsonl \
  --web-results /private/tmp/jazamila-cuisine-web-results-full.jsonl \
  --review /private/tmp/jazamila-cuisine-candidate-review.json \
  --cuisine-types /private/tmp/jazamila-active-cuisine-types.json \
  --require-complete \
  --output /private/tmp/jazamila-cuisine-full-audit.json
```

只有 `pass=true` 才能做 apply dry-run。apply script 預設是 dry-run，不得加 `--apply`：

```bash
node scripts/apply-cuisine-classification.cjs \
  --database "$CUISINE_TARGET_DATABASE_URL" \
  --deterministic-report /private/tmp/jazamila-cuisine-deterministic.json \
  --ai-results /private/tmp/jazamila-cuisine-ai-results-full.jsonl \
  --web-results /private/tmp/jazamila-cuisine-web-results-full.jsonl \
  --review /private/tmp/jazamila-cuisine-candidate-review.json \
  --cuisine-types /private/tmp/jazamila-active-cuisine-types.json \
  --limit <reviewed-batch-limit>
```

dry-run 必須報告：

- ready／blocked／protected／skipped 數量。
- 每筆 before／after、expected fingerprint／current fingerprint。
- 唯一 CuisineType 變更。
- removed／kept／added tags。
- manual override 保護結果。
- 未被本次決策明確處理的 tag 沒有被刪除。

## 12. Stage 8：全自動正式 apply

全量 audit 與 apply dry-run 完成且 pass 後，Codex 將 Progress Ledger 設為 `applying`，使用本次 goal 指定的固定 target 與明確 batch id 執行正式 apply；不等待額外人工批准。

本次 goal 的正式 apply 授權文字為：

```text
我已審閱最新 full audit 與 apply dry-run，批准對指定 target staging database 執行 batch <exact-batch-id> 的 --apply。
```

正式 apply 規則：

- 只使用明確指定的 `--batch-id`。
- 每批使用一個 transaction。
- 保存 before／after 與 apply batch/change audit。
- 再次驗證 current fingerprint，過期結果直接拒絕。
- 人工鎖定欄位與人工 tag 不覆蓋。
- apply 完成後重新查詢 counts、CuisineType 分布、null 未分類數、Tag／RestaurantTag 與人工保護數。
- 任何 transaction 失敗都必須 rollback；不可部分成功後假裝完成。
- rollback 也必須先 dry-run，正式 rollback 需要明確批准。

## 13. 進度紀錄規則

Codex 只能更新本文件底部的 `Progress Ledger`，不可改寫上方的安全規則。每次更新都要：

- 使用 ISO 8601 timestamp。
- 記錄 stage、batchId、offset、limit、request／result counts。
- 記錄 artifact path 與 SHA-256。
- 記錄 validator、audit、dry-run 的實際 pass／fail。
- 記錄 blocker 與下一步。
- 不在 progress 中複製餐廳電話、地址或完整來源內容；只記錄 artifact path、ID、hash 與統計。
- 不刪除既有歷史紀錄；以 append-only log 追加。

Codex 遇到以下任一狀況必須把狀態設為 `blocked` 或 `awaiting-human-review` 並停止：

- schema／CuisineType ID 不一致。
- snapshot、request hash、prompt version 或 model version 不一致。
- request／result 筆數不一致。
- invalid、refusal、error、duplicate 或 fingerprint mismatch。
- Web evidence 不完整、contentHash 不符或分店身份無法確認。
- candidate decision artifact 缺少本次 goal 的明確決策且無法依自動決策規則判斷。
- target DB、backup 或人工鎖定基線不明；本次 goal 不得以確認缺失替代這些安全驗證。
- apply batch id、transaction、before／after 或 rollback audit 不可追溯。

## Progress Ledger

> 這一區是目前工作狀態。Codex 每完成一個 stage 或 batch 就更新；不要修改上方 workflow 規則。

```yaml
workflowVersion: cuisine-codex-goal-workflow-v1
status: blocked-missing-target-artifacts
currentStage: post-apply-audit
currentBatchId: jazamila-cuisine-post-apply-closeout-20260812
modelVersion: GPT 5.6 Luna Max
promptVersion: cuisine-codex-agent-prompt-v1
snapshotHash: e16210237b8c9533df3b9fa0bb26dd774bcca025e31317502dae7c2ff3e3e735
targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
lastVerifiedAt: 2026-08-12T14:32:33+08:00
nextAction: 外部恢復固定 target、pre-apply backup 與原始 apply／verification artifacts 後，重新開啟本 goal；不得重跑既有 apply batch

stages:
  stage0_workspace: completed
  stage1_schema_baseline: pilot-staging-verified; default-prisma-dev-db-not-target
  stage2_deterministic: completed; restaurants=31293; needsAi=22496; activeCuisineTypes=22
  stage3_ai:
    completedRequests: 22496
    totalRequests: 22496
    remainingRequests: 0
    fullBatchCount: 227
    fullBatchRange: jazamila-cuisine-ai-pilot-20260811-002..228
    fullBatchIndexPath: /private/tmp/jazamila-cuisine-full-batch-index.json
    fullBatchIndexSha256: 30b6d548e0ecafcf75d79f8de95c31b455d7c7d476357355b45dbd79b65fc061
    fullConsolidatedPath: /private/tmp/jazamila-cuisine-ai-results-full.jsonl
    fullConsolidatedSha256: 7cd8b80388143cb59afc727ac8a4b9c55a26b960b92608217626d886153cbacd
    fullValidator: requestCount=22496; resultCount=22496; statuses=ok:22496; fingerprints=exact; invalid=0
    completedBatches:
      - batchId: jazamila-cuisine-ai-pilot-20260811-002
        offset: 0
        limit: 20
        requestCount: 20
        resultCount: 20
        valid: 20
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-002
      - batchId: jazamila-cuisine-ai-pilot-20260811-003
        offset: 20
        limit: 20
        requestCount: 20
        resultCount: 20
        valid: 20
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-003
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-003/raw-results.jsonl
        rawSha256: c09e24d4c0c96770cf37dfc0b64a8b77a0c46c74a6bd165d132d1a50ae78bb13
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-003/validated-results.jsonl
        validatedSha256: 37b3d2170f202d22badf41d4cb633d8155c18300f3b2858be4276ea3bf7498d6
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-003/validation-summary.json
        validationSummarySha256: 608d8829802c00e51d063adaf8529fd1f9ab07b2190ecb3ded4575e71246000d
        requestSha256: 45088463f36e85c714e80a4686a15ed3d9e5cbf177b2483733b79a1919aa4d6d
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-004
        offset: 40
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/raw-results.jsonl
        rawSha256: b897e12af4018f92d634efa6f030e03edba3bda2f33fe35f63695239e1e888bd
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/validated-results.jsonl
        validatedSha256: 15d8ace1bf4397872cd541b50a10fcc725bada79c47444c0f5c3f74e90a0c24f
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/validation-summary.json
        validationSummarySha256: 27e4da381f0edeccc37195e372dc1555bbe45abe11795bcd059399fecd47afa5
        requestSha256: 862954713c245c6740c878974b4fee4a61cabcece0876ae80462e93c934869ae
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-005
        offset: 140
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/raw-results.jsonl
        rawSha256: 9259322146838ab17177716dfb4ebabb9aa61df6818d81fb1ada9f5bc6d17134
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/validated-results.jsonl
        validatedSha256: 54e411f28dc6228f3db870b4add4a9990baaa5e8d309b06313b63de6c0f0ccc1
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/validation-summary.json
        validationSummarySha256: 3573601950a78f80f0c7caf75b665b2041bd7bbb3dee06e505fdc293ef51a578
        requestSha256: fbbcff79ec0b6437da7dde197fb69134a7e4faec5e9ea0f704b16434d36c54a2
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=33; candidates=1; unresolved=66; needsWebResearch=97; tagCleanup=76
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-006
        offset: 240
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/raw-results.jsonl
        rawSha256: f39aaf37178548c495aebcb60d920ed5f9c255ccfaca87e3e27f970ebcc547fe
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/validated-results.jsonl
        validatedSha256: 40a85c5febc74058a0a6534e510bb54518f3bfb044fe26eb91d61870aa6c254b
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/validation-summary.json
        validationSummarySha256: 2757fd091ba34c03adf579c968cb0cc0308fa167c2801693a7da08acc9bdf2a4
        requestSha256: b185130a80216b1c66e84a7bee193ac24ae2007a8ac2c0f3e47a54d7e75e5e0d
        manifestSha256: 739bead5f34f7e9ce2207e738906f1a70cfd823e1eef93a95e8df72617bcd7fc
        promptSha256: 1ca18a10234f65e2acabbecd1f203b492d0a310c47e6ff5f88156ebbf7c170a3
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=66; candidates=1; unresolved=33; needsWebResearch=100; tagCleanup=89
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-007
        offset: 340
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/raw-results.jsonl
        rawSha256: 9154e5f5de2cecdf7a809e32df15e34102a0c32898d81181636066e40a1eea7f
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/validated-results.jsonl
        validatedSha256: 95a87e72c224a344bd77e0451e6f92476e54d3399709636fc8f4a58d4ff2e82b
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/validation-summary.json
        validationSummarySha256: 7cb7f5d0460360509c7cdfdeee4eeccfe70e48b94b78064a01f35f05e22d1334
        requestSha256: 3c55846ee2746a25f5a3fad32ebd787e2e26312a7546dbcf74d84cf98e3701a5
        manifestSha256: 8e2e9304af15188bfbc98523731a49bd77cec37c9bf4db2e3cdfaa5aa1aff695
        promptSha256: 4b67a7e7f8d17f17bf8528b9d99d84e0aa35e04e212f820cb5bb2807873b3f9b
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=46; candidates=0; unresolved=54; needsWebResearch=100; tagCleanup=89
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-008
        offset: 440
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/raw-results.jsonl
        rawSha256: 83eb1b7ead2155591ed0433f0273fcb54e4ee65b948b4fda8a6dd8a08692d708
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/validated-results.jsonl
        validatedSha256: bdd8cdfdcf6577b9fd0a6a363bf696d9ae69a72637a85a27c2b48c677e1a6ac1
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/validation-summary.json
        validationSummarySha256: fd2f393c0daa26feba2cbc1c09571bf2d0fba30f406bcc1e9aa615d85c40da62
        requestSha256: 9cdd199c0b4b14cc7ac73cf5d1b789d529d524d6f1819db796d10d7ad96e97e0
        manifestSha256: 7a3f1e8a08ad45a25ca44e133e906c58ced8f6a4a62b49b3ac294c8acb90d9cc
        promptSha256: f39db5fcfe480086608169134ed8ce7e3fd3edd034bd032b956409a89fcef2d3
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=21; candidates=1; unresolved=78; needsWebResearch=100; tagCleanup=99
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-009
        offset: 540
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/raw-results.jsonl
        rawSha256: 843d273b31fc7200e52b8f503ca272f79aa4930e5185f88f4e9c45b60dbca27a
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/validated-results.jsonl
        validatedSha256: 1e4776a71a8e42bcf89971ea6c3d9e52c427a23c00ed8b1691144d31f06a0a44
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/validation-summary.json
        validationSummarySha256: 3d61130a3ccc21caa44e3713f37681d9180588cb23d72348435dbc9f63daa2ec
        requestSha256: a8fb84823328ff7db99fb0f01610d754c8d452de250d5f882e4ce2dc2f30e3dd
        manifestSha256: a97b8a67244d924a5c0fbb663d4c5b88b6653cfef2412e35c9cf995b766ab9dd
        promptSha256: b02a1728e379549edf98d044514f0a4bdb91bde52e28909b11e1f259463cf4b2
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=10; candidates=0; unresolved=90; needsWebResearch=100; tagCleanup=100
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-010
        offset: 640
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/raw-results.jsonl
        rawSha256: 8f4b5239723b93f95e3c2c5d9ba5bf087cf22b7bf34f999fc43cc489e90374b4
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/validated-results.jsonl
        validatedSha256: db0b69e02ab3ace6d6b59926b0c721ee60705bcaf651932eabb30f51f70dda94
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/validation-summary.json
        validationSummarySha256: 7a90fbde8914cd528c89405300f1119d5e34c9023089fff46f68fe7200813a7e
        requestSha256: c44c1968a19d4f6148bd6713c0bcd72db275667324a4849124467d9195fd5b76
        manifestSha256: 304cbfbfed058978a7a09b48bdbce6cbe66977d7d864f10d941964d3347a26db
        promptSha256: eae41f5edc99c00295283de6af183390fce8fd51222b8760df2fada5fb1f17ef
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=38; candidates=0; unresolved=62; needsWebResearch=100; tagCleanup=91
        status: validated-ok
        
      - batchId: jazamila-cuisine-ai-pilot-20260811-011
        offset: 740
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/raw-results.jsonl
        rawSha256: 73c67f09ecc5af062c656fdace79d6af2ab9a7c7052f64d11b34c6d9dc5268bb
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/validated-results.jsonl
        validatedSha256: af58f606f42a0b8935506d20a87076a6d5cc0c5779576bb9fecebc832f712df0
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/validation-summary.json
        validationSummarySha256: 106a5a242e6db0ebc5e089ea2df46eed208532ba9aa83439d20d31ee8d52e5e6
        requestSha256: 99303399c2aa533cf3ce3278e97b28d3cac425611d66b2f9d8517d2f2789c91d
        manifestSha256: c79de1fd79ba1c55182d2af25b65dad7b878eb884b770451d276c3461f8ec24d
        promptSha256: 2be30727ee10230888b281a39e3b779722b5a8fd0174d7835441173e93463cf4
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=20; candidates=0; unresolved=80; needsWebResearch=100; tagCleanup=97
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-012
        offset: 840
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-012
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-012/raw-results.jsonl
        rawSha256: a30466b779e158b2a4e9d384042ad2c4eac9a00c6b87cbfa5f6a651100bb6958
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-012/validated-results.jsonl
        validatedSha256: a24e36f4e01da8909c3d448217d4b4b61b3d4d0ad05b75204364e9db8c5e1438
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-012/validation-summary.json
        validationSummarySha256: 07859fc82d07b9eedd14c7055b926552dbfebe38c86bea90ca311eed0271db46
        requestSha256: 86b5746a32f283399766cb3bf0f306b7316aa04a5a4ab1404f8cb0d4e0095293
        manifestSha256: 62a2c810c5ffc02b84c103f027a758f850480525d8ad43211c59d33402204734
        promptSha256: ca67c154ed75a76dbd795d15e76bef7b68265f15401f5709e6936c663caa0a6d
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=22; candidates=0; unresolved=78; needsWebResearch=100; tagCleanup=95
        status: validated-ok
      - batchId: jazamila-cuisine-ai-pilot-20260811-013
        offset: 940
        limit: 100
        requestCount: 100
        resultCount: 100
        valid: 100
        invalid: 0
        artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013
        rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/raw-results.jsonl
        rawSha256: a4e4936a8a540d9a18cfb0e82ba73b479749c6a171a5cef8d74ccc261c2c8769
        validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/validated-results.jsonl
        validatedSha256: ef0641e0e3bd88ea832f821c9a64cf1e15c93748ced851b9138fceddbc9ba7c4
        validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/validation-summary.json
        validationSummarySha256: 0f7af2678011453570f1a8c92a6ab50e0bf023eefd29c0038fdbdfa2c9781546
        requestSha256: f2bc24e5cd3dcf59a097a9e262f3bc013e5ecf003e8d3bcf023c1a2e02009247
        manifestSha256: d6d9aa8216e82ca240648efae344227dfe70c2a957f1a92d07a495bd837c30cb
        promptSha256: 79f783cdb76414946bfa7478dd4d0dff3d60a65d5fdf0ad62833e0a50df028fe
        schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
        validator: validResults=100; invalidResults=0; statuses=ok:100; selected=36; candidates=0; unresolved=64; needsWebResearch=100; tagCleanup=95
        status: validated-ok
    preparedBatches: []
  stage4_web:
    pilotBatchId: jazamila-cuisine-web-pilot-20260811-001
    pilotRequests: 5
    pilotValid: 5
    pilotInvalid: 0
    pilotManifestPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/manifest.json
    pilotManifestSha256: 264daa8c03f81d9a9eb8629c83505b7328b7eb35c4a1a75621d2a4bfb60970a2
    pilotRawPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/raw-results.jsonl
    pilotRawSha256: 785fe1b1e332cabcf821235c0d478f60a225118395f909c2bdf0a6bad050c4dc
    pilotEvidencePath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/evidence.jsonl
    pilotEvidenceSha256: 7db8d4eeebae1cf4b9485348ab74397d0876537fe27538891ff4b8459080035e
    pilotValidatedPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/validated-results.jsonl
    pilotValidatedSha256: cda79d4be1912a34fbcfee08fc0d5327b3f51862be31b16e2996987b8f56a30e
    pilotValidationSummaryPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/validation-summary.json
    pilotValidationSummarySha256: 48452234026156c4b1c2cf9d5e2bbfbca2aaf079b59b9f3378accf0088df722a
    fullBatchCount: 265
    fullRequestCount: 26427
    fullResultCount: 26427
    fullBatchRange: jazamila-cuisine-web-full-20260811-001..265
    fullBatchIndexPath: /private/tmp/jazamila-cuisine-full-batch-index.json
    fullBatchIndexSha256: 30b6d548e0ecafcf75d79f8de95c31b455d7c7d476357355b45dbd79b65fc061
    fullRequestPath: /private/tmp/jazamila-cuisine-web-requests-full.jsonl
    fullRequestSha256: 7489a9bef1f4e896ad6f43af5a285e572d397fc4b748f93f6a61db6250bf69ab
    fullResultPath: /private/tmp/jazamila-cuisine-web-results-full.jsonl
    fullResultSha256: 59cfa812608a94f97dc69faf9f8973c6cc2c469a985e161c11886540cf6fe30a
    fullResultStatuses: ok=111; unresolved=26316; fingerprints=exact
    fullValidator: batches=265; validResults=26427; invalidResults=0; readOnly=true; writesDatabase=false; callsApi=false
    status: completed; full-web-reconciled
  stage5_candidate_review:
    pilotCandidates: 0
    pilotPending: 0
    pilotReviewPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/candidate-review.json
    pilotReviewSha256: 7989ddb84b9a5f420fb26ef353c8bdc3c64cf0f102cd837f115f0c1ebd625a4e
    pilotReviewVersion: cuisine-candidate-review-v1
    fullReviewPath: /private/tmp/jazamila-cuisine-candidate-review-approved.json
    fullReviewSha256: 4a1a35d8ac04f115d044bc5f0815ce398c9b27d79514093e6abf4888bee93432
    decisionPath: /private/tmp/jazamila-cuisine-candidate-decisions-auto.json
    decisionSha256: 614c810048f8b855e436923eca68099f25dac6cdfe427d213b0eb0b4dc1a5fae
    fullCandidates: 2
    fullAffectedRestaurants: 3
    fullPending: 0
    fullDecisions: approve=2; merge=0; reject=0
    status: completed; auto-approved
  stage6_target_dry_run:
    pilotReady: 5
    pilotBlocked: 0
    pilotProtected: 0
    pilotSkipped: 0
    pilotApplyChanges: 0
    pilotDryRunPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/apply-dry-run.json
    pilotDryRunSha256: e7b790f3dbad44cfcd8885e97e498e7037ea9fb4dea17b6a78a60c436726d17d
    pilotRestaurantIds: [5, 9, 12, 13, 14]
    pilotFingerprintsMatch: true
    pilotDatabase: file:/private/tmp/jazamila-staging.1BKQg6/staging.db
    pilotDatabaseSha256Before: 5e193e1f75a4e43ab6bdab3420ef07adf0de7cd6924129bc7b99f81de3f107dc
    pilotDatabaseSha256After: 5e193e1f75a4e43ab6bdab3420ef07adf0de7cd6924129bc7b99f81de3f107dc
    fullAuditPath: /private/tmp/jazamila-cuisine-full-audit-auto.json
    fullAuditSha256: cf7ce527d61fed321ab1a72ba204313793451658f1f8eeff7d9cb805e680694a
    fullAuditPass: true
    fullAuditErrors: []
    fullAuditWebErrors: 0
    targetPreflightPath: /private/tmp/jazamila-cuisine-target-preflight-auto.json
    targetPreflightSha256: 44e9d5a857e9bab66d2bbd08dc49ce1fb0efea4dcf6e0ebce2ea5c0951df1952
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    targetSha256Before: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    backupPath: /private/tmp/jazamila-cuisine-staging.sqlite.before-auto-apply-20260812.bak
    backupSha256: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    applyDryRunPath: /private/tmp/jazamila-cuisine-apply-dry-run-auto-batch.json
    applyDryRunSha256: adc27eb6c77e11f0459d472aa9c16a0308aa27af9f856fdf2b0586c3cd6e039c
    applyDryRunBatchId: jazamila-cuisine-auto-20260812-001
    applyDryRun: ready=9309; unresolved=21984; fingerprintMismatches=0; protected=0; mode=dry-run; readOnly=true; writesDatabase=false
    status: completed; apply-verified
  stage7_apply:
    status: applied
    batchId: jazamila-cuisine-auto-20260812-001
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    applyResultPath: /private/tmp/jazamila-cuisine-apply-result-auto.json
    applyResultSha256: f2aef88af7fdab8b2b32a5bd2d48078ed9eafabbcaee957badbe6c771900fe44
    applyStatus: applied
    applied: 9309
    protected: 0
    skipped: 21984
    targetSha256Before: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    targetSha256After: c72cd037e50d22d5049c1b98a2289e8ed9eafabbcaee957badbe6c771900fe44
    backupPath: /private/tmp/jazamila-cuisine-staging.sqlite.before-auto-apply-20260812.bak
    backupSha256: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    verificationPath: /private/tmp/jazamila-cuisine-apply-verification-auto.json
    verificationSha256: 078d3df152fd31068f9c7c6fc597cd713395ad0a518d53cf7caf35729d39285c
    verification: pass=true; batch=applied; changes=9309; currentSnapshotsMatchAfter=9309; validInputFingerprints=9309; manualLockedRows=0; errors=[]
    rollbackDryRunPath: /private/tmp/jazamila-cuisine-rollback-dry-run-auto.json
    rollbackDryRunSha256: 70acc5a52ea01111ffb6a22087c02baf2d4508d89cfc650044db1444fe61a2a1
    rollbackDryRun: changes=9309; readOnly=true; writesDatabase=false; executed=false
    tests: typecheck=passed; pureCuisineTests=20/20 passed; dbDependentCuisineTypes=not-rerun-to-protect-target
    statusNote: formal transaction complete; no rollback executed
  stage8_post_apply_reconciliation:
    status: blocked-missing-original-artifacts
    closeoutBatchId: jazamila-cuisine-post-apply-closeout-20260812
    closeoutSummaryPath: /private/tmp/jazamila-cuisine-post-apply-closeout-summary.json
    closeoutSummarySha256: 89a67d4a2ea5142f17820de26d5995a70f40844e88a1256861de278306065f60
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    targetExists: false
    targetOpened: false
    targetCreated: false
    originalsOverwritten: false
    artifactPath: /private/tmp/jazamila-cuisine-artifact-reconciliation-post-apply.json
    artifactSha256: da3bcc08985b25bd4247d5351305062ea8b84054c52cee0e0947d3d84c137f7c
    applyResultPath: /private/tmp/jazamila-cuisine-apply-result-auto.json
    applyVerificationPath: /private/tmp/jazamila-cuisine-apply-verification-auto.json
    shaComparison: unavailable; current apply result and verification files are absent
    historicalApplyResultSha256: f2aef88af7fdab8b2b32a5bd2d48078ed9eafabbcaee957badbe6c771900fe44
    historicalVerificationSha256: 078d3df152fd31068f9c7c6fc597cd713395ad0a518d53cf7caf35729d39285c
    note: historical hashes above are preserved from the prior Ledger only and were not re-verified
    closeoutSummaryV2Path: /private/tmp/jazamila-cuisine-post-apply-closeout-summary-v2.json
    closeoutSummaryV2Sha256: 0ee5f247a573807bc8e4d05af4327442be9022051b096506c80532aafedfe37c
  stage9_target_post_apply_audit:
    status: blocked-missing-target
    auditPath: /private/tmp/jazamila-cuisine-target-post-apply-audit-blocked.json
    auditSha256: 12a2fcdeb4ff81bf1e01cf13c18eec28f8619b2b18a7925a08d8722a93412978
    readOnly: true
    writesDatabase: false
    integrityCheck: not-run
    reason: fixed target and pre-apply backup are absent; audit runner refuses to create either SQLite file
    safetyPreflight: passed; missing target rejected before Prisma connection
    protectedTraceComparison: implemented against pre-apply backup; not-run because backup is absent
    expectedHistoricalCounts: restaurants=31293; activeCuisineTypes=24; nullCuisine=21984; tags=319; restaurantTags=59454
    nextAction: restore exact fixed target, then run scripts/audit-cuisine-target.cjs without migration or substitute database
  stage10_application_wiring:
    status: completed-in-worktree
    primaryCuisineField: Restaurant.cuisineTypeId
    legacyCompatibility: res_foodtype preserved and mapped; public URLs, cookies and Ajax response shape retained
    publicAndAdminCoverage: list/filter; detail/random/Ajax; admin edit/new/detail/list; admin foodType/tags storage
    canonicalDetailListCompatibility: passed; code-prefixed uct and canonical return-list segment covered by unit test
    publicCuisineDuplicateTagSuppression: passed; active cuisine-name tag is excluded from public auxiliary tags
    focusedLint: passed
  stage11_importer_idempotency:
    status: completed-in-worktree
    ownershipRule: source cuisine tags are hidden when superseded by an active primary CuisineType; manual/AI ownership and locks are preserved
    targetReimported: false
    isolatedIntegrationTest: passed
  stage12_isolated_verification:
    status: completed
    database: file:/private/tmp/jazamila-cuisine-isolated-test-20260812.sqlite
    databaseSha256: 743e6113d53a2351570cf078859c42958964395d5b91d882c7926d83e327790e
    npmTest: passed; files=30; tests=150
    typecheck: passed
    build: passed; command used explicit isolated DATABASE_URL
    focusedEslint: passed
    fullLint: failed; 46 pre-existing errors in unrelated scripts
    diffCheck: passed
  stage13_cleanup_batch:
    status: blocked-missing-target
    scriptPath: scripts/cleanup-cuisine-tags.cjs
    dryRun: not-run-against-fixed-target
    apply: not-run
    rollbackDryRun: not-run-against-fixed-target
    writesDatabase: false
    newCuisineTypes: 0
    tagOrSourceDeletion: 0
    nextAction: after target audit passes, run cleanup dry-run and rollback dry-run, then formal cleanup apply on fixed target only

history:
  - at: 2026-08-11T08:54:33+08:00
    stage: workflow
    status: initialized
    note: 工作流文件建立；下一步是執行已準備的 AI batch 003。
  - at: 2026-08-11T17:11:40+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-003
    offset: 20
    limit: 20
    requestCount: 20
    resultCount: 20
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-003/raw-results.jsonl
    rawSha256: c09e24d4c0c96770cf37dfc0b64a8b77a0c46c74a6bd165d132d1a50ae78bb13
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-003/validated-results.jsonl
    validatedSha256: 37b3d2170f202d22badf41d4cb633d8155c18300f3b2858be4276ea3bf7498d6
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-003/validation-summary.json
    validationSummarySha256: 608d8829802c00e51d063adaf8529fd1f9ab07b2190ecb3ded4575e71246000d
    requestSha256: 45088463f36e85c714e80a4686a15ed3d9e5cbf177b2483733b79a1919aa4d6d
    validator: validResults=20; invalidResults=0; statuses=ok:20
    nextAction: 準備並執行 offset 40 的 100 筆 AI batch；不要執行 --apply
  - at: 2026-08-11T17:12:09+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-004
    offset: 40
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/manifest.json
    manifestSha256: 4176b57b0aca7ae6131807ad9bd41aeed9ca24ed6332fe03dd2811508c4abaac
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/codex-prompt.md
    promptSha256: 4a89f7b9399be654bac6cd97477a64b4096f7577070f19a05eac32a156a8f49c
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/requests.jsonl
    requestSha256: 862954713c245c6740c878974b4fee4a61cabcece0876ae80462e93c934869ae
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: not-run
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:18:08+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-004
    offset: 40
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/raw-results.jsonl
    rawSha256: b897e12af4018f92d634efa6f030e03edba3bda2f33fe35f63695239e1e888bd
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/validated-results.jsonl
    validatedSha256: 15d8ace1bf4397872cd541b50a10fcc725bada79c47444c0f5c3f74e90a0c24f
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-004/validation-summary.json
    validationSummarySha256: 27e4da381f0edeccc37195e372dc1555bbe45abe11795bcd059399fecd47afa5
    requestSha256: 862954713c245c6740c878974b4fee4a61cabcece0876ae80462e93c934869ae
    validator: validResults=100; invalidResults=0; statuses=ok:100
    nextAction: 執行 offset 140 的 100 筆 AI batch 005；不要執行 --apply
  - at: 2026-08-11T17:18:25+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-005
    offset: 140
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/manifest.json
    manifestSha256: e5384d195e568d40de02adaa43ea97c972a19f12ab1f12215f0719e2d4c36479
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/codex-prompt.md
    promptSha256: 8df8555495b9f4235a779dc7be38a9ae6f102acd9dd8d0bb8ca3c1f5d5686eb2
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/requests.jsonl
    requestSha256: fbbcff79ec0b6437da7dde197fb69134a7e4faec5e9ea0f704b16434d36c54a2
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: not-run
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:24:32+08:00
    stage: candidate-review
    batchId: jazamila-cuisine-web-pilot-20260811-001
    requestCount: 5
    restaurantIds: [5, 9, 12, 13, 14]
    status: pilot-complete
    reviewPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/candidate-review.json
    reviewSha256: 27a3bc14fabae09c104db79bebc4f05fdcb2d28a04a079f86862f8376751a5ee
    reviewSummary: candidates=0; pending=0; readOnly=true; writesDatabase=false
    nextAction: 執行同一 5 筆的 apply dry-run；不要執行 --apply
  - at: 2026-08-11T17:24:32+08:00
    stage: target-dry-run
    batchId: jazamila-cuisine-web-pilot-20260811-001
    requestCount: 5
    resultCount: 5
    status: pilot-complete
    dryRunPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/apply-dry-run.json
    dryRunSha256: 748319f013d89025407a5df86ff5da3a98ff9317943c884ac35eb178722124c7
    database: file:/private/tmp/jazamila-staging.1BKQg6/staging.db
    databaseSha256Before: 5e193e1f75a4e43ab6bdab3420ef07adf0de7cd6924129bc7b99f81de3f107dc
    databaseSha256After: 5e193e1f75a4e43ab6bdab3420ef07adf0de7cd6924129bc7b99f81de3f107dc
    validator: ready=5; blocked=0; protected=0; skipped=0; fingerprintsMatch=true; mode=dry-run; readOnly=true; writesDatabase=false
    nextAction: 全量流程仍停在 AI batch 005；完整 AI/Web 完成後才可做 full audit 與全量 apply dry-run；不要執行 --apply
  - at: 2026-08-11T17:31:07+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-005
    offset: 140
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/raw-results.jsonl
    rawSha256: 9259322146838ab17177716dfb4ebabb9aa61df6818d81fb1ada9f5bc6d17134
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/validated-results.jsonl
    validatedSha256: 54e411f28dc6228f3db870b4add4a9990baaa5e8d309b06313b63de6c0f0ccc1
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-005/validation-summary.json
    validationSummarySha256: 3573601950a78f80f0c7caf75b665b2041bd7bbb3dee06e505fdc293ef51a578
    requestSha256: fbbcff79ec0b6437da7dde197fb69134a7e4faec5e9ea0f704b16434d36c54a2
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=33; candidates=1; unresolved=66; needsWebResearch=97; tagCleanup=76
    nextAction: 執行 offset 240 的 100 筆 AI batch 006；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:31:52+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-006
    offset: 240
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/manifest.json
    manifestSha256: 739bead5f34f7e9ce2207e738906f1a70cfd823e1eef93a95e8df72617bcd7fc
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/codex-prompt.md
    promptSha256: 1ca18a10234f65e2acabbecd1f203b492d0a310c47e6ff5f88156ebbf7c170a3
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/requests.jsonl
    requestSha256: b185130a80216b1c66e84a7bee193ac24ae2007a8ac2c0f3e47a54d7e75e5e0d
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: not-run
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:40:39+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-006
    offset: 240
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/raw-results.jsonl
    rawSha256: f39aaf37178548c495aebcb60d920ed5f9c255ccfaca87e3e27f970ebcc547fe
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/validated-results.jsonl
    validatedSha256: 40a85c5febc74058a0a6534e510bb54518f3bfb044fe26eb91d61870aa6c254b
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-006/validation-summary.json
    validationSummarySha256: 2757fd091ba34c03adf579c968cb0cc0308fa167c2801693a7da08acc9bdf2a4
    requestSha256: b185130a80216b1c66e84a7bee193ac24ae2007a8ac2c0f3e47a54d7e75e5e0d
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=66; candidates=1; unresolved=33; needsWebResearch=100; tagCleanup=89
    nextAction: 執行 offset 340 的 100 筆 AI batch 007；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:41:13+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-007
    offset: 340
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/manifest.json
    manifestSha256: 8e2e9304af15188bfbc98523731a49bd77cec37c9bf4db2e3cdfaa5aa1aff695
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/codex-prompt.md
    promptSha256: 4b67a7e7f8d17f17bf8528b9d99d84e0aa35e04e212f820cb5bb2807873b3f9b
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/requests.jsonl
    requestSha256: 3c55846ee2746a25f5a3fad32ebd787e2e26312a7546dbcf74d84cf98e3701a5
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    status: prepared
  - at: 2026-08-11T17:43:50+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-007
    offset: 340
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validator-failed; blocked
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/raw-results.jsonl
    rawSha256: 77724226e654972dbe248fe1a25763c731c6122b323cb8e977c1878e45a659e3
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/validated-results.jsonl
    validatedSha256: 7412d4e562f623d614b9c6dcd2de06ea3b76bbef2b173f213f95e26897e971fd
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/validation-summary.json
    validationSummarySha256: 0609a60bb3218eb8c9d21a9ab3eeb924742f8215766bd55f3596b22c298abe84
    requestSha256: 3c55846ee2746a25f5a3fad32ebd787e2e26312a7546dbcf74d84cf98e3701a5
    validator: validResults=98; invalidResults=2; statuses=ok:98,invalid:2; invalidRestaurantIds=[717,784]; error=CODEX_CONTRACT_INVALID cuisine-or-cuisine-item-kept-tag
    blocker: restaurantId 717 and 784 kept cuisine-like tag 素食; raw output retained; no next batch prepared
    nextAction: 先處理 batch 007 invalid raw results 並重新通過 validator；不可猜測、不可跳過、不可執行 --apply
  - at: 2026-08-11T17:46:38+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-007
    offset: 340
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/raw-results.jsonl
    rawSha256: 9154e5f5de2cecdf7a809e32df15e34102a0c32898d81181636066e40a1eea7f
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/validated-results.jsonl
    validatedSha256: 95a87e72c224a344bd77e0451e6f92476e54d3399709636fc8f4a58d4ff2e82b
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-007/validation-summary.json
    validationSummarySha256: 7cb7f5d0460360509c7cdfdeee4eeccfe70e48b94b78064a01f35f05e22d1334
    requestSha256: 3c55846ee2746a25f5a3fad32ebd787e2e26312a7546dbcf74d84cf98e3701a5
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=46; candidates=0; unresolved=54; needsWebResearch=100; tagCleanup=89
    nextAction: 準備並執行 offset 440 的 AI batch 008；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:47:59+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-008
    offset: 440
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/manifest.json
    manifestSha256: 7a3f1e8a08ad45a25ca44e133e906c58ced8f6a4a62b49b3ac294c8acb90d9cc
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/codex-prompt.md
    promptSha256: f39db5fcfe480086608169134ed8ce7e3fd3edd034bd032b956409a89fcef2d3
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/requests.jsonl
    requestSha256: 9cdd199c0b4b14cc7ac73cf5d1b789d529d524d6f1819db796d10d7ad96e97e0
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:49:35+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-008
    offset: 440
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/raw-results.jsonl
    rawSha256: 83eb1b7ead2155591ed0433f0273fcb54e4ee65b948b4fda8a6dd8a08692d708
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/validated-results.jsonl
    validatedSha256: bdd8cdfdcf6577b9fd0a6a363bf696d9ae69a72637a85a27c2b48c677e1a6ac1
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-008/validation-summary.json
    validationSummarySha256: fd2f393c0daa26feba2cbc1c09571bf2d0fba30f406bcc1e9aa615d85c40da62
    requestSha256: 9cdd199c0b4b14cc7ac73cf5d1b789d529d524d6f1819db796d10d7ad96e97e0
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=21; candidates=1; unresolved=78; needsWebResearch=100; tagCleanup=99
    nextAction: 準備並執行 offset 540 的 AI batch 009；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:50:36+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-009
    offset: 540
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/manifest.json
    manifestSha256: a97b8a67244d924a5c0fbb663d4c5b88b6653cfef2412e35c9cf995b766ab9dd
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/codex-prompt.md
    promptSha256: b02a1728e379549edf98d044514f0a4bdb91bde52e28909b11e1f259463cf4b2
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/requests.jsonl
    requestSha256: a8fb84823328ff7db99fb0f01610d754c8d452de250d5f882e4ce2dc2f30e3dd
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: not-run
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:51:42+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-009
    offset: 540
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/raw-results.jsonl
    rawSha256: 843d273b31fc7200e52b8f503ca272f79aa4930e5185f88f4e9c45b60dbca27a
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/validated-results.jsonl
    validatedSha256: 1e4776a71a8e42bcf89971ea6c3d9e52c427a23c00ed8b1691144d31f06a0a44
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-009/validation-summary.json
    validationSummarySha256: 3d61130a3ccc21caa44e3713f37681d9180588cb23d72348435dbc9f63daa2ec
    requestSha256: a8fb84823328ff7db99fb0f01610d754c8d452de250d5f882e4ce2dc2f30e3dd
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=10; candidates=0; unresolved=90; needsWebResearch=100; tagCleanup=100
    nextAction: 準備並執行 offset 640 的 AI batch 010；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T17:55:05+08:00
    stage: web
    batchId: jazamila-cuisine-web-pilot-20260811-001
    requestCount: 5
    resultCount: 5
    status: validated-ok
    artifactDir: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001
    manifestPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/manifest.json
    manifestSha256: 264daa8c03f81d9a9eb8629c83505b7328b7eb35c4a1a75621d2a4bfb60970a2
    rawPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/raw-results.jsonl
    rawSha256: 785fe1b1e332cabcf821235c0d478f60a225118395f909c2bdf0a6bad050c4dc
    evidencePath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/evidence.jsonl
    evidenceSha256: 7db8d4eeebae1cf4b9485348ab74397d0876537fe27538891ff4b8459080035e
    validatedPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/validated-results.jsonl
    validatedSha256: cda79d4be1912a34fbcfee08fc0d5327b3f51862be31b16e2996987b8f56a30e
    validationSummaryPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/validation-summary.json
    validationSummarySha256: 48452234026156c4b1c2cf9d5e2bbfbca2aaf079b59b9f3378accf0088df722a
    validator: validResults=5; invalidResults=0; statuses=ok:5
    nextAction: 執行 pilot candidate review；不要執行 --apply
  - at: 2026-08-11T17:55:09+08:00
    stage: candidate-review
    batchId: jazamila-cuisine-web-pilot-20260811-001
    requestCount: 5
    restaurantIds: [5, 9, 12, 13, 14]
    status: pilot-complete
    reviewPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/candidate-review.json
    reviewSha256: 7989ddb84b9a5f420fb26ef353c8bdc3c64cf0f102cd837f115f0c1ebd625a4e
    reviewSummary: candidates=0; pending=0; readOnly=true; writesDatabase=false
    nextAction: 執行同一 5 筆的 apply dry-run；不要執行 --apply
  - at: 2026-08-11T17:56:21+08:00
    stage: target-dry-run
    batchId: jazamila-cuisine-web-pilot-20260811-001
    requestCount: 5
    resultCount: 5
    status: pilot-complete
    dryRunPath: /private/tmp/jazamila-codex-runs/web-pilot-20260811-001/apply-dry-run.json
    dryRunSha256: e7b790f3dbad44cfcd8885e97e498e7037ea9fb4dea17b6a78a60c436726d17d
    database: file:/private/tmp/jazamila-staging.1BKQg6/staging.db
    databaseSha256Before: 5e193e1f75a4e43ab6bdab3420ef07adf0de7cd6924129bc7b99f81de3f107dc
    databaseSha256After: 5e193e1f75a4e43ab6bdab3420ef07adf0de7cd6924129bc7b99f81de3f107dc
    validator: ready=5; blocked=0; protected=0; skipped=0; fingerprintsMatch=true; mode=dry-run; readOnly=true; writesDatabase=false
    nextAction: 準備並執行 offset 640 的 AI batch 010；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T18:00:02+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-010
    offset: 640
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/manifest.json
    manifestSha256: 304cbfbfed058978a7a09b48bdbce6cbe66977d7d864f10d941964d3347a26db
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/codex-handoff-prompt.md
    promptSha256: eae41f5edc99c00295283de6af183390fce8fd51222b8760df2fada5fb1f17ef
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/requests.jsonl
    requestSha256: c44c1968a19d4f6148bd6713c0bcd72db275667324a4849124467d9195fd5b76
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: not-run
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T18:05:22+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-010
    offset: 640
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/raw-results.jsonl
    rawSha256: 8f4b5239723b93f95e3c2c5d9ba5bf087cf22b7bf34f999fc43cc489e90374b4
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/validated-results.jsonl
    validatedSha256: db0b69e02ab3ace6d6b59926b0c721ee60705bcaf651932eabb30f51f70dda94
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-010/validation-summary.json
    validationSummarySha256: 7a90fbde8914cd528c89405300f1119d5e34c9023089fff46f68fe7200813a7e
    requestSha256: c44c1968a19d4f6148bd6713c0bcd72db275667324a4849124467d9195fd5b76
    manifestSha256: 304cbfbfed058978a7a09b48bdbce6cbe66977d7d864f10d941964d3347a26db
    promptSha256: eae41f5edc99c00295283de6af183390fce8fd51222b8760df2fada5fb1f17ef
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=38; candidates=0; unresolved=62; needsWebResearch=100; tagCleanup=91
    nextAction: 準備並執行 offset 740 的 AI batch 011；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T18:08:11+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-011
    offset: 740
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/manifest.json
    manifestSha256: c79de1fd79ba1c55182d2af25b65dad7b878eb884b770451d276c3461f8ec24d
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/codex-prompt.md
    promptSha256: 2be30727ee10230888b281a39e3b779722b5a8fd0174d7835441173e93463cf4
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/requests.jsonl
    requestSha256: 99303399c2aa533cf3ce3278e97b28d3cac425611d66b2f9d8517d2f2789c91d
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: not-run
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T18:12:58+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-011
    offset: 740
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/raw-results.jsonl
    rawSha256: 73c67f09ecc5af062c656fdace79d6af2ab9a7c7052f64d11b34c6d9dc5268bb
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/validated-results.jsonl
    validatedSha256: af58f606f42a0b8935506d20a87076a6d5cc0c5779576bb9fecebc832f712df0
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-011/validation-summary.json
    validationSummarySha256: 106a5a242e6db0ebc5e089ea2df46eed208532ba9aa83439d20d31ee8d52e5e6
    requestSha256: 99303399c2aa533cf3ce3278e97b28d3cac425611d66b2f9d8517d2f2789c91d
    manifestSha256: c79de1fd79ba1c55182d2af25b65dad7b878eb884b770451d276c3461f8ec24d
    promptSha256: 2be30727ee10230888b281a39e3b779722b5a8fd0174d7835441173e93463cf4
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=20; candidates=0; unresolved=80; needsWebResearch=100; tagCleanup=97
    nextAction: 準備並執行 offset 840 的 AI batch 012；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T18:16:58+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-012
    offset: 840
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-012/raw-results.jsonl
    rawSha256: a30466b779e158b2a4e9d384042ad2c4eac9a00c6b87cbfa5f6a651100bb6958
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-012/validated-results.jsonl
    validatedSha256: a24e36f4e01da8909c3d448217d4b4b61b3d4d0ad05b75204364e9db8c5e1438
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-012/validation-summary.json
    validationSummarySha256: 07859fc82d07b9eedd14c7055b926552dbfebe38c86bea90ca311eed0271db46
    requestSha256: 86b5746a32f283399766cb3bf0f306b7316aa04a5a4ab1404f8cb0d4e0095293
    manifestSha256: 62a2c810c5ffc02b84c103f027a758f850480525d8ad43211c59d33402204734
    promptSha256: ca67c154ed75a76dbd795d15e76bef7b68265f15401f5709e6936c663caa0a6d
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=22; candidates=0; unresolved=78; needsWebResearch=100; tagCleanup=95
    nextAction: 準備並執行 offset 940 的 AI batch 013；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T18:17:44+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-013
    offset: 940
    limit: 100
    requestCount: 100
    status: prepared
    artifactDir: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013
    manifestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/manifest.json
    manifestSha256: d6d9aa8216e82ca240648efae344227dfe70c2a957f1a92d07a495bd837c30cb
    promptPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/codex-prompt.md
    promptSha256: 79f783cdb76414946bfa7478dd4d0dff3d60a65d5fdf0ad62833e0a50df028fe
    requestPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/requests.jsonl
    requestSha256: f2bc24e5cd3dcf59a097a9e262f3bc013e5ecf003e8d3bcf023c1a2e02009247
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: not-run
    nextAction: 執行 manifest 指定的 100 筆 AI request；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-11T18:20:08+08:00
    stage: ai
    batchId: jazamila-cuisine-ai-pilot-20260811-013
    offset: 940
    limit: 100
    requestCount: 100
    resultCount: 100
    status: validated-ok
    rawPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/raw-results.jsonl
    rawSha256: a4e4936a8a540d9a18cfb0e82ba73b479749c6a171a5cef8d74ccc261c2c8769
    validatedPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/validated-results.jsonl
    validatedSha256: ef0641e0e3bd88ea832f821c9a64cf1e15c93748ced851b9138fceddbc9ba7c4
    validationSummaryPath: /private/tmp/jazamila-codex-runs/ai-pilot-20260811-013/validation-summary.json
    validationSummarySha256: 0f7af2678011453570f1a8c92a6ab50e0bf023eefd29c0038fdbdfa2c9781546
    requestSha256: f2bc24e5cd3dcf59a097a9e262f3bc013e5ecf003e8d3bcf023c1a2e02009247
    manifestSha256: d6d9aa8216e82ca240648efae344227dfe70c2a957f1a92d07a495bd837c30cb
    promptSha256: 79f783cdb76414946bfa7478dd4d0dff3d60a65d5fdf0ad62833e0a50df028fe
    schemaSha256: 39005a13a20531c7c6d2468a3dce7e0a949b49bb1f6087c4c771f64f8b1686f4
    validator: validResults=100; invalidResults=0; statuses=ok:100; selected=36; candidates=0; unresolved=64; needsWebResearch=100; tagCleanup=95
    nextAction: 準備並執行 offset 1040 的 AI batch 014；不可使用網路、API 或 SQLite；不要執行 --apply
  - at: 2026-08-12T00:17:05+08:00
    stage: reconciliation
    batchId: jazamila-cuisine-full-reconciliation-20260812
    requestCount: 48923
    resultCount: 48923
    status: awaiting-human-review
    batchIndexPath: /private/tmp/jazamila-cuisine-full-batch-index.json
    batchIndexSha256: 30b6d548e0ecafcf75d79f8de95c31b455d7c7d476357355b45dbd79b65fc061
    aiRequestCount: 22496
    aiResultCount: 22496
    aiResultPath: /private/tmp/jazamila-cuisine-ai-results-full.jsonl
    aiResultSha256: 7cd8b80388143cb59afc727ac8a4b9c55a26b960b92608217626d886153cbacd
    aiValidator: statuses=ok:22496; invalid=0; fingerprints=exact
    webBatchCount: 265
    webRequestCount: 26427
    webResultCount: 26427
    webRequestPath: /private/tmp/jazamila-cuisine-web-requests-full.jsonl
    webRequestSha256: 7489a9bef1f4e896ad6f43af5a285e572d397fc4b748f93f6a61db6250bf69ab
    webResultPath: /private/tmp/jazamila-cuisine-web-results-full.jsonl
    webResultSha256: 59cfa812608a94f97dc69faf9f8973c6cc2c469a985e161c11886540cf6fe30a
    webValidator: batches=265; validResults=26427; invalidResults=0; statuses=ok=111, unresolved=26316; fingerprints=exact
    candidateReviewPath: /private/tmp/jazamila-cuisine-candidate-review.json
    candidateReviewSha256: 377715fa952780934ae282d088caa2fa46f4ae4aece3cf160a0e3cf7f764fa50
    candidateReview: candidates=2; affectedRestaurants=3; pending=2; approve=0; merge=0; reject=0
    auditPath: /private/tmp/jazamila-cuisine-full-audit.json
    auditSha256: a5c404b027dc7a1960e3c40295ed86909e8fbabe1f9c3934ef5804a65a78f537
    audit: pass=false; errors=1; error=candidate review has pending candidates; webErrors=0; readOnly=true; writesDatabase=false
    blocker: 等待人工 candidate 決策；targetDatabase 仍是 awaiting-explicit-target-staging-url；未執行 full apply dry-run；未執行 --apply
    nextAction: 人工決定 2 個 candidate 後重新產生 review／full audit；再確認 target schema、backup 與 URL，才可執行 apply dry-run
  - at: 2026-08-12T00:19:15+08:00
    stage: candidate-review
    batchId: jazamila-cuisine-full-reconciliation-20260812
    status: blocked
    candidateReviewPath: /private/tmp/jazamila-cuisine-candidate-review.json
    candidateReviewSha256: 377715fa952780934ae282d088caa2fa46f4ae4aece3cf160a0e3cf7f764fa50
    candidateReview: candidates=2; affectedRestaurants=3; pending=2; approve=0; merge=0; reject=0
    targetDatabase: awaiting-explicit-target-staging-url
    targetEnvironment: CUISINE_TARGET_DATABASE_URL=<unset>; no new explicit target path found
    auditPath: /private/tmp/jazamila-cuisine-full-audit.json
    auditSha256: a5c404b027dc7a1960e3c40295ed86909e8fbabe1f9c3934ef5804a65a78f537
    audit: pass=false; error=candidate review has pending candidates; webErrors=0
    blocker: 同一 candidate／target gate 已連續三次恢復檢查仍未解除；不得猜測決策或 target；未執行 apply dry-run／--apply
    nextAction: 等待人工提供兩個 candidate 的 approve／merge／reject 決策與實際 target staging URL；收到後重新驗證 review、audit、schema、backup 與 fingerprint
  - at: 2026-08-12T00:37:57+08:00
    stage: candidate-review
    batchId: jazamila-cuisine-full-reconciliation-20260812
    status: blocked
    candidateReviewPath: /private/tmp/jazamila-cuisine-candidate-review.json
    candidateReviewSha256: 377715fa952780934ae282d088caa2fa46f4ae4aece3cf160a0e3cf7f764fa50
    candidateReview: candidates=2; affectedRestaurants=3; pending=2; approve=0; merge=0; reject=0
    targetDatabase: awaiting-explicit-target-staging-url
    targetEnvironment: CUISINE_TARGET_DATABASE_URL=<unset>
    auditPath: /private/tmp/jazamila-cuisine-full-audit.json
    auditPass: false
    auditErrors: candidate review has pending candidates
    blocker: resume cycle 內第三次相同 gate 未解除；未執行 candidate decision、target validation、apply dry-run 或 --apply
    nextAction: 等待實際 candidate decisions 與 target staging URL；收到後才可重新開啟 goal
  - at: 2026-08-12T01:15:50+08:00
    stage: policy
    batchId: jazamila-cuisine-auto-20260812-001
    status: auto-policy-enabled
    note: current goal explicitly supplied approve for 客家料理／西班牙料理, fixed target, and direct apply authorization; safety gates retained
    nextAction: full audit passed; target preflight passed; apply dry-run passed; execute formal apply
  - at: 2026-08-12T01:15:50+08:00
    stage: candidate-review
    batchId: jazamila-cuisine-auto-20260812-001
    requestCount: 3
    resultCount: 3
    status: validated-ok; auto-approved
    decisionPath: /private/tmp/jazamila-cuisine-candidate-decisions-auto.json
    decisionSha256: 614c810048f8b855e436923eca68099f25dac6cdfe427d213b0eb0b4dc1a5fae
    reviewPath: /private/tmp/jazamila-cuisine-candidate-review-approved.json
    reviewSha256: 4a1a35d8ac04f115d044bc5f0815ce398c9b27d79514093e6abf4888bee93432
    reviewSummary: candidates=2; affectedRestaurants=3; pending=0; approve=2; merge=0; reject=0
    nextAction: full audit
  - at: 2026-08-12T01:15:50+08:00
    stage: audit
    batchId: jazamila-cuisine-auto-20260812-001
    status: pass
    auditPath: /private/tmp/jazamila-cuisine-full-audit-auto.json
    auditSha256: cf7ce527d61fed321ab1a72ba204313793451658f1f8eeff7d9cb805e680694a
    nextAction: target preflight and apply dry-run passed
  - at: 2026-08-12T01:15:50+08:00
    stage: target-dry-run
    batchId: jazamila-cuisine-auto-20260812-001
    requestCount: 31293
    resultCount: 31293
    status: ready-to-apply
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    targetPreflightPath: /private/tmp/jazamila-cuisine-target-preflight-auto.json
    targetPreflightSha256: 44e9d5a857e9bab66d2bbd08dc49ce1fb0efea4dcf6e0ebce2ea5c0951df1952
    targetSha256Before: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    backupPath: /private/tmp/jazamila-cuisine-staging.sqlite.before-auto-apply-20260812.bak
    backupSha256: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    dryRunPath: /private/tmp/jazamila-cuisine-apply-dry-run-auto-batch.json
    dryRunSha256: adc27eb6c77e11f0459d472aa9c16a0308aa27af9f856fdf2b0586c3cd6e039c
    validator: ready=9309; unresolved=21984; fingerprintMismatches=0; protected=0; readOnly=true; writesDatabase=false
    nextAction: execute formal --apply transaction
  - at: 2026-08-12T01:17:00+08:00
    stage: apply
    batchId: jazamila-cuisine-auto-20260812-001
    status: applied
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    resultPath: /private/tmp/jazamila-cuisine-apply-result-auto.json
    resultSha256: f2aef88af7fdab8b2b32a5bd2d48078ed9eafabbcaee957badbe6c771900fe44
    result: mode=apply; readOnly=false; writesDatabase=true; applied=9309; protected=0; skipped=21984; errors=[]
    targetSha256Before: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    targetSha256After: c72cd037e50d22d5049c1b98a2289e8ed9eafabbcaee957badbe6c771900fe44
    backupPath: /private/tmp/jazamila-cuisine-staging.sqlite.before-auto-apply-20260812.bak
    backupSha256: 4b416295f3140f99f2046ca388cdabe994851689c4e3e4bb6968e16384a281ff
    nextAction: 唯讀驗證與 rollback dry-run
  - at: 2026-08-12T01:19:13+08:00
    stage: verification
    batchId: jazamila-cuisine-auto-20260812-001
    status: pass
    verificationPath: /private/tmp/jazamila-cuisine-apply-verification-auto.json
    verificationSha256: 078d3df152fd31068f9c7c6fc597cd713395ad0a518d53cf7caf35729d39285c
    targetCounts: restaurants=31293; activeCuisineTypes=24; tags=319; restaurantTags=59454; nullCuisine=21984
    candidateCuisineTypes: 西班牙料理(id=23,count=2); 客家料理(id=24,count=1); status=active; createdBy=manual
    audit: changes=9309; actionStatus=applied:9309/protected:0; decisionStatus=selected:9306/create-candidate:3; currentSnapshotsMatchAfter=9309; validInputFingerprints=9309; manualLockedRows=0
    rollbackDryRunPath: /private/tmp/jazamila-cuisine-rollback-dry-run-auto.json
    rollbackDryRunSha256: 70acc5a52ea01111ffb6a22087c02baf2d4508d89cfc650044db1444fe61a2a1
    rollback: dry-run=pass; changes=9309; readOnly=true; writesDatabase=false; executed=false
    tests: typecheck=passed; pureCuisineTests=20/20 passed; cuisine-types-db-dependent=failed because local test.db lacks r_cuisine_type, not target-related; no target write
    errors: []
    nextAction: 本 batch 已完成；保留 backup 與 rollback dry-run，後續需新 goal 才能進行其他 apply
  - at: 2026-08-12T14:16:13+08:00
    stage: reconciliation
    batchId: jazamila-cuisine-post-apply-closeout-20260812
    status: blocked-missing-original-artifacts
    closeoutSummaryPath: /private/tmp/jazamila-cuisine-post-apply-closeout-summary.json
    closeoutSummarySha256: 89a67d4a2ea5142f17820de26d5995a70f40844e88a1256861de278306065f60
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    targetExists: false
    artifactPath: /private/tmp/jazamila-cuisine-artifact-reconciliation-post-apply.json
    artifactSha256: da3bcc08985b25bd4247d5351305062ea8b84054c52cee0e0947d3d84c137f7c
    applyVerificationVsApplyResult: unavailable; current result and verification files are absent
    originalsOverwritten: false
    nextAction: 恢復原始 artifacts 後比較 SHA；不可重跑既有 apply batch
  - at: 2026-08-12T14:16:13+08:00
    stage: target-post-apply-audit
    batchId: jazamila-cuisine-post-apply-closeout-20260812
    status: blocked
    auditPath: /private/tmp/jazamila-cuisine-target-post-apply-audit-blocked.json
    auditSha256: 12a2fcdeb4ff81bf1e01cf13c18eec28f8619b2b18a7925a08d8722a93412978
    readOnly: true
    writesDatabase: false
    reason: 固定 target 不存在；為避免 SQLite 建立新檔，未執行 audit
    nextAction: 恢復 exact target 後執行完整唯讀 post-apply audit
  - at: 2026-08-12T14:16:13+08:00
    stage: application-wiring
    batchId: jazamila-cuisine-post-apply-closeout-20260812
    status: completed-in-worktree
    primaryField: Restaurant.cuisineTypeId
    legacyCompatibility: res_foodtype／public URLs／cookies／Ajax response shape preserved
    focusedLint: passed
  - at: 2026-08-12T14:16:13+08:00
    stage: importer-idempotency
    batchId: jazamila-cuisine-post-apply-closeout-20260812
    status: completed-in-worktree
    targetReimported: false
    ownershipAndManualLockTest: passed on isolated database
    nextAction: target cleanup remains pending until fixed target is restored
  - at: 2026-08-12T14:16:13+08:00
    stage: isolated-verification
    batchId: jazamila-cuisine-post-apply-closeout-20260812
    status: passed
    database: file:/private/tmp/jazamila-cuisine-isolated-test-20260812.sqlite
    databaseSha256: e6de4bd9eefdfc0dbb9539e6fd09c62a793f1e337e46e37c072e87de61db1fd5
    npmTest: passed; files=30; tests=148
    typecheck: passed
    build: passed; explicit isolated DATABASE_URL
    focusedEslint: passed
    fullLint: failed; 46 unrelated pre-existing script errors
    diffCheck: passed
  - at: 2026-08-12T14:16:13+08:00
    stage: cleanup
    batchId: jazamila-cuisine-cleanup-post-apply-20260812
    status: blocked-missing-target
    scriptPath: scripts/cleanup-cuisine-tags.cjs
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    dryRun: not-run
    apply: not-run
    rollbackDryRun: not-run
    reason: fixed target missing; no target or substitute SQLite was opened
    nextAction: target post-apply audit pass後，執行 cleanup dry-run、rollback dry-run、formal cleanup apply 與 post-apply audit
  - at: 2026-08-12T14:27:34+08:00
    stage: implementation-and-verification
    batchId: jazamila-cuisine-post-apply-closeout-20260812
    status: completed-in-worktree
    closeoutSummaryPath: /private/tmp/jazamila-cuisine-post-apply-closeout-summary-v2.json
    closeoutSummarySha256: 0ee5f247a573807bc8e4d05af4327442be9022051b096506c80532aafedfe37c
    changes: canonical detail/list CuisineType token compatibility; public duplicate cuisine tag suppression; target-audit backup/source-trace gate; cleanup missing-target safety gate; unclassified and ownership audit statistics
    typecheck: passed
    focusedEslint: passed
    npmTest: passed; files=30; tests=150
    build: passed; explicit isolated DATABASE_URL
    isolatedDatabase: file:/private/tmp/jazamila-cuisine-isolated-test-20260812.sqlite
    isolatedDatabaseSha256: 743e6113d53a2351570cf078859c42958964395d5b91d882c7926d83e327790e
    targetAuditSmoke: expected-fail on isolated non-target; integrity_check=ok; protectedTraceComparison=pass; target count/batch assertions failed
    targetAuditSafety: missing fixed target rejected without SQLite creation
    cleanupSafety: missing fixed target rejected without SQLite creation
    nextAction: restore exact target and backup before running target audit or cleanup
  - at: 2026-08-12T14:32:33+08:00
    stage: blocked-audit
    batchId: jazamila-cuisine-post-apply-closeout-20260812
    status: blocked-missing-target-artifacts
    consecutiveBlockerChecks: 3
    targetDatabase: file:/private/tmp/jazamila-cuisine-staging.sqlite
    missingTarget: true
    missingArtifacts: [ai-results, web-results, batch-index, apply-result, apply-verification, rollback-dry-run, pre-apply-backup]
    targetOpened: false
    targetCreated: false
    targetModified: false
    reason: 同一固定 target／原始 artifacts 缺失條件已連續三個 goal turns 未解除；無法在不猜測或建立替代 SQLite 的前提下完成 reconciliation、target audit 或 cleanup apply
    nextAction: external state must restore the exact target and listed artifacts before this goal can resume
```
