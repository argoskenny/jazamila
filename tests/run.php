<?php
require_once __DIR__.'/../laravel/app/Http/Controllers/JazamilaAjaxController.php';

use App\Http\Controllers\JazamilaAjaxController;
use App\Http\Controllers\SimpleRequest;

$controller = new JazamilaAjaxController();

// ---- Test pick: sets cookies and returns JSON ----
$session = [];
$request = new SimpleRequest([
    'foodwhere_region' => 1,
    'foodwhere_section' => 2,
    'foodmoney_max' => 0,
    'foodmoney_min' => 0,
    'foodtype' => 1,
    'remember' => 1,
], [], $session);
$response = $controller->pick($request);
assert($response->getHeader('Content-Type') === 'application/json');
$data = json_decode($response->getContent(), true);
assert($data['status'] === 'success' && $data['res_id'] === 1);
$cookieNames = array_map(fn($c) => explode('=', $c)[0], $response->getCookies());
assert(in_array('remember', $cookieNames));

// ---- Test pick with remember=0 clears cookie ----
$request = new SimpleRequest([
    'foodwhere_region' => 0,
    'foodwhere_section' => 0,
    'foodmoney_max' => 0,
    'foodmoney_min' => 0,
    'foodtype' => 0,
    'remember' => 0,
], ['remember' => '1'], $session);
$response = $controller->pick($request);
$rememberCookie = null;
foreach ($response->getCookies() as $cookie) {
    if (str_starts_with($cookie, 'remember=')) {
        $rememberCookie = $cookie;
        break;
    }
}
assert($rememberCookie !== null);
preg_match('/expires=([^;]+)/', $rememberCookie, $m);
assert(isset($m[1]) && strtotime($m[1]) < time());

// ---- Test checkCaptcha success/fail ----
$session = ['check_number' => '1234'];
$request = new SimpleRequest(['captcha' => '1234'], [], $session);
$res = $controller->checkCaptcha($request);
assert($res->getContent() === 'success');

$request = new SimpleRequest(['captcha' => '0000'], [], $session);
$res = $controller->checkCaptcha($request);
assert($res->getContent() === 'fail');
assert($res->getHeader('Content-Type') === 'text/html');

// ---- Test saveFeedbackPost ----
@unlink(sys_get_temp_dir() . '/feedback.json');
$request = new SimpleRequest([
    'name' => 'Alice',
    'email' => 'a@example.com',
    'content' => 'hello'
], [], $session);
$res = $controller->saveFeedbackPost($request);
assert($res->getContent() === 'success');
assert($res->getHeader('Content-Type') === 'text/html');
$stored = json_decode(file_get_contents(sys_get_temp_dir() . '/feedback.json'), true);
assert($stored[0]['f_name'] === 'Alice');

// ---- Test blogSave ----
@unlink(sys_get_temp_dir() . '/blog.json');
$request = new SimpleRequest([
    'res_blogname' => 'Test',
    'res_bloglink' => 'http://example.com',
    'res_id' => 5
], [], $session);
$res = $controller->blogSave($request);
$data = json_decode($res->getContent(), true);
assert($data['status'] === 'success');
assert($res->getHeader('Content-Type') === 'application/json');
$stored = json_decode(file_get_contents(sys_get_temp_dir() . '/blog.json'), true);
assert($stored[0]['b_blogname'] === 'Test');

echo "All tests passed\n";
