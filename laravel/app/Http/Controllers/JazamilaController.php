<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use App\Models\Restaurant;
use App\Models\Blog;

class JazamilaController extends Controller
{
    public function index(Request $request)
    {
        require base_path('application/rf_config/type.inc.php');
        require base_path('application/rf_config/area.inc.php');

        $data = $this->cookieOption($request);
        $data['config']['regionid'] = $Regionid;
        $data['config']['foodtype'] = $Foodtype;
        $data['title'] = 'JAZAMILA';

        return view('jazamila.index', $data);
    }

    public function listdata($url_location, $url_type, $url_maxmoney, $url_minmoney, $page, Request $request)
    {
        $this->checkSegment($url_type);
        $this->checkSegment($url_maxmoney);
        $this->checkSegment($url_minmoney);
        $this->checkSegment($page);

        $where_arr = [];
        $main_text = [];
        $url_region = 0;
        $url_section = 0;
        $keyword = '';
        $sufix_q = '';

        if($request->query('search_keyword')) {
            $keyword = $request->query('search_keyword');
            $search_keyword_value = $keyword;
            $keyword_pagelink = '?search_keyword='.$keyword;
            $sufix_q = '?';
        } else {
            $keyword_pagelink = '';
            $search_keyword_value = '請輸入關鍵字';
        }

        require base_path('application/rf_config/type.inc.php');
        require base_path('application/rf_config/area.inc.php');

        if($url_location != 0) {
            $url_location_arr = explode('X', $url_location);
            $url_region = $url_location_arr[0];
            $url_section = $url_location_arr[1];

            $where_arr['res_region'] = $url_region;
            if($url_section != 0) {
                $where_arr['res_section'] = $url_section;
            }
        }
        if($url_type != 0) {
            $where_arr['res_foodtype'] = $url_type;
        }
        if($url_maxmoney != 0) {
            $where_arr[] = ['res_price', '<=', $url_maxmoney];
        }
        if($url_minmoney != 0) {
            $where_arr[] = ['res_price', '>=', $url_minmoney];
        }

        if($url_location == 0 && $url_type == 0 && $url_maxmoney == 0 && $url_minmoney == 0 && $keyword == '') {
            $main_text[] = '所有';
        } else {
            if($url_location != 0) {
                $location_text = '地點為'.$Regionid[$url_region];
                if($url_section != 0) {
                    $location_text .= $Sectionid[$url_section];
                }
                $main_text[] = $location_text;
            }
            if($url_type != 0) {
                $main_text[] = '美食類型為'.$Foodtype[$url_type];
            }
            if($url_maxmoney != 0 || $url_minmoney != 0) {
                $maxmoney_str = ($url_maxmoney == 0) ? '無上限' : $url_maxmoney.'元';
                $main_text[] = '平均價位由'.$url_minmoney.'元至'.$maxmoney_str;
            }
            if($keyword != '') {
                $main_text[] = '關鍵字為'.$keyword;
            }
        }
        $data['main_text'] = implode('，',$main_text).'的餐廳';

        $total_rows = Restaurant::countWhere($this->formatWhere($where_arr), $keyword);
        $restaurants = Restaurant::showList($page, $this->formatWhere($where_arr), $keyword);

        $data['restuarant'] = $restaurants;

        $data['config']['foodtype'] = $Foodtype;
        $data['config']['region'] = $Regionid;
        $data['config']['section'] = $Sectionid;

        $data['url_region'] = $url_region;
        $data['url_section'] = $url_section;
        $data['url_type'] = $url_type;
        $data['url_maxmoney'] = $url_maxmoney;
        $data['url_minmoney'] = $url_minmoney;
        $data['url_page'] = $page;

        $currentPage = $page;
        $data['list_record'] = '?ul='.$url_location.'&ut='.$url_type.'&umx='.$url_maxmoney.'&umi='.$url_minmoney.'&p='.$currentPage;

        $data['current_num'] = $total_rows;
        $data['search_keyword_value'] = $search_keyword_value;
        $data['title'] = 'JAZAMILA - 餐廳列表';

        return view('jazamila.listdata', $data);
    }

