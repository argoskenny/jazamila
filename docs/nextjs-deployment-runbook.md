# JAZAMILA Next.js 部署 Runbook

## 1. 目的

本文件定義 repository root 的 staging / production 部署流程、環境變數、SQLite 資料庫初始化、legacy import、健康檢查、備份與 rollback plan。

本專案目前採用 SQLite-first production 方案。部署目標必須提供 persistent filesystem，不適合直接部署到沒有持久磁碟的 serverless runtime。

## 2. 部署架構

建議 production 架構：

```text
Internet
  -> reverse proxy (Nginx/Caddy)
  -> Node.js process (next start)
  -> SQLite DB on persistent volume
  -> public/assets on persistent volume or deployed static assets
```

建議 staging 架構：

```text
staging.jazamila.example.com
  -> independent Node.js process
  -> independent SQLite DB
  -> independent env file
```

重要原則：

- staging 與 production 不共用 SQLite 檔案。
- production 同一時間只跑一個 writable app instance。
- DB、uploads/assets、env file 都必須備份。
- 每次部署前先在 staging 跑同版 build。

## 3. 目錄規劃

建議 production host：

```text
/srv/jazamila/current        # currently deployed release
/srv/jazamila/releases       # release directories
/srv/jazamila/shared/.env.production
/srv/jazamila/shared/assets  # persistent pics/post/tmp
/var/lib/jazamila/jazamila.sqlite
/var/lib/jazamila/backups
/var/log/jazamila
```

建議 staging host：

```text
/srv/jazamila-staging/current
/srv/jazamila-staging/releases
/srv/jazamila-staging/shared/.env.production
/srv/jazamila-staging/shared/assets
/var/lib/jazamila-staging/jazamila.sqlite
/var/lib/jazamila-staging/backups
/var/log/jazamila-staging
```

`public/assets/pics`、`public/assets/post`、`public/assets/tmp` 必須在每個 release 連到對應的
`shared/assets` 子目錄；切換 release 時不可建立新的空 runtime asset 目錄。建立連結前只移除
repository 內的 `.gitkeep` 與確認為空的目錄，若目錄已有檔案則先停止部署並人工搬移，禁止覆蓋。

既有 SQLite 若沒有 `_prisma_migrations` history，不可直接執行 deploy。先依
`docs/nextjs-sqlite-production-migration.md` 驗證 legacy baseline 並只 resolve 一次，再執行
`db:migrate:prod`。新的空資料庫則直接執行 `db:migrate:prod`。

## 4. 環境變數

Production `.env.production` 必填：

```env
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite"
ADMIN_USERNAME="replace-with-private-admin-username"
ADMIN_PASSWORD="replace-with-a-strong-password"
ADMIN_SESSION_SECRET="replace-with-at-least-32-random-characters"
NEXT_PUBLIC_APP_URL="https://jazamila.example.com"
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="replace-with-recaptcha-site-key"
RECAPTCHA_SECRET_KEY="replace-with-recaptcha-secret-key"
RECAPTCHA_MIN_SCORE="0.5"
```

Legacy import 時才需要：

```env
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy"
```

Staging `.env.production` 範例：

```env
DATABASE_URL="file:/var/lib/jazamila-staging/jazamila.sqlite"
ADMIN_USERNAME="replace-with-private-staging-admin-username"
ADMIN_PASSWORD="replace-with-a-staging-password"
ADMIN_SESSION_SECRET="replace-with-at-least-32-random-characters"
NEXT_PUBLIC_APP_URL="https://staging.jazamila.example.com"
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="replace-with-staging-recaptcha-site-key"
RECAPTCHA_SECRET_KEY="replace-with-staging-recaptcha-secret-key"
RECAPTCHA_MIN_SCORE="0.5"
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy"
```

注意：

- 不要提交 `.env.production`。
- `ADMIN_PASSWORD` 正式環境至少 16 字元，不能使用開發預設密碼。
- `ADMIN_SESSION_SECRET` 正式環境至少 32 字元，不要共用 production/staging。
- `DATABASE_URL` 指向的目錄必須可被 Node.js process 寫入。
- `RECAPTCHA_SECRET_KEY` 不可提交到 Git，也不可放進前端程式碼。
- staging 與 production 建議使用不同 reCAPTCHA key。

## 5. 首次 Staging 部署

在 staging host：

