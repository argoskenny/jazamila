<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />

    <meta name="author" content="JAZAMILA" />
    <meta name="dcterms.rightsHolder" content="jazamila.com" />
    <meta name="description" content="JAZAMILA內有許多美食、餐廳的資料，幫你解決不知該吃哪間餐廳的煩惱。" />
    <meta name="robots" content="all" />
    <meta name="googlebot" content="all" />

    <meta property="og:title" content="JAZAMILA" />
    <meta property="og:type" content="restaurant.restaurant" />
    <meta property="og:image" content="{{ asset('assets/img/jazamila/logo/oglogo.png') }}" />
    <meta property="og:url" content="{{ url('/') }}" />
    <meta property="og:description" content="不知該吃什麼好？JAZAMILA幫您解決這個看似無足輕重、但卻又異常惱人的小問題！" />

    <title>{{ $title ?? 'JAZAMILA' }}</title>
    <base href="{{ url('/') }}/" />

    <link rel="shortcut icon" href="{{ asset('assets/img/jazamila/logo/jazamila.ico') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <link href="{{ asset('assets/css/common/bootstrap.min.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ asset('assets/css/jazamila/header_footer.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ asset('assets/css/jazamila/index.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ asset('assets/css/theme.css') }}" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
    <div class="navbar navbar-default header">
        <div class="container">
            <div class="navbar-header">
                <button type="button" class="navbar-toggle collapsed" data-toggle="collapse"
                    data-target=".navbar-collapse">
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                </button>
                <a class="navbar-brand" href="{{ url('/') }}"><img
                        src="{{ asset('assets/img/jazamila/logo/jazamila_logo.png') }}" alt="JAZAMILA logo"></a>
            </div>
            <div class="navbar-collapse collapse">
                <ul class="nav navbar-nav navbar-right">
                    <li><a href="listdata/0/0/0/0/1">餐廳列表</a></li>
                    <li><a href="about">關於本站</a></li>
                    <li><a href="post">餐廳分享</a></li>
                </ul>
            </div>
        </div>
    </div>

    <div class="main" id="home">
        <div class="container">
            <div class="col-lg-12 main_title reveal">生活總有太多選擇</div>
            <div class="col-lg-12 main_text reveal">無法作出決定？別擔心，我可以幫你</div>
            <div class="col-lg-12">
                <button type="button" class="btn btn-primary btn-lg whattoeat reveal" onclick="pick();">吃什麼？</button>
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
                    <div class="col-xs-12 col-md-4 option_select">
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
                    <div class="col-xs-12 col-md-4 option_select">
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
                    <div class="col-xs-12 col-md-4 option_select">
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

    <div class="share reveal" id="share">
        <div class="container">
            <div class="row">
                <div class="col-xs-12 col-lg-12 plz-share reveal">喜歡嗎？請分享！</div>
            </div>
            <div class="row share_list">
                <div class="col-xs-6 col-sm-3 share_links reveal">
                    <a href="javascript:;"
                        onclick='window.open("https://www.facebook.com/sharer.php?u={{ url('/') }}", "facebook_frm","height=450,width=540");'
                        title="分享至Facebook">
                        <img src="{{ asset('assets/img/jazamila/icon/fb_share.png') }}" title="分享至Facebook"
                            alt="Facebook share" loading="lazy" decoding="async" />
                    </a>
                </div>
                <div class="col-xs-6 col-sm-3 share_links reveal">
                    <a href="javascript:desc='';if(window.getSelection)desc=window.getSelection();if(document.getSelection)desc=document.getSelection();if(document.selection)desc=document.selection.createRange().text;void(open('http://twitter.com/?status='+encodeURIComponent(location.href+' ('+document.title.split('@')[0].replace(/([\s]*$)/g,'')+')')));"
                        title="分享至twitter">
                        <img src="{{ asset('assets/img/jazamila/icon/tweet_share.png') }}" title="分享至Twitter"
                            alt="Twitter share" loading="lazy" decoding="async" />
                    </a>
                </div>
                <div class="col-xs-6 col-sm-3 share_links reveal">
                    <a href="javascript:desc='';if(window.getSelection)desc=window.getSelection();if(document.getSelection)desc=document.getSelection();if(document.selection)desc=document.selection.createRange().text;void(open('http://www.plurk.com/?qualifier=shares&amp;status='+encodeURIComponent(location.href+' ('+document.title.split('@')[0].replace(/([\s]*$)/g,'')+')')));"
                        title="分享至PLURK">
                        <img src="{{ asset('assets/img/jazamila/icon/plurk_share.png') }}" title="分享至Plurk"
                            alt="Plurk share" loading="lazy" decoding="async" />
                    </a>
                </div>
                <div class="col-xs-6 col-sm-3 share_links reveal">
                    <a target="_blank"
                        href="javascript:void(window.open('https://plus.google.com/share?url='.concat(encodeURIComponent(location.href)), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600'));">
                        <img src="{{ asset('assets/img/jazamila/icon/google_share.png') }}" title="分享至Google+"
                            alt="Google PLus share" loading="lazy" decoding="async" />
                    </a>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-12 col-md-12 dont_like reveal">不喜歡？請花些時間，<a
                        href="about#feedback_anchor">跟我說</a>你哪邊不喜歡。</div>
            </div>
        </div>
    </div>

    <div class="footer">
        <div class="container">
            <div class="col-xs-10 col-md-11">2013 JAZAMILA</div>
            <div class="col-xs-2 col-md-1"><a href="javascript:void(0)" onclick="gotop();">TOP</a></div>
        </div>
    </div>
    <script type="text/javascript" src="{{ asset('assets/js/common/jquery-1.10.2.min.js') }}"></script>
    <script type="text/javascript" src="{{ asset('assets/js/common/bootstrap.min.js') }}"></script>
    <script type="text/javascript">
        var BASE = '{{ url('/') }}';
    </script>
    <script type="text/javascript" src="{{ asset('assets/js/jazamila/index.js') }}"></script>
    <script type="text/javascript" src="{{ asset('assets/js/theme.js') }}"></script>
</body>

</html>
