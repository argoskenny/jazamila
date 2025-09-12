# 路由對照表（CodeIgniter → Laravel）

| CI URI | Controller@Method | 動詞 | 中介層 | 驗證重點 |
| --- | --- | --- | --- | --- |
| `/` | Jazamila@index | GET | web | 無 |
| `/listdata/{location}/{type}/{max}/{min}/{page}` | Jazamila@listdata | GET | web | 整數參數、搜尋關鍵字 (query) |
| `/detail/{id}` | Jazamila@detail | GET | web | `{id}` 為數字 |
| `/map` | Jazamila@map | GET | web | 無 |
| `/about` | Jazamila@about | GET | web | 無 |
| `/post` | Jazamila@post | GET | web | 無 |
| `/save_post_data` | Jazamila@save_post_data | POST | web | reCAPTCHA、欄位必填 |
| `/CaptchaImg` | Jazamila@CaptchaImg | GET | web | 無，回傳 PNG |
| `/jazamila_ajax/pick` | Jazamila_ajax@pick | POST | web | Cookie 讀寫 |
| `/jazamila_ajax/check_captcha` | Jazamila_ajax@check_captcha | POST | web | 驗證碼 |
| `/jazamila_ajax/save_feedback_post` | Jazamila_ajax@save_feedback_post | POST | web | 表單欄位 |
| `/jazamila_ajax/get_section` | Jazamila_ajax@get_section | POST | web | 參數必填 |
| `/jazamila_ajax/get_section_cookie` | Jazamila_ajax@get_section_cookie | POST | web | Cookie 讀寫 |
| `/jazamila_ajax/listdata_get_section` | Jazamila_ajax@listdata_get_section | POST | web | 參數必填 |
| `/jazamila_ajax/blog_save` | Jazamila_ajax@blog_save | POST | web | 表單欄位 |
| `/jsonapi` | Jazamila@jsonapi | GET | web | 無 |
| `/admin/res_list` 等 | Admin@* | GET/POST | auth.session | 表單欄位、檔案上傳 |
| `/ajax/login` 等 | Ajax@* | POST | auth.session | JSON 輸出、檔案上傳 |
| `/meet` | Meet@index | GET | meet.session | 無 |
| `/meet/register` | Meet@register | GET | meet.session | 無 |
| `/meet/newreg` | Meet@newreg | POST | meet.session | 表單欄位 |
| `/member/{id}` | Meet@member | GET | meet.session | `{id}` 為數字 |
| `/meet_ajax/login` 等 | Meet_ajax@* | POST | meet.session | 欄位驗證、檔案處理 |

> Laravel 端將使用 `Route::match()`、`Route::get()`、`Route::post()` 等方式，維持原有路由與參數順序。