```bash
mkdir -p /srv/jazamila-staging/releases
mkdir -p /srv/jazamila-staging/shared
mkdir -p /srv/jazamila-staging/shared/assets/pics
mkdir -p /srv/jazamila-staging/shared/assets/post
mkdir -p /srv/jazamila-staging/shared/assets/tmp
mkdir -p /var/lib/jazamila-staging/backups
```

部署程式碼到 release 目錄後：

```bash
cd /srv/jazamila-staging/releases/<release>
npm ci
cp /srv/jazamila-staging/shared/.env.production .env.production
node scripts/link-runtime-assets.cjs /srv/jazamila-staging/shared/assets
DATABASE_URL="file:/var/lib/jazamila-staging/jazamila.sqlite" npm run db:migrate:prod
npm run typecheck
npm test
DATABASE_URL="file:/var/lib/jazamila-staging/jazamila.sqlite" npm run build
```

建立 current symlink：

```bash
ln -sfn /srv/jazamila-staging/releases/<release> /srv/jazamila-staging/current
```

啟動：

```bash
cd /srv/jazamila-staging/current
NODE_ENV=production npm run start
```

建議用 systemd/pm2/supervisor 管理 process。

## 6. 首次 Production 部署

在 production host：

```bash
mkdir -p /srv/jazamila/releases
mkdir -p /srv/jazamila/shared
mkdir -p /srv/jazamila/shared/assets/pics
mkdir -p /srv/jazamila/shared/assets/post
mkdir -p /srv/jazamila/shared/assets/tmp
mkdir -p /var/lib/jazamila/backups
```

部署程式碼到 release 目錄後：

```bash
cd /srv/jazamila/releases/<release>
npm ci
cp /srv/jazamila/shared/.env.production .env.production
node scripts/link-runtime-assets.cjs /srv/jazamila/shared/assets
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" npm run db:migrate:prod
npm run typecheck
npm test
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" npm run build
```

建立 current symlink：

```bash
ln -sfn /srv/jazamila/releases/<release> /srv/jazamila/current
```

啟動：

```bash
cd /srv/jazamila/current
NODE_ENV=production npm run start
```

## 7. Legacy 匯入流程

Legacy import 只應在 staging 先跑完。

Staging dry-run：

```bash
cd /srv/jazamila-staging/current
DATABASE_URL="file:/var/lib/jazamila-staging/jazamila.sqlite" \
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy" \
  npm run db:import:legacy:dry
```

Staging import：

```bash
DATABASE_URL="file:/var/lib/jazamila-staging/jazamila.sqlite" \
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy" \
  npm run db:import:legacy
```

Production import 前：

```bash
sqlite3 /var/lib/jazamila/jazamila.sqlite ".backup '/var/lib/jazamila/backups/pre-import-$(date +%Y%m%d-%H%M%S).sqlite'"
```

Production import：

```bash
cd /srv/jazamila/current
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" \
LEGACY_DATABASE_URL="mysql://legacy_user:password@host:3306/jazamila_legacy" \
  npm run db:import:legacy
```

## 8. 每次部署流程

1. 確認 staging 已通過同一 commit。
2. 建立 production DB backup。
3. 部署新 release 到 `/srv/jazamila/releases/<release>`。
4. 執行 `npm ci`。
5. 執行 `node scripts/link-runtime-assets.cjs /srv/jazamila/shared/assets`，並確認輸出的三個連結都指向 shared volume。
6. 執行 `DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" npm run db:migrate:prod`；schema、地區 lookup 與料理分類初始化必須先完成，build 才能讀取資料。
7. 執行 `npm run typecheck`。
8. 執行 `npm test`。
9. 執行 `DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" npm run build`。
10. 切換 `current` symlink。
11. restart Node.js process。
12. 執行 smoke tests。
13. 觀察 logs。

## 9. Smoke Tests

Production smoke tests：

```bash
curl -I https://jazamila.example.com/
curl -I https://jazamila.example.com/listdata/0/0/0/0/1
curl -I https://jazamila.example.com/detail/1
curl -I https://jazamila.example.com/admin/login
curl -s https://jazamila.example.com/jsonapi | head
```

Mutation smoke tests 應只在 staging 執行：

```bash
curl -s -X POST \
  -F foodwhere_region=1 \
  -F foodwhere_section=2 \
  -F foodmoney_max=100 \
  -F foodmoney_min=0 \
  -F foodtype=1 \
  -F remember=1 \
  https://staging.jazamila.example.com/jazamila_ajax/pick
```

