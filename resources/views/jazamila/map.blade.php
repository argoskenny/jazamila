<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">

@include('components.head', [
    'title' => $title ?? 'JAZAMILA - 地圖',
    'description' => 'JAZAMILA內有許多美食、餐廳的資料，幫你解決不知該吃哪間餐廳的煩惱。',
    'additional_css' => ['assets/css/jazamila/map.css'],
])

<body ontouchstart="">
    @include('components.header', ['active_nav' => 'map'])
    <div class="main" id="map">

    </div>
    <div class="share">

    </div>

    @include('components.footer')
    @include('components.scripts', [
        'additional_js' => ['assets/js/jazamila/map.js'],
    ])
</body>

</html>
