# `docs/res_data` SQLite 匯入流程

本流程把 `docs/res_data/*.json` 匯入既有 `r_restaurant`，保留舊版 `res_price`、`res_foodtype`、`res_region`、`res_section`、整數營業時間與公開 URL/API 契約，同時將完整資料存入新增欄位與 reference/relation tables。

## 指令

先同步 Prisma schema，再執行不寫入資料庫的檢查：

```bash
npm run db:push
npm run db:import:res-data:dry
```

一般 idempotent upsert：

```bash
npm run db:import:res-data
```

開發階段若要清除原餐廳後重建（會連帶刪除該餐廳的 blog links）：

```bash
node scripts/import-res-data-to-sqlite.cjs --replace
```

若要移除已不在 JSON 中、且由此匯入器建立的舊資料：

```bash
node scripts/import-res-data-to-sqlite.cjs --prune
```

完整隔離資料可輸出成 JSON；CLI 畫面只顯示摘要與前 12 筆，不會傾倒全部 payload：

```bash
node scripts/import-res-data-to-sqlite.cjs --dry-run --report /tmp/res-data-import-report.json
```

若 JSON 的城市／行政區集合有變動，先更新並檢查舊式數字 lookup：

```bash
npm run db:sync:res-data-lookups
npm run db:check:res-data-lookups
```

## 身分鍵與去重

- `source_id` 只保留來源追蹤用途，刻意不設 unique。
- `import_key` 是 `res-data:v2:` 加上 JSON 內全域唯一且不隨店名／地址修正的資料集 `id` SHA-256；`source_id`、檔名、店名與地址都不參與此鍵。
- 匯入器會拒收重複的資料集 `id`。既有 `res-data:v1` 內容衍生鍵會依 `source_refs_json[].id` 原地遷移至 v2，保留既有餐廳 row id 與關聯。
- 地址正規化會移除郵遞區號與重複的縣市／行政區前綴，再以 reference table 的標準名稱重建；門牌中的 `-`、`/` 會保留，避免把 `31-1 號` 誤併為 `311 號`。
- 正規化後店名＋地址相同的來源會全域合併；料理 tags、評論摘要與來源 references 取 union，其餘欄位以地區一致、可用欄位較完整、評論數較高的資料優先。
- 名稱不同但「正規化完整地址＋純數字電話」完全相同時一律合併。名稱決策記錄於 `docs/res-data-dedupe-decisions.json`，保留來源名稱、查詢式、證據 URL、查核日與信心等級；`verified` 採反查名稱，`fallback` 則在公開證據不足時採來源中的保守名稱。
- 同名同電話但地址不同不自動合併，兩筆都保留並以 `POTENTIAL_DUPLICATE` 寫入 `r_restaurant_import_issue` 等待人工確認。

## 原子性與人工維護保護

- 城市、行政區、tags、餐廳、餐廳-tag 關聯、隔離問題與 prune 全部包含在同一個 SQLite transaction；任一後段寫入失敗會回滾整批。
- 管理後台修改匯入餐廳時，實際變動欄位會記錄在 `manual_override_fields`。後續重匯仍更新來源追蹤與未人工修改欄位，但保留已人工接管的名稱、電話、地區、地址、料理、價格、備註、圖片與公開／關閉狀態。
- `--replace` 仍是明確的破壞性重建指令，不保留人工覆寫；一般更新應使用預設 upsert，必要時搭配 `--prune`。

## 驗證與隔離

- 必填：`id`、`name`、`address`、有效的價位上下限，以及可由地址唯一判定的城市／行政區。
- 地址是地區真值來源；`collection.city/district` 錯置但地址可唯一判定時會自動校正。通訊地／營登地址不覆蓋前面的實體店址。
- 地址同時包含兩個同等可能的行政區時以 `LOCATION_CONFLICT` 拒收，不猜測。
- 預設每人價位上限超過 NT$10,000 以 `PRICE_OUTLIER` 拒收；可用 `--max-price` 明確調整門檻。
- 電話、圖片、評分與營業時間允許為空。非空但格式無效時會清成 null 並列為待確認。
- 圖片只在 `image_usage_status=no_explicit_prohibition_found` 且為 HTTP(S) URL 時存入 `external_image_url`。包含 `undefined`、`null`、`none`、`n/a` 路徑片段的來源 sentinel URL 一律視為沒有圖片，不寫入 `external_image_url` 或舊原圖欄位。

