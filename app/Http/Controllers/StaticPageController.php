<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

class StaticPageController extends Controller
{
    public function map()
    {
        return view('jazamila.map');
    }

    public function about()
    {
        return view('jazamila.about');
    }

    public function post()
    {
        $data = [
            'title'  => 'JAZAMILA - 餐廳分享',
            'config' => [
                'regionid' => config('area.Regionid', []),
                'foodtype' => config('type', []),
            ],
            'save'   => '0'
        ];
        return view('jazamila.post', $data);
    }

    public function captchaImg(Request $request)
    {
        $im        = imagecreate(60, 30);
        $bg        = imagecolorallocate($im, 249, 112, 92);
        $textcolor = imagecolorallocate($im, 255, 255, 255);

        $text    = '';
        $textAll = array_merge(range('A', 'Z'), range('a', 'z'), range('0', '9'));
        $length  = 4;
        for ($i = 1; $i <= $length;) {
            $val = $textAll[rand(0, 61)];
            if ($val !== 'O' && $val !== 'o' && $val !== '0') {
                $text .= $val;
                $i++;
            }
        }

        $request->session()->put('check_number', $text);
        imagestring($im, 6, 14, 8, $text, $textcolor);

        ob_start();
        imagepng($im);
        $imageData = ob_get_clean();
        imagedestroy($im);

        return Response::make($imageData, 200, ['Content-Type' => 'image/png']);
    }
}
