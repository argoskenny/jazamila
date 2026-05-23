# JAZAMILA Next.js 完整重寫技術規劃

## 1. 文件目的

本文件規劃將目前 Laravel 12 版本的 JAZAMILA 專案完整重寫為 Next.js 架構的技術路線。後續可依此文件拆解 `goal` 任務逐步實作。

本次重寫不是逐行翻譯 Laravel controller 或 Blade，而是以「功能等價、URL 相容、資料模型清楚、前後端界線明確」為原則，重新建立 Next.js 應用。

## 2. 現況摘要

目前專案根目錄已是 Laravel 應用，並包含部分 CodeIgniter 遷移痕跡。

主要模組：

- 前台頁面：首頁、餐廳列表、餐廳詳細、地圖、關於本站、餐廳分享。
- 前台 Ajax：隨機選餐廳、驗證碼、意見回饋、區域選單、部落格連結投稿。
- 後台：餐廳、文章、部落格、回饋管理。
- Meet 會員模組：登入、註冊、會員資料維護，現況仍需進一步釐清。

重要現況限制：

- `vendor/` 目前不完整，需 `composer install` 後才能完整執行 Laravel 指令。
- `phpunit.xml` 仍指向舊的 `laravel/tests/Feature`，需修正或改用 `vendor/bin/phpunit tests`。
- `config/admin.php` 不存在，但後台驗證讀取 `config('admin', [])`。
- 部分 docs 仍提到舊的 `laravel/` 子目錄。
- 部分 controller 仍混合資料查詢、HTML 字串、Cookie、Session 與輸出格式。

## 3. 重寫目標

### 3.1 功能目標

- 保留現有主要公開 URL。
- 重建首頁「吃什麼」流程。
- 重建餐廳列表、搜尋、篩選與分頁。
- 重建餐廳詳細頁與部落格連結。
- 重建前台投稿與回饋流程。
- 重建後台管理功能。
- 視需求重建 Meet 會員模組。

### 3.2 技術目標

- 使用 Next.js App Router。
- 使用 TypeScript。
- 使用 Server Components 作為預設頁面資料讀取方式。
- 使用 Client Components 處理表單互動、選單、地圖、需要瀏覽器狀態的 UI。
- 使用 Route Handlers 或 Server Actions 處理 mutation 與舊 Ajax 相容。
- 使用 ORM 管理資料模型與 migration。
- 移除 jQuery 依賴，改以 React state 與原生 Web API 實作。
- 建立可測試的 domain/service 層，避免把業務邏輯寫死在 React component 中。

## 4. 建議技術棧

### 4.1 Runtime 與框架

- Node.js LTS。
- Next.js App Router。
- TypeScript。
- React。

### 4.2 資料庫與 ORM

建議優先選擇：

- MySQL + Prisma：如果沿用既有 MySQL 資料。
- PostgreSQL + Prisma：如果可以接受正式資料庫遷移。

備選：

- Drizzle ORM：若希望 migration 與 SQL 控制更直接。

不建議：

- 正式環境使用 SQLite。SQLite 可作本機測試或 demo，但不適合作為正式站資料庫首選。

### 4.3 驗證與表單

- Zod：schema validation。
- React Hook Form：複雜 client form。
- Server-side validation 必須存在，不可只依賴 client validation。

### 4.4 Auth

後台建議採用：

- Auth.js，或
- 自建 session cookie + bcrypt/argon2 密碼雜湊。

不建議保留目前 `config('admin')` 明文帳密模式。

### 4.5 測試

- Vitest：domain/service unit tests。
- Playwright：主要公開流程與後台 smoke tests。
- 可選：Testing Library for React component tests。

## 5. 目標專案結構

