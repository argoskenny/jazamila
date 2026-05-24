# JAZAMILA Next.js 實作狀態

## 已完成

- 將專案根目錄整理為可直接執行的 Next.js App Router 專案。
- 移除舊 Laravel 程式與舊版遷移文件。
- 建立 Next.js App Router + TypeScript 專案骨架。
- 加入 Prisma schema，欄位對應舊站資料表。
- 建立 Prisma persistence，使用本機 SQLite 作為 development/test DB。
- 完成前台頁面：
  - `/`
  - `/listdata/[[...filters]]`
  - `/detail/[id]`
  - `/about`
  - `/map`
  - `/post`
- 完成舊 Ajax 相容端點：
  - `/jazamila_ajax/pick`
  - `/jazamila_ajax/check_captcha`
  - `/jazamila_ajax/save_feedback_post`
  - `/jazamila_ajax/get_section`
  - `/jazamila_ajax/get_section_cookie`
  - `/jazamila_ajax/listdata_get_section`
  - `/jazamila_ajax/blog_save`
  - `/save_post_data`
  - `/jsonapi`
- 完成後台基礎：
  - `/admin/login`
  - `/admin`
  - `/admin/restaurants`
  - `/admin/restaurants/new`
  - `/admin/restaurants/[id]`
  - `/admin/restaurants/[id]/edit`
  - `/admin/posts`
  - `/admin/blogs`
  - `/admin/feedback`
- 加入舊後台 URL rewrites。
- 加入 unit tests。
- 將 persistence 策略收斂為 SQLite-first，並新增 legacy MySQL 匯入 SQLite script 草稿。
- 新增 staging/production 部署 runbook、環境變數清單、備份與 rollback plan。

## 已驗證

```bash
npm run db:setup
npm run typecheck
npm test
npm run build
```

HTTP smoke tests:

- `GET /` -> 200
- `GET /listdata/0/0/0/0/1` -> 200
- `GET /detail/1` -> 200
- `GET /admin` -> 307 `/admin/login`
- `GET /admin/login` -> 200
- `POST /jazamila_ajax/pick` -> `{"status":"success","res_id":1}`
- `POST /jazamila_ajax/save_feedback_post` -> `success`
- `POST /jazamila_ajax/blog_save` -> `{"status":"success"}`
- `POST /save_post_data` -> `{"status":"success"}`
- `POST /jazamila_ajax/listdata_get_section` -> legacy HTML fragment
- `GET /jsonapi` -> JSON list

## 尚未完成的 production work

- 確認 production host 有 persistent filesystem，並在 staging 執行 legacy import dry-run。
- 依 staging 結果調整 import script 的資料清洗規則。
- 建立正式圖片上傳與儲存方案。
- 加入 Playwright E2E。
- 依真實 production 主機調整 systemd/reverse proxy 路徑與備份排程。
