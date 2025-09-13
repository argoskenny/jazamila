# 共用組件使用說明

## 已創建的共用組件

### 1. `components/head.blade.php`

包含頁面的基本 head 標籤，支援自訂參數：

- `title`: 頁面標題
- `description`: 頁面描述
- `additional_css`: 額外的 CSS 檔案陣列

### 2. `components/header.blade.php`

包含導航列，支援手動指定 active 狀態或自動根據當前路由設定

### 3. `components/footer.blade.php`

包含頁腳

### 4. `components/scripts.blade.php`

包含基本 JavaScript 檔案，支援自訂參數：

- `additional_js`: 額外的 JS 檔案陣列

## 使用方式

### 基本頁面結構

```blade
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">

@include('components.head', [
    'title' => '頁面標題',
    'description' => '頁面描述',
    'additional_css' => ['assets/css/page-specific.css']
])

<body ontouchstart="">
    @include('components.header', ['active_nav' => 'home'])

    <!-- 頁面內容 -->

    @include('components.footer')
    @include('components.scripts', [
        'additional_js' => ['assets/js/page-specific.js']
    ])
</body>
</html>
```

### Active 導航狀態設定

```blade
<!-- 手動指定 active 狀態 -->
@include('components.header', ['active_nav' => 'home'])     <!-- 首頁 -->
@include('components.header', ['active_nav' => 'listdata']) <!-- 餐廳列表 -->
@include('components.header', ['active_nav' => 'about'])    <!-- 關於本站 -->
@include('components.header', ['active_nav' => 'post'])     <!-- 餐廳分享 -->
@include('components.header', ['active_nav' => 'map'])      <!-- 美食地圖 -->

<!-- 不指定則自動根據路由判斷 -->
@include('components.header')
```

### 已更新的頁面

- ✅ `jazamila/index.blade.php` (active_nav: 'home')
- ✅ `jazamila/about.blade.php` (active_nav: 'about')
- ✅ `jazamila/detail.blade.php` (active_nav: 'listdata')
- ✅ `jazamila/listdata.blade.php` (active_nav: 'listdata')
- ✅ `jazamila/listdata_new.blade.php` (active_nav: 'listdata')
- ✅ `jazamila/map.blade.php` (active_nav: 'map')
- ✅ `jazamila/post.blade.php` (active_nav: 'post')

### 所有頁面已完成共用組件套用

所有 `@jazamila/` 目錄下的頁面都已經成功套用共用組件！

## 更新步驟

1. 替換 `<head>` 區塊為 `@include('components.head', [...])`
2. 替換導航列為 `@include('components.header')`
3. 替換頁腳和腳本為 `@include('components.footer')` 和 `@include('components.scripts', [...])`
4. 移除重複的 CSS/JS 引用

## 優點

- 減少重複代碼
- 統一維護 header/footer
- 自動 active 狀態管理
- 靈活的 CSS/JS 載入
- 更好的代碼組織
