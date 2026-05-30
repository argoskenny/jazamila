# 正式上線設定備忘錄

這份備忘錄用於 JAZAMILA 正式環境上線後的最低必要設定檢查。完整部署流程仍以 `docs/nextjs-deployment-runbook.md` 為準。

## 1. 環境變數

正式環境必須設定：

```env
NODE_ENV="production"
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite"
ADMIN_USERNAME="replace-with-private-admin-username"
ADMIN_PASSWORD="replace-with-a-strong-password"
ADMIN_SESSION_SECRET="replace-with-at-least-32-random-characters"
NEXT_PUBLIC_APP_URL="https://jazamila.example.com"
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="replace-with-recaptcha-site-key"
RECAPTCHA_SECRET_KEY="replace-with-recaptcha-secret-key"
RECAPTCHA_MIN_SCORE="0.5"
```

注意事項：

- `ADMIN_USERNAME` 不要使用公開文件或預設值中的 `admin`。
- `ADMIN_PASSWORD` 至少 16 字元，不能使用 `password`。
- `ADMIN_SESSION_SECRET` 至少 32 字元，production 和 staging 不可共用。
- `.env.production` 不可 commit 到 Git。
- `DATABASE_URL` 指到的 SQLite 目錄必須可被 Node.js process 讀寫。
- `RECAPTCHA_SECRET_KEY` 只能放在 server-side env，不可放在頁面或 Git。
- reCAPTCHA key 的允許網域要包含正式網域，staging 建議用另一組 key。

產生 secret：

```bash
openssl rand -base64 32
```

## 2. 單一管理者後台

目前後台是單一管理者架構，不使用資料庫帳號表。

正式環境保護機制：

- 缺少 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 或 `ADMIN_SESSION_SECRET` 時會拒絕登入。
- 使用開發預設密碼或太短密碼時會拒絕登入。
- 使用太短 session secret 時會拒絕建立 session。
- 後台 session 有效時間為 8 小時。
- production cookie 會啟用 `Secure`，因此正式環境必須走 HTTPS。

建議額外保護：

- 若後台只有固定地點會使用，可在 reverse proxy 或防火牆限制 `/admin` 來源 IP。
- 不要把 `/admin` 帳密放在聊天記錄、issue、README 或部署 log。
- 上線後立即用正式帳密登入一次，再登出確認 session 可清除。

## 3. SQLite 與檔案

正式環境需要持久化：

- SQLite DB：`/var/lib/jazamila/jazamila.sqlite`
- SQLite backup 目錄：`/var/lib/jazamila/backups`
- runtime 圖片或上傳檔案：依部署方式保留 `public/assets/pics/`、`public/assets/post/`、`public/assets/tmp/`

注意事項：

- production 不適合部署在沒有持久磁碟的 serverless runtime。
- 同一個 SQLite 檔案同一時間只應由一個 writable app instance 使用。
- 每次部署前先備份 SQLite。

## 4. 上線後 Smoke Test

上線後至少檢查：

```bash
curl -I https://jazamila.example.com/
curl -I https://jazamila.example.com/listdata/0/0/0/0/1
curl -I https://jazamila.example.com/detail/1
curl -I https://jazamila.example.com/admin/login
curl -s https://jazamila.example.com/jsonapi | head
```

人工檢查：

- 首頁可正常抽餐廳。
- 餐廳列表與餐廳詳細頁可開啟。
- `/admin/login` 可用正式帳密登入。
- `/admin/restaurants/new` 可新增一筆測試餐廳。
- 新增後可在前台列表或詳細頁看到資料。
- 後台登出後，直接開 `/admin` 會回到登入頁。

## 5. 備份

最低限度：

- 每日備份 SQLite DB。
- 部署前手動備份一次 SQLite DB。
- 保留最近數日備份，並定期測試還原。

範例：

```bash
sqlite3 /var/lib/jazamila/jazamila.sqlite ".backup '/var/lib/jazamila/backups/jazamila-$(date +%Y%m%d-%H%M%S).sqlite'"
```

## 6. 部署後不要忘記

- 確認 production log 沒有持續錯誤。
- 確認 `.env.production` 權限只允許部署使用者讀取。
- 確認 HTTPS 憑證有效且會自動續期。
- 確認 staging 和 production 使用不同 DB、不同後台帳密、不同 session secret。
- 確認舊的開發帳密沒有出現在 production env。
