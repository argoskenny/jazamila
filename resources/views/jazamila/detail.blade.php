<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">

@include('components.head', [
    'title' =>
        isset($restuarant) && !empty($restuarant)
            ? 'JAZAMILA - ' . $restuarant[0]['res_name']
            : 'JAZAMILA - 找不到餐廳',
    'description' =>
        isset($restuarant) && !empty($restuarant)
            ? $restuarant[0]['res_name'] . '的餐廳詳細資料'
            : '找不到指定的餐廳資料',
    'additional_css' => ['assets/css/jazamila/detail.css'],
])

@if (isset($restuarant) && !empty($restuarant))
    @foreach ($restuarant as $res_data)
        <meta property="og:title" content="JAZAMILA - {{ $res_data['res_name'] }}" />
        <meta property="og:type" content="restaurant.restaurant" />
        <meta property="og:image" content="{{ asset('assets/pics/' . $res_data['res_img_url']) }}" />
        <meta property="og:url" content="{{ url('detail/' . $res_data['id']) }}" />
        <meta property="og:description"
            content="{{ $res_data['res_name'] }}的餐廳詳細資料。電話：<?php
            if ($res_data['res_area_num'] == '00' && $res_data['res_tel_num'] == '0') {
                echo '未提供市話';
            } else {
                echo $res_data['res_area_num'] . ' - ' . $res_data['res_tel_num'];
            } ?>，地址：{{ $res_data['res_region'] . $res_data['res_address'] }}，類型：{{ $res_data['res_foodtype'] }}" />
    @endforeach
@endif

