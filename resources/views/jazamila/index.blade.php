<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">

@include('components.head', [
    'title' => $title ?? 'JAZAMILA',
    'description' => 'JAZAMILA內有許多美食、餐廳的資料，幫你解決不知該吃哪間餐廳的煩惱。',
    'additional_css' => ['assets/css/jazamila/index.css'],
])

@php
    $og_title = 'JAZAMILA';
    $og_type = 'restaurant.restaurant';
    $og_image = asset('assets/img/jazamila/logo/oglogo.png');
    $og_url = url('/');
    $og_description = '不知該吃什麼好？JAZAMILA幫您解決這個看似無足輕重、但卻又異常惱人的小問題！';
@endphp

<meta property="og:title" content="{{ $og_title }}" />
<meta property="og:type" content="{{ $og_type }}" />
<meta property="og:image" content="{{ $og_image }}" />
<meta property="og:url" content="{{ $og_url }}" />
<meta property="og:description" content="{{ $og_description }}" />

<body ontouchstart="">
    @include('components.header', ['active_nav' => 'home'])

    <div class="main" id="home" style="min-height: calc(100vh - 120px); display: flex; align-items: center;">
        <div class="container-fluid">
            <div class="row justify-content-center">
                <div class="col-12 col-lg-8 text-center">
                    <div class="col-lg-12 main_title reveal">生活總有太多選擇</div>
                    <div class="col-lg-12 main_text reveal">無法作出決定？別擔心，我可以幫你</div>
                    <div class="col-lg-12">
                        <button type="button" class="btn btn-primary btn-lg whattoeat reveal"
                            onclick="pick();">吃什麼？</button>
                    </div>
                    <div class="col-lg-12 main_option reveal" id="options">
                        <div class="circle_btn">
                            <img src="{{ asset('assets/img/jazamila/icon/option_btn.png') }}" alt="option button">
                        </div>
                    </div>
                    <div id="option_choose" class="reveal">
                        <div class="col-lg-12 not_found">
                            找不到餐廳耶...也許你該換個條件試試？
                        </div>
                        <div class="row">
                            <div class="col-12 col-md-4 option_select">
                                <p>
                                    <b>吃哪邊？</b>
                                    <select id="foodwhere_region" name="foodwhere_region" class="form-control">
                                        {!! $foodwhere_region_HTML !!}
                                    </select>
                                </p>
                                <p>
                                    <b>地區或商圈</b>
                                    <select id="foodwhere_section" name="foodwhere_section" class="form-control">
                                    </select>
                                </p>
                            </div>
                            <div class="col-12 col-md-4 option_select">
                                <p>
                                    <b>吃多少？</b>
                                    <select id="foodmoney_min" name="foodmoney_min" class="form-control">
                                        {!! $foodmoney_min_HTML !!}
                                    </select>
                                </p>
                                <p>
                                    <b>至</b>
                                    <select id="foodmoney_max" name="foodmoney_max" class="form-control">
                                        {!! $foodmoney_max_HTML !!}
                                    </select>
                                </p>
                            </div>
                            <div class="col-12 col-md-4 option_select">
                                <b>吃哪種？</b>
                                <select id="foodtype" name="foodtype" class="form-control">
                                    {!! $foodtype_HTML !!}
                                </select>
                            </div>
                        </div>
                        <div class="remember_option">
                            {!! $remember_HTML !!} 記得我選的條件。
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    @include('components.footer')
    @include('components.scripts', [
        'additional_js' => ['assets/js/jazamila/index.js'],
    ])
</body>

</html>
