<?php
namespace {
    require_once __DIR__ . '/../../helpers.php';
}

namespace App\Http\Controllers {

use App\Models\Admin\Restaurant as RestaurantModel;
use App\Models\Admin\Blog as BlogModel;

class AdminAjaxController
{
    private array $adminList;

    public function __construct()
    {
        $this->adminList = config('admin', []);
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
    }

    private function response(array $payload, int $status = 200, array $headers = []): array
    {
        $headers = array_merge(['Content-Type' => 'application/json'], $headers);
        return [
            'status' => $status,
            'headers' => $headers,
            'body' => json_encode($payload)
        ];
    }

    private function authorized(): bool
    {
        return isset($_SESSION['id']) && array_key_exists($_SESSION['id'], $this->adminList);
    }

    public function login(array $input): array
    {
        $id = $input['id'] ?? null;
        $pass = $input['pass'] ?? null;
        if ($id && $pass && array_key_exists($id, $this->adminList) && $this->adminList[$id] === $pass) {
            $_SESSION['id'] = $id;
            return $this->response(['status' => 'success']);
        }
        return $this->response(['status' => 'fail'], 401);
    }

    public function saveResData(array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        if (empty($input['res_name'])) {
            return $this->response(['status' => 'fail', 'error' => 'res_name required'], 422);
        }
        $openHr = $input['open_time_hr'] ?? null;
        $openMin = $input['open_time_min'] ?? null;
        $openTime = ($openHr !== null && $openMin !== null) ? strtotime($openHr . ':' . $openMin . ':00') : '';
        $closeHr = $input['close_time_hr'] ?? null;
        $closeMin = $input['close_time_min'] ?? null;
        $closeTime = ($closeHr !== null && $closeMin !== null) ? strtotime($closeHr . ':' . $closeMin . ':00') : '';
        $resAreaNum = str_pad($input['res_area_num'] ?? '', 2, '0', STR_PAD_LEFT);
        $resNote = !empty($input['res_note']) ? nl2br($input['res_note']) : '';

        $data = [
            'res_name' => $input['res_name'],
            'res_area_num' => $resAreaNum,
            'res_tel_num' => $input['res_tel_num'] ?? '',
            'res_region' => $input['res_region'] ?? '',
            'res_address' => $input['res_address'] ?? '',
            'res_foodtype' => $input['res_foodtype'] ?? '',
            'res_price' => $input['res_price'] ?? '',
            'res_open_time' => $openTime,
            'res_close_time' => $closeTime,
            'res_note' => $resNote,
        ];

        if (!empty($input['edit_id'])) {
            RestaurantModel::update((int)$input['edit_id'], $data);
        } else {
            RestaurantModel::create($data);
        }
        return $this->response(['status' => 'success']);
    }

    public function saveResPic(array $files, array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        if (empty($files['img_url'])) {
            return $this->response(['status' => 'fail', 'error' => 'no_file'], 422);
        }
        $file = $files['img_url'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return $this->response(['status' => 'fail', 'error' => $file['error']], 400);
        }
        $base = dirname(__DIR__, 4);
        $tmpDir = $base . '/assets/tmp';
        $picsDir = $base . '/assets/pics';
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0777, true);
        }
        if (!is_dir($picsDir)) {
            mkdir($picsDir, 0777, true);
        }
        $tmpFile = $tmpDir . '/' . $file['name'];
        if (!@move_uploaded_file($file['tmp_name'], $tmpFile)) {
            rename($file['tmp_name'], $tmpFile);
        }
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $resizeImg = 'preview_' . time() . '.' . $ext;
        copy($tmpFile, $picsDir . '/' . $resizeImg);
        return $this->response(['status' => 'success', 'img' => $resizeImg]);
    }

    public function fixBlog(array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        $id = $input['id'] ?? null;
        if (!$id || !BlogModel::find((int)$id)) {
            return $this->response(['status' => 'fail'], 422);
        }
        $update = [];
        if (!empty($input['b_blogname'])) {
            $update['b_blogname'] = $input['b_blogname'];
        }
        if (!empty($input['b_bloglink'])) {
            $update['b_bloglink'] = $input['b_bloglink'];
        }
        BlogModel::update((int)$id, $update);
        return $this->response(['status' => 'success']);
    }

    public function passBlog(array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        $id = $input['id'] ?? null;
        if (!$id || !BlogModel::update((int)$id, ['b_blog_show' => '1'])) {
            return $this->response(['status' => 'fail'], 422);
        }
        return $this->response(['status' => 'success']);
    }

    public function unpassBlog(array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        $id = $input['id'] ?? null;
        if (!$id || !BlogModel::update((int)$id, ['b_blog_show' => '0'])) {
            return $this->response(['status' => 'fail'], 422);
        }
        return $this->response(['status' => 'success']);
    }
}
}