<body ontouchstart="">
    @include('components.header', ['active_nav' => 'listdata'])

    @if (isset($restuarant) && !empty($restuarant))
        @foreach ($restuarant as $res_data)
            <div class="main" id="detail">
                <div class="container">
                    <div class="col-lg-12 main_text reveal">今天就吃...</div>
                    <div class="col-lg-12 main_title reveal">{{ $res_data['res_name'] }}</div>
                    @if (!empty($res_data['res_img_url']))
                        <div class="col-12 col-md-6 res_pic"><img
                                src="{{ asset('assets/pics/' . $res_data['res_img_url']) }}"
                                alt="{{ $res_data['res_name'] }}" loading="lazy" decoding="async"></div>
                    @else
                        <div class="col-12 col-md-6 res_pic"><img src="{{ asset('assets/imgs/default_res_pic.jpg') }}"
                                alt="{{ $res_data['res_name'] }}" title="未提供餐廳照片" loading="lazy" decoding="async">
                        </div>
                    @endif
                    <div class="col-12 col-md-6 res_detail">
                        <div class="basic_info">
                            <span>餐廳名稱：</span><a href="http://www.google.com.tw/search?q={{ $res_data['res_name'] }}"
                                target="_blank" id="name_remind">{{ $res_data['res_name'] }}</a><br />
                            <em class="name_remind_class">點選名稱可搜尋餐廳資料</em>
                            <span>餐廳電話：</span><?php
                            if ($res_data['res_area_num'] == '00' && $res_data['res_tel_num'] == '0') {
                                echo '<span>未提供市話</span>';
                            } else {
                                echo $res_data['res_area_num'] . ' - ' . $res_data['res_tel_num'];
                            }
                            ?><br />
                            <span>餐廳地址：</span><a
                                href="http://maps.google.com/maps?q={{ $res_data['res_region'] . $res_data['res_section'] . $res_data['res_address'] }}"
                                target="_blank"
                                id="map_remind">{{ $res_data['res_region'] . $res_data['res_section'] . $res_data['res_address'] }}</a><br />
                            <em class="map_remind_class">點選地址可觀看地圖</em>
                            <span>美食類型：</span>{{ $res_data['res_foodtype'] }}<br />
                            <span>平均價位：</span>{{ $res_price = $res_data['res_price'] != 0 ? $res_data['res_price'] : '<span>未提供均價</span>' }}<br />
                            <span>營業時間：</span><?php
                            if (!empty($res_data['res_open_time_hr']) && !empty($res_data['res_open_time_min']) && !empty($res_data['res_close_time_hr']) && !empty($res_data['res_close_time_min'])) {
                                echo $res_data['res_open_time_hr'] . ':' . $res_data['res_open_time_min'] . ' - ' . $res_data['res_close_time_hr'] . ':' . $res_data['res_close_time_min'];
                            } else {
                                echo '<span>未提供營業時間</span>';
                            }
                            ?>
                            <br />
                        </div>
                        {!! $res_data['res_note'] !!}
                        <div class="blog_info">
                            @if (!empty($blog))
                                <span>食記介紹：</span><br />
                                @foreach ($blog as $blogarr)
                                    <a href="{{ $blogarr['b_bloglink'] }}" target="_blank"
                                        title="{{ $blogarr['b_blogname'] }}" alt="{{ $blogarr['b_blogname'] }}">
                                        {{ $blogarr['b_blogname'] }}
                                    </a><br />
                                @endforeach
                            @endif
                            <a data-bs-toggle="modal" href="#myModal"><b>+</b>&nbsp;&nbsp;新增食記</a>
                        </div>
                        <div class="share_info">
                            <div class="col-6 col-sm-3 share_links">
                                <a href="javascript:;"
                                    onclick='window.open("https://www.facebook.com/sharer.php?u={{ url('/') }}detail/{{ $res_data['id'] }}", "facebook_frm","height=450,width=540");'
                                    title="分享至Facebook">
                                    <img src="{{ asset('assets/img/jazamila/icon/fb_share.png') }}" title="分享至Facebook"
                                        alt="Facebook share" loading="lazy" decoding="async" />
                                </a>
                            </div>
                            <div class="col-6 col-sm-3 share_links">
                                <a href="javascript:desc='';if(window.getSelection)desc=window.getSelection();if(document.getSelection)desc=document.getSelection();if(document.selection)desc=document.selection.createRange().text;void(open('http://twitter.com/?status='+encodeURIComponent(location.href+' ('+document.title.split('@')[0].replace(/([\s]*$)/g,'')+')')));"
                                    title="分享至twitter">
                                    <img src="{{ asset('assets/img/jazamila/icon/tweet_share.png') }}"
                                        title="分享至Twitter" alt="Twitter share" loading="lazy" decoding="async" />
                                </a>
                            </div>
                            <div class="col-6 col-sm-3 share_links">
                                <a href="javascript:desc='';if(window.getSelection)desc=window.getSelection();if(document.getSelection)desc=document.getSelection();if(document.selection)desc=document.selection.createRange().text;void(open('http://www.plurk.com/?qualifier=shares&amp;status='+encodeURIComponent(location.href+' ('+document.title.split('@')[0].replace(/([\s]*$)/g,'')+')')));"
                                    title="分享至PLURK">
                                    <img src="{{ asset('assets/img/jazamila/icon/plurk_share.png') }}" title="分享至Plurk"
                                        alt="Plurk share" loading="lazy" decoding="async" />
                                </a>
                            </div>
                            <div class="col-6 col-sm-3 share_links">
                                <a target="_blank"
                                    href="javascript:void(window.open('https://plus.google.com/share?url='.concat(encodeURIComponent(location.href)), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600'));">
                                    <img src="{{ asset('assets/img/jazamila/icon/google_share.png') }}"
                                        title="分享至Google+" alt="Google Plus share" loading="lazy" decoding="async" />
                                </a>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            <div class="share">
                <div class="container">
                    <div class="row">
                        <div class="col-12 col-lg-12 plz-share">不想吃那個？不妨來看看推薦餐廳！</div>
                    </div>
                    <div class="row recommend_area">
                        <div class="col-12 col-sm-3 recommend">
                            @if (isset($recommend_res1) && !empty($recommend_res1))
                                @foreach ($recommend_res1 as $rec_res_data1)
                                    <a class="td_a" href="detail/{{ $rec_res_data1['id'] }}"><img
                                            src="{{ asset('assets/pics/' . $rec_res_data1['res_img_url']) }}"></a><br />
                                    {{ $rec_res_data1['res_name'] }}<br />
                                    {{ $rec_res_data1['res_area_num'] }} - {{ $rec_res_data1['res_tel_num'] }}<br />
                                    <a href="http://maps.google.com/maps?q={{ $rec_res_data1['res_region'] . $rec_res_data1['res_address'] }}"
                                        target="_blank">{{ $rec_res_data1['res_region'] . $rec_res_data1['res_address'] }}</a>
                                @endforeach
                            @endif
                        </div>
                        <div class="col-12 col-sm-3 recommend">
                            @if (isset($recommend_res2) && !empty($recommend_res2))
                                @foreach ($recommend_res2 as $rec_res_data2)
                                    <a class="td_a" href="detail/{{ $rec_res_data2['id'] }}"><img
                                            src="{{ asset('assets/pics/' . $rec_res_data2['res_img_url']) }}"></a><br />
                                    {{ $rec_res_data2['res_name'] }}<br />
                                    {{ $rec_res_data2['res_area_num'] }} - {{ $rec_res_data2['res_tel_num'] }}<br />
                                    <a href="http://maps.google.com/maps?q={{ $rec_res_data2['res_region'] . $rec_res_data2['res_address'] }}"
                                        target="_blank">{{ $rec_res_data2['res_region'] . $rec_res_data2['res_address'] }}</a>
                                @endforeach
                            @endif
                        </div>
                        <div class="col-12 col-sm-3 recommend">
                            @if (isset($recommend_res3) && !empty($recommend_res3))
                                @foreach ($recommend_res3 as $rec_res_data3)
                                    <a class="td_a" href="detail/{{ $rec_res_data3['id'] }}"><img
                                            src="{{ asset('assets/pics/' . $rec_res_data3['res_img_url']) }}"></a><br />
                                    {{ $rec_res_data3['res_name'] }}<br />
                                    {{ $rec_res_data3['res_area_num'] }} - {{ $rec_res_data3['res_tel_num'] }}<br />
                                    <a href="http://maps.google.com/maps?q={{ $rec_res_data3['res_region'] . $rec_res_data3['res_address'] }}"
                                        target="_blank">{{ $rec_res_data3['res_region'] . $rec_res_data3['res_address'] }}</a>
                                @endforeach
                            @endif
                        </div>
                        <div class="col-12 col-sm-3 recommend">
                            @if (isset($recommend_res4) && !empty($recommend_res4))
                                @foreach ($recommend_res4 as $rec_res_data4)
                                    <a class="td_a" href="detail/{{ $rec_res_data4['id'] }}"><img
                                            src="{{ asset('assets/pics/' . $rec_res_data4['res_img_url']) }}"></a><br />
                                    {{ $rec_res_data4['res_name'] }}<br />
                                    {{ $rec_res_data4['res_area_num'] }} - {{ $rec_res_data4['res_tel_num'] }}<br />
                                    <a href="http://maps.google.com/maps?q={{ $rec_res_data4['res_region'] . $rec_res_data4['res_address'] }}"
                                        target="_blank">{{ $rec_res_data4['res_region'] . $rec_res_data4['res_address'] }}</a>
                                @endforeach
                            @endif
                        </div>
                    </div>
                </div>
            </div>
            <div class="main">
                <div class="container">
                    <div class="col-lg-12 main_text">還是都沒興趣？</div>
                    <div class="col-lg-12">
                        <button type="button" class="btn btn-primary btn-lg whattoeat"
                            onclick="pick();">再找一次？</button>
                    </div>
                    <div class="col-lg-12 main_option">
                        <div class="circle_btn">
                            <img src="{{ asset('assets/img/jazamila/icon/option_btn.png') }}">
                        </div>
                    </div>
                    <div id="option_choose">
                        <div class="col-lg-12 not_found">
                            找不到餐廳耶...也許你該換個條件試試？
                        </div>
                        <div class="row">
                            <div class="col-12 col-md-4 option_select">
                                <p>
                                    <b>吃哪邊？</b>
                                    <select id="foodwhere_region" name="foodwhere_region" class="form-control">
                                        {!! $foodwhere_region_HTML ?? '' !!}
                                    </select>
                                </p>
                                <p>
                                    <b>地區或商圈</b>
                                    <select id="foodwhere_section" name="foodwhere_section" class="form-control">
                                        {!! $foodwhere_section_HTML ?? '' !!}
                                    </select>
                                </p>
                            </div>
                            <div class="col-12 col-md-4 option_select">
                                <p>
                                    <b>吃多少？</b>
                                    <select id="foodmoney_min" name="foodmoney_min" class="form-control">
                                        {!! $foodmoney_min_HTML ?? '' !!}
                                    </select>
                                </p>
                                <p>
                                    <b>至</b>
                                    <select id="foodmoney_max" name="foodmoney_max" class="form-control">
                                        {!! $foodmoney_max_HTML ?? '' !!}
                                    </select>
                                </p>
                            </div>
                            <div class="col-12 col-md-4 option_select">
                                <b>吃哪種？</b>
                                <select id="foodtype" name="foodtype" class="form-control">
                                    {!! $foodtype_HTML ?? '' !!}
                                </select>
                            </div>
                        </div>
                        <div class="remember_option">
                            {!! $remember_HTML ?? '' !!} 記得我選的條件。
                        </div>
                    </div>
                    <div class="col-lg-12">
                        <a href="listdata/{{ $list_record ?? '0/0/0/0/1' }}"><button type="button"
                                id="back_to_list" class="btn btn-primary btn-lg">返回列表</button></a>
                    </div>
                </div>
            </div>
        @endforeach
    @else
        <!-- 空資料畫面 -->
        <div class="main" id="detail">
            <div class="container">
                <div class="col-lg-12 main_text reveal">抱歉...</div>
                <div class="col-lg-12 main_title reveal">找不到這間餐廳</div>
                <div class="col-12 col-md-8 mx-auto res_detail">
                    <div class="basic_info text-center">
                        <div class="mb-4">
                            <i class="fas fa-search" style="font-size: 4rem; color: #ccc;"></i>
                        </div>
                        <h3>找不到指定的餐廳資料</h3>
                        <p class="text-muted">可能的原因：</p>
                        <ul class="list-unstyled text-muted">
                            <li>• 餐廳資料已被移除</li>
                            <li>• 連結已過期</li>
                            <li>• 輸入的網址不正確</li>
                        </ul>
                        <div class="mt-4">
                            <a href="{{ url('/') }}" class="btn btn-primary btn-lg me-3">回到首頁</a>
                            <a href="{{ url('/listdata/0/0/0/0/1') }}"
                                class="btn btn-outline-primary btn-lg">瀏覽餐廳列表</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endif

    <input type="hidden" id="cookie_flag" name="cookie_flag" value="{{ $cookie_flag ?? '' }}">

    <!-- 新增食記 -->
    @if (isset($restuarant) && !empty($restuarant))
        <div class="modal fade" id="myModal" tabindex="-1" aria-labelledby="myModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="myModalLabel">新增食記</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"
                            aria-label="Close"></button>
                    </div>

                    <div class="modal-body">
                        <input type="text" class="form-control blogname" id="res_blogname" name="res_blogname"
                            placeholder="請輸入食記名稱">
                        <div class="msg" id="msg_blogname">請輸入食記名稱</div>
                        <input type="text" class="form-control bloglink" id="res_bloglink" name="res_bloglink"
                            placeholder="請輸入食記網址">
                        <div class="msg" id="msg_bloglink">請輸入食記網址</div>
                    </div>

                    <div class="modal-footer">
                        @foreach ($restuarant as $res_data)
                            <button type="button" class="btn btn-primary blog_btn"
                                onclick="blog_submit('{{ $res_data['id'] }}');">送出</button>
                        @endforeach
                        <button type="button" class="btn btn-secondary cancel_btn"
                            data-bs-dismiss="modal">取消</button>
                    </div>
                </div><!-- /.modal-content -->
            </div><!-- /.modal-dialog -->
        </div><!-- /.modal -->
    @endif

    <!-- 儲存成功 -->
    <div class="modal fade" id="save_success" tabindex="-1" aria-labelledby="saveSuccessLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content saveok_content p-3">
                已儲存成功，感謝你的分享！<br />
                <button type="button" class="btn btn-secondary saveok_btn mt-2" data-bs-dismiss="modal">關閉</button>
            </div>
        </div>
    </div><!-- /.modal -->

    @include('components.footer')
    @include('components.scripts', [
        'additional_js' => ['assets/js/jazamila/detail.js'],
    ])
</body>

</html>
