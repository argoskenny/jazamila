<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cookie;

class JazamilaAjaxController
{
    /**
     * Hardcoded restaurant data used for random selection tests.
     *
     * @var array<int,array<string,int>>
     */
    private array $restaurants = [
        ['id' => 1, 'res_region' => 1, 'res_section' => 2, 'res_price' => 50,  'res_foodtype' => 1],
        ['id' => 2, 'res_region' => 1, 'res_section' => 3, 'res_price' => 150, 'res_foodtype' => 2],
        ['id' => 3, 'res_region' => 2, 'res_section' => 1, 'res_price' => 200, 'res_foodtype' => 1],
    ];

    /**
     * Simplified section data for ajax endpoints.
     *
     * @var array<int,array<int,string>> region => [sectionId => sectionName]
     */
    private array $sections = [
        1 => [
            2 => '大同區',
            3 => '中山區',
        ],
    ];

    /**
     * Random restaurant selection with cookie handling.
     */
    public function pick(Request $request): JsonResponse
    {
        $foodwhere_region = (int) $request->input('foodwhere_region', 0);
        $foodwhere_section = (int) $request->input('foodwhere_section', 0);
        $foodmoney_max = (int) $request->input('foodmoney_max', 0);
        $foodmoney_min = (int) $request->input('foodmoney_min', 0);
        $foodtype = (int) $request->input('foodtype', 0);
        $remember = (int) $request->input('remember', 0);

        // Filter restaurants based on conditions
        $candidates = array_filter($this->restaurants, function ($res) use (
            $foodwhere_region,
            $foodwhere_section,
            $foodmoney_max,
            $foodmoney_min,
            $foodtype
        ) {
            if ($foodwhere_region && $res['res_region'] != $foodwhere_region) {
                return false;
            }
            if ($foodwhere_section && $res['res_section'] != $foodwhere_section) {
                return false;
            }
            if ($foodmoney_max && $res['res_price'] > $foodmoney_max) {
                return false;
            }
            if ($foodmoney_min && $res['res_price'] < $foodmoney_min) {
                return false;
            }
            if ($foodtype && $res['res_foodtype'] != $foodtype) {
                return false;
            }
            return true;
        });

        $res_id = 0;
        if (count($candidates) > 0) {
            $res = $candidates[array_rand($candidates)];
            $res_id = $res['id'];
        }

        $response = response()->json(['status' => 'success', 'res_id' => $res_id]);

        if ($remember === 1) {
            $minutes = (int) (8650000 / 60); // mimic CI expiration
            $cookies = [
                'remember' => $remember,
                'foodwhere_region' => $foodwhere_region,
                'foodwhere_section' => $foodwhere_section,
                'foodmoney_max' => $foodmoney_max,
                'foodmoney_min' => $foodmoney_min,
                'foodtype' => $foodtype,
            ];
            foreach ($cookies as $name => $value) {
                $response->cookie($name, (string) $value, $minutes);
            }
        } else {
            foreach (['remember', 'foodwhere_region', 'foodwhere_section', 'foodmoney_max', 'foodmoney_min', 'foodtype'] as $name) {
                $response->cookie(Cookie::forget($name));
            }
        }

        return $response;
    }

    /**
     * Captcha validation using session value.
     */
    public function checkCaptcha(Request $request): Response
    {
        $captcha = (string) $request->input('captcha', '');
        $sessionNumber = $request->session()->get('check_number');
        $result = ($captcha !== '' && $captcha === $sessionNumber) ? 'success' : 'fail';
        return response($result, 200)->header('Content-Type', 'text/html');
    }

    /**
     * Store user feedback to a temporary JSON file.
     */
    public function saveFeedbackPost(Request $request): Response
    {
        $entry = [
            'f_name' => (string) $request->input('name', ''),
            'f_email' => (string) $request->input('email', ''),
            'f_content' => (string) $request->input('content', ''),
            'f_time' => time(),
        ];
        $file = sys_get_temp_dir() . '/feedback.json';
        $data = [];
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true) ?: [];
        }
        $data[] = $entry;
        $ok = file_put_contents($file, json_encode($data)) !== false;
        return response($ok ? 'success' : 'fail', 200)->header('Content-Type', 'text/html');
    }

    /**
     * Save blog information to a temporary JSON file.
     */
    public function blogSave(Request $request): JsonResponse
    {
        $entry = [
            'b_blogname' => (string) $request->input('res_blogname', ''),
            'b_bloglink' => (string) $request->input('res_bloglink', ''),
            'b_res_id' => (string) $request->input('res_id', ''),
        ];
        $file = sys_get_temp_dir() . '/blog.json';
        $data = [];
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true) ?: [];
        }
        $data[] = $entry;
        $ok = file_put_contents($file, json_encode($data)) !== false;
        return response()->json(['status' => $ok ? 'success' : 'fail']);
    }

    /**
     * Provide section options based on region id.
     */
    public function getSection(Request $request): Response
    {
        $regionId = (int) $request->input('regionid', 0);
        $html = '';
        foreach ($this->sections[$regionId] ?? [] as $id => $name) {
            $html .= "<option value=\"{$id}\">{$name}</option>";
        }
        return response($html, 200)->header('Content-Type', 'text/html');
    }

    /**
     * Provide section options with cookie pre-selection.
     */
    public function getSectionCookie(Request $request): Response
    {
        $regionId = (int) $request->input('regionid', 0);
        $selected = (int) $request->cookie('foodwhere_section', 0);
        $html = '';
        foreach ($this->sections[$regionId] ?? [] as $id => $name) {
            $sel = $selected === $id ? ' selected="selected"' : '';
            $html .= "<option value=\"{$id}\"{$sel}>{$name}</option>";
        }
        return response($html, 200)->header('Content-Type', 'text/html');
    }

    /**
     * Provide section list for restaurant listing.
     */
    public function listdataGetSection(Request $request): Response
    {
        $regionId = (int) $request->input('regionid', 0);
        $html = "<li><a href=\"javascript:void(0);\" onclick=\"section_click('0','全區');\">全區</a></li>";
        foreach ($this->sections[$regionId] ?? [] as $id => $name) {
            $html .= "<li><a href=\"javascript:void(0);\" onclick=\"section_click('{$id}','{$name}');\">{$name}</a></li>";
        }
        return response($html, 200)->header('Content-Type', 'text/html');
    }
}

