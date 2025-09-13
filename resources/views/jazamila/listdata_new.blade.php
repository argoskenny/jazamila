<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">

@include('components.head', [
    'title' => $title ?? 'JAZAMILA - 餐廳列表',
    'description' => 'JAZAMILA內有許多美食、餐廳的資料，幫你解決不知該吃哪間餐廳的煩惱。',
    'additional_css' => ['assets/css/jazamila/listdata.css'],
])

<body ontouchstart="">
    @include('components.header', ['active_nav' => 'listdata'])

    <form action="listdata/0/{{ $url_type }}/{{ $url_maxmoney }}/{{ $url_minmoney }}/1" method="get"
        id="form_keyword" name="form_keyword">
        <div class="main">
            <div class="col-lg-12 main_title reveal">餐廳列表</div>
            <div class="col-lg-12 main_text reveal">{{ $main_text }}</div>
            <div class="container">
                <div class="input-group">

                    <input type="text" id="search_keyword" name="search_keyword" class="form-control"
                        onfocus="if(this.value=='請輸入關鍵字'){this.value=''; $('#search_keyword').css('color','black');}"
                        onblur="if(this.value==''){this.value='請輸入關鍵字'; $('#search_keyword').css('color','#CCC');}"
                        value="{{ $search_keyword_value }}" alt="請輸入關鍵字">
                    <button class="btn btn-outline-secondary" type="button" onclick="keyword_submit();">搜尋</button>
                </div>
            </div>
        </div>
    </form>
    <div class="share">
        <div class="container">
            <div class="col-12 col-sm-3 option_title">
                <div class="option_title_content">
                    縮小列表範圍
                </div>
                <div id="option_choose">
                    <div class="option_select">
                        <b>吃哪邊？</b>
                        <input type="hidden" id="foodwhere_region" name="foodwhere_region" value="{{ $url_region }}">
                        <div class="btn-group foodwhere_region">
                            <button type="button" id="show_option_region"
                                class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown"
                                aria-expanded="false">
                                {{ $region_show = $url_region == 0 ? '都可以' : $config['region'][$url_region] }}
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="javascript:void(0);" a_type="0">都可以</a></li>
                                <?php
                                $region_array = $config['region'];
                                foreach ($region_array as $key => $val) {
                                    echo '<li><a class="dropdown-item" href="javascript:void(0);" a_type="' . $key . '">' . $val . '</a></li>';
                                }
                                ?>
                            </ul>
                        </div>
                        <b>地區</b>
                        <input type="hidden" id="foodwhere_section" name="foodwhere_section"
                            value="{{ $url_section }}">
                        <div class="btn-group foodwhere_section">
                            <button type="button" id="show_option_section"
                                class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown"
                                aria-expanded="false">
                                {{ $section_show = $url_section == 0 ? '全區' : $config['section'][$url_section] }}
                            </button>
                            <ul class="dropdown-menu" id="section_menu">
                            </ul>
                        </div>
                    </div>
                    <div class="option_select">
                        <b>吃多少？</b><br />
                        <input type="hidden" id="foodmoney_min" name="foodmoney_min" value="{{ $url_minmoney }}">
                        <div class="btn-group foodmoney_min">
                            <button type="button" id="show_option_min"
                                class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown"
                                aria-expanded="false">
                                {{ $url_minmoney = $url_minmoney == 0 ? '0元' : $url_minmoney . '元左右' }}
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="javascript:void(0);">0元</a></li>
                                <?php
                                for ($money = 1; $money < 11; $money++) {
                                    echo '<li><a class="dropdown-item" href="javascript:void(0);">' . (int) $money * 100 . '元左右</a></li>';
                                }
                                ?>
                            </ul>
                        </div>
                        <b>至</b>
                        <input type="hidden" id="foodmoney_max" name="foodmoney_max" value="{{ $url_maxmoney }}">
                        <div class="btn-group foodmoney_max">
                            <button type="button" id="show_option_max"
                                class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown"
                                aria-expanded="false">
                                {{ $url_maxmoney = $url_maxmoney == 0 ? '無上限' : $url_maxmoney . '元左右' }}
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="javascript:void(0);">無上限</a></li>
                                <?php
                                for ($money = 1; $money < 11; $money++) {
                                    echo '<li><a class="dropdown-item" href="javascript:void(0);">' . (int) $money * 100 . '元左右</a></li>';
                                }
                                ?>
                            </ul>
                        </div>
                        <div class="money_error">
                            價錢範圍有誤。
                        </div>
                    </div>
                    <div class="option_select">
                        <b>吃哪種？</b>
                        <input type="hidden" id="foodtype" name="foodtype" value="{{ $url_type }}">
                        <div class="btn-group foodtype">
                            <button type="button" id="show_option_type"
                                class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown"
                                aria-expanded="false">
                                {{ $foodtype_show = $url_type == 0 ? '都可以' : $config['foodtype'][$url_type] }}
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="javascript:void(0);" a_type="0">都可以</a></li>
                                <?php
                                $types_array = $config['foodtype'];
                                foreach ($types_array as $key => $val) {
                                    echo '<li><a class="dropdown-item" href="javascript:void(0);" a_type="' . $key . '">' . $val . '</a></li>';
                                }
                                ?>
                            </ul>
                        </div>
                    </div>
                    <div class="option_btn">
                        <button type="button" id="list_search_btn" class="btn btn-primary btn-lg"
                            onclick="list_submit();">搜尋</button>
                    </div>
                </div>
            </div>
            <div class="col-12 col-sm-9 res_list_area">
                <div class="col-lg-12 res_list_data_first">
                    共找到 <span>{{ $current_num }}</span> 筆資料
                </div>
                <?php 
					if(!empty($restuarant))
					{
						$i = 0;
						foreach ($restuarant as $res_data)
						{	$res_list_data = ($i%2==0) ? "res_list_data1" : "res_list_data2";?>
                <div class="col-lg-12 {{ $res_list_data }}">
                    <div class="flex_pic">
                        <a class="td_a" href="detail/{{ $res_data['id'] . $list_record }}">
                            <img src="{{ asset('assets/pics/' . $res_data['res_img_url']) }}">
                        </a>
                    </div>
                    <div class="flex_text">
                        <ul>
                            <li><b><a class="td_a"
                                        href="detail/{{ $res_data['id'] }}{{ $list_record }}">{{ $res_data['res_name'] }}</a></b>
                            </li>
                            <li><?php
                            if ($res_data['res_area_num'] == '00' && $res_data['res_tel_num'] == '0') {
                                echo '未提供市話';
                            } else {
                                echo $res_data['res_area_num'] . ' - ' . $res_data['res_tel_num'];
                            }
                            ?></li>
                            <li>{{ $res_data['res_region'] . $res_data['res_section'] . $res_data['res_address'] }}
                            </li>
                        </ul>
                        <ul>
                            <li><span>類型：</span>{{ $res_data['res_foodtype'] }}</a></li>
                            <li><span>均價：</span>{{ $res_price = $res_data['res_price'] != 0 ? $res_data['res_price'] . ' 元' : '未提供均價' }}
                            </li>
                        </ul>
                    </div>
                    <div class="res_note">
                        {{ $res_data['res_note'] }}
                    </div>
                </div>
                <?php 	$i++;
						}
					}
					else
					{
					?>
                <div class="col-lg-12 res_list_no_data">
                    暫時沒有符合的搜尋結果。<br />
                    建議您輸入其他的關鍵字，或重新選擇縮小列表範圍的條件。
                </div>
                <?php }?>
            </div>
            <input type="hidden" id="url_page" value="{{ $url_page }}">
            <div class="pages_div">
                {{ $pages }}
            </div>
        </div>
    </div>

    @include('components.footer')
    @include('components.scripts', [
        'additional_js' => ['assets/js/jazamila/listdata.js'],
    ])
</body>

</html>
