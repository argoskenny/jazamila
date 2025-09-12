# 待提供的澄清與憑證

1. **資料庫連線與 schema**：專案未提供 `application/config/database.php`，需完整 schema 與連線資訊。
2. **缺少模型檔案**：`meet_model` 未在 repo 中，需補齊以便遷移會員模組。
3. **外部服務憑證**：`recaptcha` API key 目前硬編碼；請提供可配置之 key，並說明是否使用其他第三方服務（Email SMTP、Queue、地圖服務等）。
4. **檔案上傳目錄與權限**：現行使用 `assets/pics`、`assets/tmp` 等資料夾，需確認最終部署時的路徑與寫入權限。
5. **密碼雜湊**：CI 目前以何種演算法存放密碼？需提供現行雜湊方式以便 Laravel 進行惰性升級。
6. **測試資料**：為建立契約測試，需要可供匯入的資料集。
7. **部署與 CI/CD**：是否有既有 pipeline 或主機限制（PHP 擴充、Redis、Queue 等）。