## 評論摘要品質規則

- 原始 `docs/res_data/*.json` 保持不變，清理只發生在匯入階段，避免失去來源追溯能力。
- 沒有有效評分的資料不匯入評論摘要，避免把「未提供評分／評論」等來源說明誤當成評論。
- 移除來源模板、評分／評論數描述、只重複餐廳名稱、上一頁／下一頁、版權／導覽、網址，以及正規化後少於 8 個字的低訊號內容。
- 同一餐廳內與同一店家的跨來源資料都以正規化文字去重；同一段摘要若出現在 2 間以上不同餐廳，視為跨店污染並全部排除。同一店的跨檔重複先依穩定 `import_key` 歸為同一間，因此不會觸發跨店規則。
- 每間餐廳最多保留 4 則摘要；每一類移除數量都寫入匯入報告的 `reviewSummaryQuality`，方便追蹤規則影響。
- 這些規則是保守的確定性清理。只出現在單一餐廳、但語意上仍不相關的文字，仍可能需要人工抽查；過短但有效的評論也可能被排除。

## 舊欄位相容策略

- `res_price`：價位上下限中點；100 元以下以 10 元、其餘以 100 元為單位取整。完整值另存 `res_price_min/max`。
- `res_foodtype`：由 tags 映射至原有日式／美式／義式／小吃代碼；「小吃」只接受明確含「小吃」的料理 tag，不再把早餐、咖啡、甜點、火鍋、燒肉或一般台式料理折疊成小吃。無可靠映射時為 0，所有原始料理分類仍完整寫入 `r_tag` 與 `r_restaurant_tag`。
- `res_open_time/res_close_time`：由 `HH:MM` 轉成舊式 `HHMM` 整數；原字串另存新欄位。
- `res_region/res_section`：保留既有台北／新北代碼，其他地區使用固定 lookup；完整關聯另存 `city_id/district_id`。
- 外部圖不塞進原本以本機檔名為語意的 `res_img_url`，而是存入 `external_image_url`，避免破壞既有 `/assets/pics/...` 路徑。

## 2026-08-10 嚴格去重後本機匯入結果

- 170 個 JSON、31,660 筆來源資料。
- 31,293 筆唯一餐廳寫入 `r_restaurant`，共移除 355 筆：103 筆同名同地址重複，以及 245 組同地址同電話重複中的 252 筆多餘資料。
- 245 組名稱衝突均已反查並留下單一名稱；153 組有可直接對應的公開證據，92 組因查無可靠現況標為 `fallback`，未冒充已確認。
- 嚴格去重初次套用時新增 3,122 筆、更新 28,171 筆，並以 `--prune` 移除 3,384 筆舊匯入鍵資料；本次 31,293 筆 v1→v2 key 全數原地遷移，新增 0 筆、移除 0 筆，最終 imported rows 為 31,293。
- 12 筆拒收：8 筆地區衝突、4 筆異常價位。
- 134 筆待確認：67 組同名同電話但地址不同；這些可能是分店或共用電話，沒有因「嚴格」而誤刪。
- 9 城市、170 行政區、319 tags、59,454 筆餐廳-tag 關聯。
- 最終資料中同地址同電話重複、同名同地址重複、重複縣市／行政區前綴、地址地區前綴不符均為 0。
- 來源中的 490 筆 `https://www.fonfood.com/store/undefined` 無效圖片網址已在匯入階段清除；去重後對應的 481 筆資料庫欄位均改為 null，公開 UI 使用共用預設餐廳圖。
- 評論摘要由 100,088 則清理為 27,159 則，7,570 間餐廳保留摘要，單店最多 4 則。
- 小吃篩選由明確含「小吃」的 tags 判定，共 3,092 間；其中 3,069 間同步寫入舊式 `res_foodtype=4`，匯入資料中 `res_foodtype=4` 但沒有小吃 tag 的筆數為 0。

完整本次結果見 `docs/res-data-import-report.json`。
