# 餐廳列表與詳細模組遷移說明

## 遷移設計
- 新增 `App\\Http\\Controllers\\JazamilaController`，負責首頁、餐廳列表、詳細與 JSON API。
- 對應路由於 `laravel/routes/web.php` 註冊，維持 CodeIgniter 參數順序與 URL。
- 直接複製原 CodeIgniter `application/views/jazamila/` 內的 PHP 模板至 `laravel/resources/views/jazamila/`，暫不轉換為 Blade。

## 差異對照
- 目前控制器僅提供輸出骨架，實際資料查詢與 Cookie 行為仍待實作。
- `detail/{id}` 路由在 Laravel 中加上 `whereNumber('id')` 約束，等價於 CI 的數字檢查。

## 回滾指引
- 刪除 `JazamilaController` 與相關路由設定。
- 移除新增的 `resources/views/jazamila/index.php`、`listdata.php`、`detail.php`。
- 若需回到舊的 CodeIgniter 版本，可從版本控制中還原 `application/` 與 `system/` 目錄。