```text
next-app/
  app/
    layout.tsx
    page.tsx
    listdata/
      [[...filters]]/
        page.tsx
    detail/
      [id]/
        page.tsx
    map/
      page.tsx
    about/
      page.tsx
    post/
      page.tsx

    jazamila_ajax/
      pick/
        route.ts
      check_captcha/
        route.ts
      save_feedback_post/
        route.ts
      get_section/
        route.ts
      get_section_cookie/
        route.ts
      listdata_get_section/
        route.ts
      blog_save/
        route.ts

    admin/
      layout.tsx
      page.tsx
      login/
        page.tsx
      restaurants/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx
          edit/
            page.tsx
      posts/
        page.tsx
        [id]/
          edit/
            page.tsx
      blogs/
        page.tsx
        [id]/
          edit/
            page.tsx
      feedback/
        page.tsx

  components/
    site/
    admin/
    forms/
    ui/

  lib/
    auth/
    db/
    domain/
      restaurants.ts
      sections.ts
      feedback.ts
      blogs.ts
      posts.ts
    validation/
    cookies.ts
    pagination.ts

  prisma/
    schema.prisma
    migrations/

  public/
    assets/

  tests/
    unit/
    e2e/
```

## 6. URL 與路由相容規劃

第一版應盡量維持既有公開 URL，降低 SEO、書籤與外部連結風險。

| 現有 URL | Next.js 目標 | 備註 |
| --- | --- | --- |
| `/` | `app/page.tsx` | 首頁與隨機選餐廳表單 |
| `/listdata/{location?}/{type?}/{max?}/{min?}/{page?}` | `app/listdata/[[...filters]]/page.tsx` | 解析 optional catch-all segments |
| `/detail/{id}` | `app/detail/[id]/page.tsx` | `{id}` 必須為數字 |
| `/map` | `app/map/page.tsx` | 靜態或互動地圖頁 |
| `/about` | `app/about/page.tsx` | 靜態內容 |
| `/post` | `app/post/page.tsx` | 餐廳分享表單 |
| `/jazamila_ajax/pick` | `app/jazamila_ajax/pick/route.ts` | 保留舊 Ajax endpoint |
| `/jazamila_ajax/check_captcha` | `app/jazamila_ajax/check_captcha/route.ts` | 可評估改為新 captcha 流程 |
| `/jazamila_ajax/save_feedback_post` | `app/jazamila_ajax/save_feedback_post/route.ts` | 回饋提交 |
| `/jazamila_ajax/get_section` | `app/jazamila_ajax/get_section/route.ts` | 區域選單 |
| `/jazamila_ajax/get_section_cookie` | `app/jazamila_ajax/get_section_cookie/route.ts` | 區域選單與 cookie |
| `/jazamila_ajax/listdata_get_section` | `app/jazamila_ajax/listdata_get_section/route.ts` | 列表篩選區域 |
| `/jazamila_ajax/blog_save` | `app/jazamila_ajax/blog_save/route.ts` | 部落格連結投稿 |
| `/admin` | `app/admin/page.tsx` | 後台首頁 |
| `/admin/login` | `app/admin/login/page.tsx` | 後台登入 |
| `/admin/res_list/{set}` | `app/admin/restaurants/page.tsx` | 可用 query `?set=` 或 rewrite 保留舊 URL |
| `/admin/res_detail/{res_id}` | `app/admin/restaurants/[id]/page.tsx` | 餐廳詳細 |
| `/admin/res_insert` | `app/admin/restaurants/new/page.tsx` | 新增餐廳 |
| `/admin/res_edit/{res_id}` | `app/admin/restaurants/[id]/edit/page.tsx` | 編輯餐廳 |

若需完全保留後台舊 URL，可在 `next.config.ts` 使用 rewrites，或直接建立對應的舊路徑 route。

## 7. 資料模型規劃

需由現有 Laravel migrations 與實際 production schema 共同確認。第一版以現有 migrations 為基礎。

### 7.1 User

來源：

- `database/migrations/2024_01_01_000000_create_users_table.php`

用途：

- Meet 會員登入與資料維護。
- 若重建後台帳號，也可獨立建立 `AdminUser`，不要混用不明語意的舊 user table。

### 7.2 Restaurant

來源：

- `database/migrations/2024_01_01_000001_create_r_restaurant_table.php`

用途：

- 首頁隨機選餐廳。
- 餐廳列表、搜尋、篩選、分頁。
- 餐廳詳細頁。
- 後台餐廳管理。

### 7.3 Post

來源：

- `database/migrations/2024_01_01_000002_create_r_post_table.php`