    public function detail($res_id, Request $request)
    {
        require base_path('application/rf_config/type.inc.php');
        require base_path('application/rf_config/area.inc.php');
        require base_path('application/rf_config/recommend.inc.php');

        $remember_COOKIE = $request->cookie('remember');
        $get_arr = [];
        if($request->query('option')) {
            $get_arr = explode('XX', $request->query('option'));
        }
        $get_where_region = !empty($get_arr[0]) ? $get_arr[0] : 1;
        $get_where_section = !empty($get_arr[1]) ? $get_arr[1] : 0;
        $get_max = !empty($get_arr[2]) ? $get_arr[2] : 0;
        $get_min = !empty($get_arr[3]) ? $get_arr[3] : 0;
        $get_t = !empty($get_arr[4]) ? $get_arr[4] : 0;

        $this->checkSegment($get_where_region);
        $this->checkSegment($get_where_section);
        $this->checkSegment($get_max);
        $this->checkSegment($get_min);
        $this->checkSegment($get_t);
        $this->checkSegment($res_id);

        if($remember_COOKIE == 1) {
            $data = $this->cookieOption($request);
            $data['cookie_flag'] = 1;
        } else {
            $data = $this->buildOptionHTML($get_where_region, $get_where_section, $get_max, $get_min, $get_t, $Regionid, $Sectionid, $Area_rel, $Foodtype);
            $data['cookie_flag'] = 0;
        }

        $data['restuarant'] = Restaurant::detail($res_id);
        if(empty($data['restuarant'])) {
            return redirect('/');
        }

        if(!empty($data['restuarant'][0]['res_note'])) {
            $data['restuarant'][0]['res_note'] = '<div class="describe_info">'.$data['restuarant'][0]['res_note'].'</div>';
        }

        $data['blog'] = Blog::forRestaurant($res_id);

        shuffle($Recommend);
        $rec_count = 1;
        foreach($Recommend as $val) {
            if($rec_count < 5) {
                $data['recommend_res'.$rec_count] = Restaurant::detail($val);
                $rec_count++;
            }
        }

        $url_location = $request->query('ul', 0);
        $url_maxmoney = $request->query('umx', 0);
        $url_minmoney = $request->query('umi', 0);
        $url_type = $request->query('ut', 0);
        $currentPage = $request->query('p', 1);
        $data['list_record'] = $url_location.'/'.$url_type.'/'.$url_maxmoney.'/'.$url_minmoney.'/'.$currentPage;

        $data['title'] = 'JAZAMILA - 餐廳詳細資料';

        return view('jazamila.detail', $data);
    }

    public function jsonapi()
    {
        $url = 'http://jazamila.com/assets/pics/';
        $data = Restaurant::apiAllList();
        foreach ($data as $key => $value) {
            $data[$key]['res_img_url'] = $url.$value['res_img_url'];
        }
        return response()->json($data);
    }

    protected function checkSegment($var)
    {
        if(!is_numeric($var)) {
            abort(404);
        }
        return true;
    }