## 10. SQLite Backup

部署前 backup：

```bash
sqlite3 /var/lib/jazamila/jazamila.sqlite ".backup '/var/lib/jazamila/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sqlite'"
```

每日 cron 範例：

```cron
15 3 * * * sqlite3 /var/lib/jazamila/jazamila.sqlite ".backup '/var/lib/jazamila/backups/daily-$(date +\%Y\%m\%d-\%H\%M\%S).sqlite'"
```

清理 14 天前備份：

```bash
find /var/lib/jazamila/backups -name '*.sqlite' -mtime +14 -delete
```

建議後續加入 offsite backup，例如 rclone、S3/R2 或 Litestream。

## 11. Rollback Plan

### 11.1 Code-only rollback

適用：新 release 程式有 bug，但 DB schema/data 未變更。

```bash
ln -sfn /srv/jazamila/releases/<previous-release> /srv/jazamila/current
systemctl restart jazamila
```

然後執行 smoke tests。

### 11.2 DB rollback

適用：資料匯入錯誤、schema migration 後資料異常。

1. 停止 app process。
2. 備份目前異常 DB。
3. 還原部署前 backup。
4. 切回上一個 code release。
5. 啟動 app process。
6. 執行 smoke tests。

指令：

```bash
systemctl stop jazamila
cp /var/lib/jazamila/jazamila.sqlite "/var/lib/jazamila/backups/broken-$(date +%Y%m%d-%H%M%S).sqlite"
cp /var/lib/jazamila/backups/pre-deploy-YYYYMMDD-HHMMSS.sqlite /var/lib/jazamila/jazamila.sqlite
ln -sfn /srv/jazamila/releases/<previous-release> /srv/jazamila/current
systemctl start jazamila
```

### 11.3 Full fallback to archived legacy site

適用：Next.js production 無法快速恢復。

1. 將 reverse proxy upstream 切回已備份的舊站或上一個 production image。
2. 將 Next.js production 停止寫入。
3. 保留 SQLite 現場檔案供事後分析。
4. 公告回到 fallback 狀態。

## 12. Reverse Proxy 範例

Nginx:

```nginx
server {
    server_name jazamila.example.com;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/json text/css application/javascript;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 13. Systemd 範例

```ini
[Unit]
Description=JAZAMILA Next.js
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/jazamila/current
Environment=NODE_ENV=production
EnvironmentFile=/srv/jazamila/shared/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
User=jazamila
Group=jazamila

[Install]
WantedBy=multi-user.target
```

## 14. 部署前 Checklist

- [ ] staging 同 commit 已部署。
- [ ] `npm run typecheck` 通過。
- [ ] `npm test` 通過。
- [ ] `npm run build` 通過。
- [ ] production `.env.production` 已更新。
- [ ] SQLite DB backup 已建立。
- [ ] uploads/assets 已備份。
- [ ] `pics`、`post`、`tmp` 均為指向 shared volume 的 symlink。
- [ ] rollback release 已確認。
- [ ] reverse proxy config 可切回上一個穩定 upstream。

## 15. 部署後 Checklist

- [ ] `/` 200。
- [ ] `/listdata/0/0/0/0/1` 200。
- [ ] `/detail/1` 200 或抽樣餐廳 ID 200。
- [ ] `/jsonapi` 回傳 JSON。
- [ ] `/admin/login` 200。
- [ ] logs 無持續錯誤。
- [ ] SQLite backup job 正常。

`db:migrate:prod` 同時初始化必要料理分類（可重複執行），不寫入示範餐廳。部署後需確認 `r_cuisine_type` 有 active 分類；分類定義衝突會中止部署。

## 16. 餐廳 API 分頁與效能觀察

- 舊客戶端的 `/jsonapi` 維持完整陣列契約。
- 新客戶端可使用 `/jsonapi?page=1&per_page=100`，每頁最多 100 筆，回傳仍為陣列。
- 回應標頭 `X-Total-Count`、`X-Page`、`X-Total-Pages`、`X-Per-Page` 提供分頁資訊；超出最後一頁會回傳最後一頁。
- 壓測／監控應分別觀察列表、關鍵字查詢、排序、API 的延遲與回應大小；正式環境需以實際併發數與資料量驗證。
- sitemap 目前每日更新，餐廳後台異動時會失效重建。接近 50,000 個網址前應改為 sitemap index 與分檔。
