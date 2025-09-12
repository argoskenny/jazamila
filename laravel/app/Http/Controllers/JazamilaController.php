<?php
namespace {
    require_once __DIR__ . '/../../helpers.php';
}

namespace App\Http\Controllers {

use App\Models\Restaurant;
use App\Models\Blog;

class JazamilaController
{ 
    public function index(array $cookies = []): array
    {
        $data = $this->cookieOption($cookies);
        $data['config']['regionid'] = $this->getRegions();
        $data['config']['foodtype'] = $this->getFoodTypes();
        $data['title'] = 'JAZAMILA';
        return $data;
    }

    public function listdata($location, $type, $max, $min, $page, array $query = []): array
    {
        $this->checkSegment($type);
        $this->checkSegment($max);
        $this->checkSegment($min);
        $this->checkSegment($page);

        $where = [];
        $main_text = [];
        $url_region = 0;
        $url_section = 0;
        $keyword = '';
        $sufix_q = '';

        if (!empty($query['search_keyword'])) {
            $keyword = $query['search_keyword'];
            $search_keyword_value = $query['search_keyword'];
            $keyword_pagelink = '?search_keyword=' . $query['search_keyword'];
            $sufix_q = '?';
        } else {
            $keyword_pagelink = '';
            $search_keyword_value = '請輸入關鍵字';
        }

        $Regionid = $this->getRegions();
        $Sectionid = $this->getSections();
        $Foodtype = $this->getFoodTypes();

        if ($location != 0) {
            $arr = explode('X', $location);
            $url_region = (int)$arr[0];
            $url_section = (int)$arr[1];
            $where['res_region'] = $url_region;
            if ($url_section != 0) {
                $where['res_section'] = $url_section;
            }
        }
        if ($type != 0) {
            $where['res_foodtype'] = $type;
        }
        if ($max != 0) {
            $where['res_price <='] = $max;
        }
        if ($min != 0) {
            $where['res_price >='] = $min;
        }

        if ($location == 0 && $type == 0 && $max == 0 && $min == 0 && $keyword == '') {
            $main_text[] = '所有';
        } else {
            if ($location != 0) {
                $location_text = '地點為' . $Regionid[$url_region];
                if ($url_section != 0) {
                    $location_text .= $Sectionid[$url_section];
                }
                $main_text[] = $location_text;
            }
            if ($type != 0) {
                $main_text[] = '美食類型為' . $Foodtype[$type];
            }
            if ($max != 0 || $min != 0) {
                $max_str = ($max == 0) ? '無上限' : $max . '元';
                $main_text[] = '平均價位由' . $min . '元至' . $max_str;
            }
            if ($keyword != '') {
                $main_text[] = '關鍵字為' . $keyword;
            }
        }
        $data['main_text'] = implode('，', $main_text) . '的餐廳';

        $total_rows = Restaurant::countWhere($where, $keyword);
        $per_page = 10;
        $total_pages = ($total_rows == 0) ? 1 : (int)ceil($total_rows / $per_page);
        if ($page < 1) $page = 1;
        if ($page > $total_pages) $page = $total_pages;

        $base = "listdata/$location/$type/$max/$min/";
        $pages = '<ul class="pagination">';
        if ($page > 1) {
            $pages .= '<li><a href="' . $base . '1' . $keyword_pagelink . '">&laquo;</a></li>';
            $pages .= '<li><a href="' . $base . ($page - 1) . $keyword_pagelink . '">&lsaquo;</a></li>';
        }
        for ($i = max(1, $page - 2); $i <= min($total_pages, $page + 2); $i++) {
            if ($i == $page) {
                $pages .= '<li class="active"><span>' . $i . '<span class="sr-only">(current)</span></span></li>';
            } else {
                $pages .= '<li><a href="' . $base . $i . $keyword_pagelink . '">' . $i . '</a></li>';
            }
        }
        if ($page < $total_pages) {
            $pages .= '<li><a href="' . $base . ($page + 1) . $keyword_pagelink . '">&rsaquo;</a></li>';
            $pages .= '<li><a href="' . $base . $total_pages . $keyword_pagelink . '">&raquo;</a></li>';
        }
        $pages .= '</ul>';
        $data['pages'] = $pages;

        $data['restuarant'] = Restaurant::showList($page, $where, $keyword);
        $data['config']['foodtype'] = $Foodtype;
        $data['config']['region'] = $Regionid;
        $data['config']['section'] = $Sectionid;

        $data['url_region'] = $url_region;
        $data['url_section'] = $url_section;
        $data['url_type'] = $type;
        $data['url_maxmoney'] = $max;
        $data['url_minmoney'] = $min;
        $data['url_page'] = $page;

        $data['list_record'] = '?ul=' . $location . '&ut=' . $type . '&umx=' . $max . '&umi=' . $min . '&p=' . $page;
        $data['current_num'] = $total_rows;
        $data['search_keyword_value'] = $search_keyword_value;
        $data['title'] = 'JAZAMILA - 餐廳列表';
        return $data;
    }

