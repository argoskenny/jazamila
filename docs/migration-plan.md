# 遷移總覽計畫

## 模組拆分與風險評估
| 模組 | 內容與現況 | 風險 | 預計 PR |
| --- | --- | --- | --- |
| 靜態頁面（about/map/post/CaptchaImg） | 單純 view 輸出，資料庫無依賴 | 低：主要是路由對應與 CSRF 差異 | PR#1：Laravel skeleton、靜態頁面路由/Controller/Request |
| 餐廳列表與詳細（jazamila@index/listdata/detail/jsonapi） | 依 GET 參數查詢、分頁、Cookie；輸出 HTML/JSON | 中：複雜查詢、分頁參數與多語系設定檔處理 | PR#2：首頁與列表/詳細頁、契約測試 |
| 前台 Ajax（pick/save_feedback_post/blog_save/get_section…） | POST JSON 或 HTML 回傳 | 中：Cookie、隨機選餐廳邏輯、輸出格式須一致 | PR#3：前台 Ajax 端點、API 契約測試 |
| 後台（admin/res_list/res_edit/post/blog/feedback…） | session 驗證、分頁、表單 | 高：權限、資料維護、圖片上傳、舊雜湊升級 | PR#4~PR#5：後台各子模組逐步遷移 |
| 後台 Ajax（ajax/login/save_res_data/save_res_pic…） | JSON 回應與檔案上傳 | 中高：檔案處理與權限驗證 | PR#6：後台 Ajax 端點 |
| Meet（會員系統） | 登入/註冊/會員資料維護；session 驗證 | 高：缺少 meet_model、業務邏輯繁複 | PR#7~PR#8：會員前台、Ajax |
| 共用（Recaptcha、Email、Queue、上傳權限） | 需確定外部服務與設定 | 中 | 於各 PR 逐步整合 |

## 里程碑
1. 建立 Laravel 12 skeleton、設定資料庫與環境。
2. 逐模組遷移並附契約測試；每 PR 完成對應路由群。
3. 完整替換 CodeIgniter 之後，再 Blade 化視圖。
4. 專案最終驗收：URL、HTTP 回應、HTML 與資產路徑完全相容。

## 第一輪 PR 計畫
- **模組**：靜態頁面（about、map、post、CaptchaImg）。
- **內容**：
  1. 建立 Laravel 目錄結構與基本設定檔。
  2. 匯入現有 view 檔，設置對應 route、Controller、Request。
  3. 契約測試：對比 HTML、HTTP 狀態碼、Headers。
  4. 回滾指引：刪除 `laravel` 目錄或切換 webroot 至舊 CI。

