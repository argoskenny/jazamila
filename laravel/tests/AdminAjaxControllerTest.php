<?php
require_once __DIR__ . '/../app/Http/Controllers/AdminAjaxController.php';
use App\Http\Controllers\AdminAjaxController;

function assertEqual($a, $b, $message)
{
    if ($a !== $b) {
        echo "FAIL: $message\n";
        var_export($a);
        var_export($b);
        exit(1);
    }
}

// ensure session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$_SESSION = [];

$controller = new AdminAjaxController();

// Login success
$response = $controller->login(['id' => 'admin', 'pass' => 'password']);
assertEqual($response['status'], 200, 'login success status');
assertEqual($response['headers']['Content-Type'], 'application/json', 'login header');
$data = json_decode($response['body'], true);
assertEqual($data['status'], 'success', 'login payload');
assertEqual($_SESSION['id'], 'admin', 'session set');

// Login failure
$responseFail = $controller->login(['id' => 'admin', 'pass' => 'wrong']);
assertEqual($responseFail['status'], 401, 'login fail status');
assertEqual($responseFail['headers']['Content-Type'], 'application/json', 'login fail header');
$dataFail = json_decode($responseFail['body'], true);
assertEqual($dataFail['status'], 'fail', 'login fail payload');

// Unauthorized saveResPic
$_SESSION = [];
$unauth = $controller->saveResPic([], []);
assertEqual($unauth['status'], 401, 'unauthorized status');
assertEqual($unauth['headers']['Content-Type'], 'application/json', 'unauthorized header');

// Authorized file upload
$_SESSION['id'] = 'admin';
$tmp = tempnam(sys_get_temp_dir(), 'upl');
file_put_contents($tmp, 'file');
$files = ['img_url' => ['name' => 'test.jpg', 'tmp_name' => $tmp, 'error' => 0]];
$resp = $controller->saveResPic($files, ['edit_id' => 1]);
assertEqual($resp['status'], 200, 'upload success status');
assertEqual($resp['headers']['Content-Type'], 'application/json', 'upload header');
$respData = json_decode($resp['body'], true);
assertEqual($respData['status'], 'success', 'upload success payload');

// SaveResData validation
$_SESSION['id'] = 'admin';
$fail = $controller->saveResData([]);
assertEqual($fail['status'], 422, 'validation status');
$failData = json_decode($fail['body'], true);
assertEqual($failData['error'], 'res_name required', 'validation message');

$success = $controller->saveResData([
    'res_name' => 'foo',
    'res_area_num' => '1',
    'res_tel_num' => '123',
    'res_region' => 'region',
    'res_address' => 'addr',
    'res_foodtype' => 'type',
    'res_price' => '10',
    'open_time_hr' => '10',
    'open_time_min' => '00',
    'close_time_hr' => '20',
    'close_time_min' => '00',
    'res_note' => 'note'
]);
assertEqual($success['status'], 200, 'save data success status');

// finish
echo "All tests passed\n";