用途：

- 餐廳分享投稿。
- 後台審核與管理。

### 7.4 Bloglink

來源：

- `database/migrations/2024_01_01_000003_create_r_bloglink_table.php`

用途：

- 餐廳詳細頁顯示外部食記。
- 前台 blog_save 投稿。
- 後台審核與管理。

### 7.5 Feedback

來源：

- `database/migrations/2024_01_01_000004_create_r_feedback_table.php`

用途：

- 前台意見回饋。
- 後台查看與處理。

### 7.6 Session

來源：

- `database/migrations/2025_09_12_173140_create_sessions_table.php`

Next.js 不一定沿用 Laravel session table。若使用 Auth.js 或自建 session，需要重新定義 session 儲存方式。

## 8. Domain Service 規劃

所有主要業務邏輯應先放在 `lib/domain/`，再由 page、route handler 或 server action 呼叫。

### 8.1 `lib/domain/restaurants.ts`

應包含：

- `getRestaurantFilters()`
- `parseListFilters(segments, searchParams)`
- `listRestaurants(filters, pagination)`
- `countRestaurants(filters)`
- `getRestaurantDetail(id)`
- `pickRestaurant(criteria)`
- `getRecommendedRestaurants(id)`

### 8.2 `lib/domain/sections.ts`

應包含：

- `getRegions()`
- `getSections(regionId?)`
- `getFoodTypes()`
- `renderLegacySectionOptions()`，僅在必須相容舊 Ajax HTML response 時使用。

### 8.3 `lib/domain/feedback.ts`

應包含：

- `createFeedback(input)`
- `validateFeedbackInput(input)`
- `listFeedbackForAdmin(filters)`

### 8.4 `lib/domain/blogs.ts`

應包含：

- `createBlogLinkSubmission(input)`
- `listBlogLinksForRestaurant(restaurantId)`
- `approveBlogLink(id)`
- `rejectBlogLink(id)`
- `updateBlogLink(id, input)`

### 8.5 `lib/domain/posts.ts`

應包含：

- `createRestaurantPost(input)`
- `listPostsForAdmin(status, pagination)`
- `approvePost(id)`
- `rejectPost(id)`
- `updatePost(id, input)`

## 9. Cookie 與狀態相容

目前首頁會記錄篩選條件：

- `remember`
- `foodwhere_region`
- `foodwhere_section`
- `foodmoney_max`
- `foodmoney_min`
- `foodtype`

Next.js 第一版應保留 cookie 名稱，避免使用者既有偏好失效。可在 `lib/cookies.ts` 集中處理：

- 讀取首頁預設條件。
- 寫入隨機選餐廳條件。
- 清除或忽略不合法值。

Cookie validation 必須在 server 端做，不可直接信任瀏覽器輸入。

## 10. 前台頁面規劃

### 10.1 首頁 `/`

功能：

- 顯示地區、區域、價位、類型條件。
- 支援記住條件。
- 點擊「吃什麼」後隨機挑選餐廳。

實作建議：

- Page 使用 Server Component 讀 cookie 與選單資料。
- 表單互動使用 Client Component。
- 提交使用 Route Handler 或 Server Action。
- 第一版可保留舊 endpoint `/jazamila_ajax/pick`。

驗收標準：

- 首頁可正常載入。
- Cookie 中既有條件會帶入預設選項。
- 點擊隨機選餐廳後回傳餐廳 ID 或導向餐廳詳細頁。
- remember 開啟時會寫入對應 cookie。

### 10.2 餐廳列表 `/listdata/...`

功能：

- 解析 location/type/max/min/page。
- 支援 query `search_keyword`。
- 顯示目前篩選文字。
- 顯示餐廳列表與分頁。

實作建議：

- 使用 Server Component 直接讀 DB。
- 分頁函式放在 `lib/pagination.ts`。
- 篩選條件解析放在 `parseListFilters()`。

驗收標準：

- 舊 URL 可正常進入。
- 不合法 segment 回傳 404 或導向安全預設頁。
- 分頁連結保持相同參數順序。
- 搜尋關鍵字可與其他篩選條件共用。

### 10.3 餐廳詳細 `/detail/{id}`