    protected function cookieOption(Request $request)
    {
        require base_path('application/rf_config/type.inc.php');
        require base_path('application/rf_config/area.inc.php');

        $foodwhere_region_COOKIE = $request->cookie('foodwhere_region',0);
        $foodwhere_section_COOKIE = $request->cookie('foodwhere_section',0);
        $foodmoney_max_COOKIE = $request->cookie('foodmoney_max',0);
        $foodmoney_min_COOKIE = $request->cookie('foodmoney_min',0);
        $foodtype_COOKIE = $request->cookie('foodtype',0);
        $remember_COOKIE = $request->cookie('remember');

        $remember_HTML = !empty($remember_COOKIE) ? '<input type="checkbox" id="remember_box" name="remember_box" checked="checked">' : '<input type="checkbox" id="remember_box" name="remember_box">';

        $foodwhere_region_HTML = '';
        foreach($Regionid as $key => $val) {
            if($foodwhere_region_COOKIE == $key) {
                $foodwhere_region_HTML .= "<option value='".$key."' selected='selected'>".$val."</option>";
            } else {
                $foodwhere_region_HTML .= "<option value='".$key."'>".$val."</option>";
            }
        }

        $foodmoney_min_HTML = '';
        for($money = 0; $money < 12; $money++) {
            $show_money = (int)$money*100;
            if($show_money == 0) {
                $show_money_str = '0元';
            } elseif($show_money == 1100) {
                $show_money_str = '1000元以上';
            } else {
                $show_money_str = $show_money.'元左右';
            }

            if($foodmoney_min_COOKIE == $show_money) {
                $foodmoney_min_HTML .= "<option value='".$show_money."' selected='selected'>".$show_money_str."</option>";
            } else {
                $foodmoney_min_HTML .= "<option value='".$show_money."'>".$show_money_str."</option>";
            }
        }

        $foodmoney_max_HTML = '';
        for($money = 0; $money < 12; $money++) {
            $show_money = (int)$money*100;
            if($show_money == 0) {
                $show_money_str = '都可以';
            } elseif($show_money == 1100) {
                $show_money_str = '1000元以上';
            } else {
                $show_money_str = $show_money.'元左右';
            }

            if($foodmoney_max_COOKIE == $show_money) {
                $foodmoney_max_HTML .= "<option value='".$show_money."' selected='selected'>".$show_money_str."</option>";
            } else {
                $foodmoney_max_HTML .= "<option value='".$show_money."'>".$show_money_str."</option>";
            }
        }

        $foodtype_HTML = '<option value="0">都可以</option>';
        foreach($Foodtype as $key => $val) {
            if($foodtype_COOKIE == $key) {
                $foodtype_HTML .= "<option value='".$key."' selected='selected'>".$val."</option>";
            } else {
                $foodtype_HTML .= "<option value='".$key."'>".$val."</option>";
            }
        }

        return [
            'remember_HTML' => $remember_HTML,
            'foodwhere_region_HTML' => $foodwhere_region_HTML,
            'foodmoney_max_HTML' => $foodmoney_max_HTML,
            'foodmoney_min_HTML' => $foodmoney_min_HTML,
            'foodtype_HTML' => $foodtype_HTML,
        ];
    }

    protected function buildOptionHTML($region, $section, $max, $min, $type, $Regionid, $Sectionid, $Area_rel, $Foodtype)
    {
        $data = [];

        $data['remember_HTML'] = '<input type="checkbox" id="remember_box" name="remember_box">';

        $data['foodwhere_region_HTML'] = '';
        foreach($Regionid as $key => $val) {
            if($region == $key) {
                $data['foodwhere_region_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
            } else {
                $data['foodwhere_region_HTML'] .= "<option value='".$key."'>".$val."</option>";
            }
        }

        $data['foodwhere_section_HTML'] = '<option value="0">全區</option>';
        foreach($Area_rel[$region] as $key => $val) {
            if($section == $val) {
                $data['foodwhere_section_HTML'] .= "<option value='".$val."' selected='selected'>".$Sectionid[$val]."</option>";
            } else {
                $data['foodwhere_section_HTML'] .= "<option value='".$val."'>".$Sectionid[$val]."</option>";
            }
        }

        $data['foodmoney_max_HTML'] = '<option value="0">都可以</option>';
        for($money = 1; $money < 11; $money++) {
            if($max == ((int)$money*100)) {
                $data['foodmoney_max_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
            } else {
                $data['foodmoney_max_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
            }
        }

        $data['foodmoney_min_HTML'] = '<option value="0">0元</option>';
        for($money = 1; $money < 11; $money++) {
            if($min == ((int)$money*100)) {
                $data['foodmoney_min_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
            } else {
                $data['foodmoney_min_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
            }
        }

        $data['foodtype_HTML'] = '<option value="0">都可以</option>';
        foreach($Foodtype as $key => $val) {
            if($type == $key) {
                $data['foodtype_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
            } else {
                $data['foodtype_HTML'] .= "<option value='".$key."'>".$val."</option>";
            }
        }

        return $data;
    }

    protected function formatWhere($where)
    {
        $formatted = [];
        foreach($where as $key => $value) {
            if(is_int($key)) {
                $formatted[] = $value;
            } else {
                $formatted[$key] = $value;
            }
        }
        return $formatted;
    }
}