    public function detail($id, array $query = [], array $cookies = []): array
    {
        $data = [];
        if (($cookies['remember'] ?? 0) == 1) {
            $data = $this->cookieOption($cookies);
            $data['cookie_flag'] = 1;
        } else {
            $data = $this->cookieOption([]);
            $data['cookie_flag'] = 0;
        }

        $restaurant = Restaurant::detail($id);
        if (empty($restaurant)) {
            return [];
        }
        $data['res_data'] = $restaurant[0];
        $data['blog'] = Blog::forRestaurant($id);
        $data['recommend_res1'] = [];
        $data['recommend_res2'] = [];
        $data['recommend_res3'] = [];
        $data['recommend_res4'] = [];

        $url_location = $query['ul'] ?? 0;
        $url_type = $query['ut'] ?? 0;
        $url_maxmoney = $query['umx'] ?? 0;
        $url_minmoney = $query['umi'] ?? 0;
        $currentPage = $query['p'] ?? 1;
        $data['list_record'] = $url_location . '/' . $url_type . '/' . $url_maxmoney . '/' . $url_minmoney . '/' . $currentPage;
        $data['title'] = 'JAZAMILA - 餐廳詳細資料';
        return $data;
    }

    public function jsonapi(): array
    {
        $url = 'http://jazamila.com/assets/pics/';
        $data = Restaurant::apiAllList();
        foreach ($data as $key => $value) {
            $data[$key]['res_img_url'] = $url . $value['res_img_url'];
        }
        return $data;
    }

    private function cookieOption(array $cookies): array
    {
        $Regionid = $this->getRegions();
        $Foodtype = $this->getFoodTypes();

        $foodwhere_region = $cookies['foodwhere_region'] ?? 0;
        $foodmoney_max = $cookies['foodmoney_max'] ?? 0;
        $foodmoney_min = $cookies['foodmoney_min'] ?? 0;
        $foodtype = $cookies['foodtype'] ?? 0;
        $remember = $cookies['remember'] ?? 0;

        $remember_HTML = $remember ? '<input type="checkbox" id="remember_box" name="remember_box" checked="checked">'
            : '<input type="checkbox" id="remember_box" name="remember_box">';

        $foodwhere_region_HTML = '';
        foreach ($Regionid as $key => $val) {
            $selected = ($foodwhere_region == $key) ? " selected='selected'" : '';
            $foodwhere_region_HTML .= "<option value='$key'$selected>$val</option>";
        }

        $foodmoney_min_HTML = '';
        for ($money = 0; $money <= 1100; $money += 100) {
            $show_money = $money;
            if ($show_money == 0) {
                $show_money_str = '0元';
            } elseif ($show_money == 1100) {
                $show_money_str = '1000元以上';
            } else {
                $show_money_str = $show_money . '元左右';
            }
            $selected = ($foodmoney_min == $show_money) ? " selected='selected'" : '';
            $foodmoney_min_HTML .= "<option value='$show_money'$selected>$show_money_str</option>";
        }

        $foodmoney_max_HTML = '';
        for ($money = 0; $money <= 1100; $money += 100) {
            $show_money = $money;
            if ($show_money == 0) {
                $show_money_str = '都可以';
            } elseif ($show_money == 1100) {
                $show_money_str = '1000元以上';
            } else {
                $show_money_str = $show_money . '元左右';
            }
            $selected = ($foodmoney_max == $show_money) ? " selected='selected'" : '';
            $foodmoney_max_HTML .= "<option value='$show_money'$selected>$show_money_str</option>";
        }

        $foodtype_HTML = '<option value="0">都可以</option>';
        foreach ($Foodtype as $key => $val) {
            $selected = ($foodtype == $key) ? " selected='selected'" : '';
            $foodtype_HTML .= "<option value='$key'$selected>$val</option>";
        }

        return [
            'remember_HTML' => $remember_HTML,
            'foodwhere_region_HTML' => $foodwhere_region_HTML,
            'foodmoney_max_HTML' => $foodmoney_max_HTML,
            'foodmoney_min_HTML' => $foodmoney_min_HTML,
            'foodtype_HTML' => $foodtype_HTML,
        ];
    }

    private function checkSegment($var): void
    {
        if (!is_numeric($var)) {
            throw new \InvalidArgumentException('non numeric');
        }
    }

    private function getRegions(): array
    {
        return config('area.Regionid', []);
    }

    private function getSections(): array
    {
        return config('area.Sectionid', []);
    }

    private function getFoodTypes(): array
    {
        return config('type', []);
    }
}
}