功能：

- 顯示餐廳基本資料。
- 顯示食記連結。
- 顯示返回列表所需的 `ul/ut/umx/umi/p` query。
- 顯示推薦餐廳，若第一版沒有資料可先保留空狀態。

驗收標準：

- 存在的餐廳 ID 正常顯示。
- 不存在的餐廳 ID 回傳 404。
- 從列表進入後可返回原篩選條件。

### 10.4 靜態頁 `/about`、`/map`、`/post`

功能：

- 內容與現有 Blade 視覺/文字等價。
- `/post` 若包含投稿表單，需接到新的 mutation。

驗收標準：

- 靜態頁可正常載入。
- 主要文字、資產與導覽狀態正確。

## 11. 前台 API 與舊 Ajax 相容

第一版 Route Handlers 應保留舊 endpoint，降低一次重寫風險。

| Endpoint | Method | Response | 實作重點 |
| --- | --- | --- | --- |
| `/jazamila_ajax/pick` | POST | JSON | 隨機餐廳、cookie 寫入 |
| `/jazamila_ajax/check_captcha` | POST | text/html 或 JSON | 優先釐清是否仍需要自建 captcha |
| `/jazamila_ajax/save_feedback_post` | POST | text/html 或 JSON | 建立 feedback |
| `/jazamila_ajax/get_section` | POST | HTML fragment | 可先相容舊 HTML，再逐步改 JSON |
| `/jazamila_ajax/get_section_cookie` | POST | HTML fragment | 讀取 section cookie |
| `/jazamila_ajax/listdata_get_section` | POST | HTML fragment | 列表頁區域選項 |
| `/jazamila_ajax/blog_save` | POST | text/html 或 JSON | 建立 blog link submission |

長期建議：

- 新 React component 使用 JSON API 或 Server Actions。
- 舊 HTML fragment response 僅保留在相容層。

## 12. 後台重寫規劃

### 12.1 後台 Auth

必須先決定：

- 是否使用獨立 admin users table。
- 是否需要多管理員。
- 是否需要角色權限。
- 是否需要沿用舊帳號。

建議建立：

- `AdminUser`
- `AdminSession` 或使用 Auth.js adapter。

密碼：

- 使用 bcrypt 或 argon2。
- 若有舊 md5 密碼，採用「登入成功後惰性升級」策略。

### 12.2 後台資訊架構

建議頁面：

- `/admin`：dashboard。
- `/admin/restaurants`：餐廳列表。
- `/admin/restaurants/new`：新增餐廳。
- `/admin/restaurants/[id]`：餐廳詳細。
- `/admin/restaurants/[id]/edit`：編輯餐廳。
- `/admin/posts`：餐廳分享投稿審核。
- `/admin/blogs`：食記連結審核。
- `/admin/feedback`：意見回饋列表。

### 12.3 後台檔案上傳

目前使用：

- `public/assets/pics/`
- `public/assets/tmp/`
- `public/assets/post/`

Next.js 正式部署若在 Vercel，不能依賴本地檔案系統持久化。必須選擇：

- S3/R2/GCS 物件儲存。
- 自架 Node server 並掛載持久化磁碟。
- 保留獨立 media server。

第一版本機可先寫入 `public/assets/`，但正式環境需在部署前改為物件儲存。

## 13. Meet 會員模組規劃

Meet 模組目前資料與完整業務邏輯需要再次確認。建議獨立成後續階段，不與公開餐廳頁、後台重寫綁在同一個 milestone。

需釐清：

- 目前會員 URL 是否仍在使用。
- 是否有 production users。
- 密碼雜湊格式。
- 會員個人頁與好友/狀態/留言等模型是否仍需要。

若確認要重建：

- 先建立 users schema。
- 建立 register/login/logout/profile 基本流程。
- 再補 member page 與社群功能。

## 14. 資產遷移

第一版可直接複製：

- `public/assets/css/`
- `public/assets/js/` 中仍需要的資料或常數邏輯。
- `public/assets/img/`
- `public/assets/pics/`
- `public/assets/post/`

但不建議長期保留 jQuery 與舊頁面 JS。遷移策略：

