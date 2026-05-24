# Next.js SQLite Production DB 與資料遷移規劃

## 1. 目標

將 repository root 統一為 SQLite-first persistence：development、test、production 都使用同一份 Prisma SQLite schema。

本方案適合 JAZAMILA 目前的使用情境：

- 資料量小。
- 寫入頻率低。
- 主要功能是餐廳瀏覽、投稿、回饋與後台審核。
- 希望部署與維運保持輕量。

## 2. 檔案

- SQLite Prisma schema: `prisma/schema.prisma`
- Production env 範本: `.env.production.example`
- SQLite 建檔工具: `prisma/ensure-sqlite.cjs`
- Local seed: `prisma/seed.cjs`
- Legacy MySQL 匯入 SQLite script: `scripts/import-legacy-mysql-to-sqlite.cjs`

## 3. Production SQLite 注意事項

SQLite production 可以用，但部署型態很重要。

適合：

- 單一 Node.js server。
- VPS、bare metal、Docker with persistent volume。
- Litestream/rclone/cron 做 DB 備份。

不適合：

- Vercel serverless。
- 多個 app instances 同時寫入同一份 DB。
- 沒有 persistent filesystem 的平台。

建議 production DB path：

```env
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite"
```

`/var/lib/jazamila` 必須是 persistent volume，並且 Node process 有讀寫權限。

## 4. Production 初始化流程

```bash
cp .env.production.example .env.production
```

設定 `.env.production`：

```env
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite"
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy"
```

建立 SQLite 檔案與 schema：

```bash
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" npm run db:push:prod
```

若是全新站可 seed：

```bash
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" npm run db:seed
```

若是從 legacy 匯入，不要先 seed，直接執行 import。

## 5. Legacy MySQL 匯入 SQLite

先 dry-run：

```bash
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" \
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy" \
  npm run db:import:legacy:dry
```

正式匯入：

```bash
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" \
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy" \
  npm run db:import:legacy
```

匯入 script 會清空目標 SQLite 中的：

- `r_bloglink`
- `r_feedback`
- `r_post`
- `r_restaurant`

再從 legacy MySQL 依表匯入。

## 6. 欄位對照

SQLite schema 保留既有 table names：

- `r_restaurant`
- `r_post`
- `r_bloglink`
- `r_feedback`

Prisma 欄位透過 `@map` 對應舊欄位，例如：

- `Restaurant.name` -> `res_name`
- `Restaurant.region` -> `res_region`
- `BlogLink.restaurantId` -> `b_res_id`
- `Feedback.timeUnix` -> `f_time`

完整對照以 `prisma/schema.prisma` 為準。

## 7. 校驗

匯入後至少檢查：

- 每張表 row count 是否一致。
- `/listdata/0/0/0/0/1` 是否顯示資料。
- `/detail/{id}` 是否能開啟 legacy 餐廳。
- `/jsonapi` 是否回傳資料。
- 食記是否出現在餐廳詳細頁。
- 投稿與回饋是否能新增。
- 後台列表是否能讀取資料。

SQLite CLI 檢查範例：

```bash
sqlite3 /var/lib/jazamila/jazamila.sqlite "SELECT COUNT(*) FROM r_restaurant;"
sqlite3 /var/lib/jazamila/jazamila.sqlite "SELECT id, res_name FROM r_restaurant ORDER BY id LIMIT 10;"
```

## 8. 備份策略

最低限度：

```bash
sqlite3 /var/lib/jazamila/jazamila.sqlite ".backup '/backups/jazamila-$(date +%Y%m%d-%H%M%S).sqlite'"
```

建議：

- 每日 DB backup。
- 部署前 backup。
- 匯入前 backup。
- 至少保留 7-14 天。
- 若可行，使用 Litestream 將 SQLite WAL 備份到 S3/R2。

## 9. 切換 runbook 草稿

1. 確認 production host 有 persistent volume。
2. 建立 `/var/lib/jazamila` 並設定權限。
3. 設定 `.env.production`。
4. 執行 `db:push:prod`。
5. 對 legacy DB 執行 dry-run。
6. 暫停 legacy 寫入。
7. 備份 legacy DB 與 uploads/assets。
8. 執行正式 import。
9. 執行 smoke tests。
10. 啟動 Next.js production server。
11. 切換 DNS/reverse proxy。
12. 觀察 logs。
13. 保留 legacy read-only fallback 至少一個 release cycle。

## 10. 後續事項

- 圖片檔案仍需正式備份/搬遷策略。
- 若未來流量或寫入增加，再評估切回 MySQL/PostgreSQL。
- 若部署到 serverless，SQLite 應改為 Turso/LibSQL、D1，或改用外部 DB。