1. 第一階段保留圖片與 CSS 視覺參考。
2. 第二階段將互動行為改成 React components。
3. 第三階段移除未使用的舊 JS/CSS。

## 15. 實作階段與 `goal` 拆分

### Phase 0：盤點與決策

目標：

- 確認資料庫種類與 production schema。
- 確認部署目標。
- 確認是否需要完整 URL 相容。
- 確認 Meet 模組是否納入第一版。
- 確認圖片上傳正式儲存方案。

產出：

- `docs/nextjs-decisions.md`
- schema 對照表。
- migration 風險清單。

驗收：

- 所有阻塞性技術選型都有明確決策。

### Phase 1：建立 Next.js 專案骨架

目標：

- 建立 Next.js + TypeScript 專案。
- 加入 lint/test/format 基本設定。
- 建立 app layout、site shell、admin shell。
- 建立 DB client 與 ORM schema 初版。

產出：

- 可啟動的 Next.js app。
- 可連線的本機 DB。
- 初版 ORM schema。

驗收：

- `npm run dev` 可啟動。
- 首頁 placeholder 可載入。
- ORM migration 可在本機執行。

### Phase 2：資料模型與 seed

目標：

- 將 Laravel migrations 轉為 Prisma/Drizzle schema。
- 建立 seed 資料。
- 建立 repository/domain query。

產出：

- `Restaurant`、`Post`、`Bloglink`、`Feedback`、`User` schema。
- seed script。
- restaurant query unit tests。

驗收：

- 可建立本機測試資料庫。
- 餐廳列表與詳細查詢可由 unit tests 驗證。

### Phase 3：公開頁 MVP

目標：

- 完成 `/`、`/listdata/...`、`/detail/{id}`。
- 保留 cookie 條件。
- 完成基本導覽與共用 layout。

產出：

- 首頁。
- 餐廳列表頁。
- 餐廳詳細頁。

驗收：

- 舊主要 URL 可訪問。
- 篩選、搜尋、分頁可運作。
- 不存在餐廳回傳 404。
- Playwright smoke test 通過。

### Phase 4：前台表單與 Ajax 相容

目標：

- 完成 `/jazamila_ajax/*` route handlers。
- 完成 feedback、blog submission、section options。
- 完成 captcha 或替代方案。

產出：

- 舊 Ajax endpoint 相容層。
- React 表單互動。

驗收：

- 首頁 pick 寫入 cookie 並回傳結果。
- feedback 可寫入 DB。
- blog link submission 可寫入 DB。
- section endpoint 回傳格式與前端需求一致。

### Phase 5：靜態頁與視覺整理

目標：

- 完成 `/about`、`/map`、`/post`。
- 移除不需要的 jQuery 行為。
- 整理 CSS 與 component。

產出：

- 靜態頁等價內容。
- 餐廳分享投稿表單。

驗收：

- 所有公開導覽連結可正常訪問。
- 手機與桌面版基本排版正常。

### Phase 6：後台 Auth 與 Dashboard

目標：

- 建立安全的後台登入。
- 建立 protected admin layout。
- 建立 dashboard。

產出：

- Admin auth。
- Login/logout。
- Protected admin route middleware。

驗收：

- 未登入不能進入 `/admin/*`。
- 登入後可進入 dashboard。
- Logout 後 session 失效。

### Phase 7：後台 CRUD

目標：

- 完成餐廳管理。
- 完成投稿審核。
- 完成食記審核。
- 完成回饋列表。

產出：

- `/admin/restaurants`
- `/admin/posts`
- `/admin/blogs`
- `/admin/feedback`

驗收：

- 餐廳可新增、編輯、查看。
- 投稿可通過/不通過。
- 食記可通過/不通過。
- 回饋可查看。

### Phase 8：圖片與檔案上傳

目標：

- 建立正式檔案儲存策略。
- 完成餐廳圖片與投稿圖片上傳。

產出：

- Upload service。
- 圖片 URL 儲存與讀取。

驗收：

- 本機與正式部署環境都可穩定顯示圖片。
- 上傳檔案有副檔名、大小、MIME validation。

### Phase 9：Meet 模組

目標：

- 若確認仍需要，重建會員功能。

產出：

- Register/login/profile/member pages。
- 會員相關 schema 與 tests。

驗收：

- 會員可註冊、登入、更新資料。
- 舊密碼若存在，可安全升級。

### Phase 10：切換與下線 Laravel

目標：

- 完成資料遷移。
- 完成 URL 相容與 redirect。
- 完成正式部署。
- 下線 Laravel 或保留唯讀備援。

產出：

- Migration runbook。
- Rollback plan。
- Production checklist。

驗收：

- Next.js 正式環境可處理主要流量。
- 主要路由 smoke test 通過。
- 錯誤率與資料寫入正常。

## 16. 測試策略

### 16.1 Unit Tests

覆蓋：

- 篩選參數解析。
- 分頁計算。
- 餐廳查詢條件。
- Cookie 讀寫與 validation。
- 表單 validation。

### 16.2 Integration Tests

覆蓋：

- Route handler request/response。
- DB 寫入與查詢。
- Auth session。

### 16.3 E2E Tests

覆蓋：

- 首頁挑選餐廳。
- 餐廳列表搜尋與分頁。
- 餐廳詳細頁。
- 回饋提交。
- 後台登入。
- 後台餐廳新增與編輯。

## 17. 資料遷移策略

需建立正式 migration script，而不是手動搬資料。

建議步驟：

1. 匯出現有 DB schema 與資料量統計。
2. 建立舊欄位到新 schema 對照表。
3. 建立 dry-run migration script。
4. 在 staging 跑資料遷移。
5. 比對筆數與抽樣資料。
6. 正式切換前凍結寫入或建立雙寫策略。
7. 執行正式遷移。
8. 保留 Laravel DB 備份。

## 18. 部署規劃

需先決定部署模式。

### 18.1 Vercel

優點：

- Next.js 支援最佳。
- 部署流程簡單。

注意：

- 不可依賴本地檔案系統保存上傳圖片。
- 需使用外部 DB。
- 需使用外部 object storage。

### 18.2 自架 Node Server

優點：

- 可更接近傳統 PHP 主機使用方式。
- 檔案儲存與背景工作彈性較高。

注意：

- 需自行處理 process manager、logs、SSL、部署、備份。

## 19. 風險與對策

| 風險 | 影響 | 對策 |
| --- | --- | --- |
| Production schema 與 migrations 不一致 | 資料遷移失敗 | 先做 schema dump 與欄位對照 |
| 舊 URL 被破壞 | SEO 與使用者書籤失效 | 第一版保留主要公開 URL |
| 上傳圖片在 serverless 環境遺失 | 圖片無法顯示 | 使用 S3/R2/GCS |
| 舊 Ajax 回應格式不明 | 前端互動破壞 | 先建立相容層，再逐步改 JSON |
| 後台 auth 太快重寫 | 管理功能中斷 | 後台獨立 phase，先完成公開頁 |
| Meet 模組需求不清 | 範圍膨脹 | 延後到 Phase 9，先釐清是否需要 |
| 一次切換全部功能 | 回滾困難 | 分階段 staging 驗收與 runbook |

## 20. 開放問題

開始 Phase 1 前應回答：

1. 正式資料庫目前是 MySQL、MariaDB、PostgreSQL 還是其他？
2. 是否要保留所有公開 URL 與後台 URL？
3. 是否要部署到 Vercel？
4. 圖片上傳正式要放在哪裡？
5. 後台是否需要多管理員與角色權限？
6. Meet 會員模組是否仍需要？
7. 是否有 production 資料可用於 staging migration 測試？
8. 是否允許視覺重新設計，或第一版必須接近舊站？

## 21. 建議第一個 `goal`

建議第一個實作目標：

```text
根據 docs/nextjs-rewrite-plan.md 建立 Next.js + TypeScript 專案骨架，保留現有 Laravel 專案不動。加入基本 layout、首頁 placeholder、ORM 選型與初版 schema 草稿，並建立可執行的 dev/test/lint scripts。
```

第一個 goal 不應直接搬頁面。它應先讓新架構可以啟動、測試與持續擴充。
