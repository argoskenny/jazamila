<?php
namespace App\Http\Controllers;

class AdminAjaxController
{
    private array $adminList;

    public function __construct()
    {
        $file = dirname(__DIR__, 4) . '/application/rf_config/admin.inc.php';
        $this->adminList = [];
        if (file_exists($file)) {
            require $file;
            if (isset($admin_list)) {
                $this->adminList = $admin_list;
            }
        }
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
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
        // Database operations would occur here.
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
        // Database update would happen here.
        return $this->response(['status' => 'success', 'img' => $resizeImg]);
    }

    public function fixBlog(array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        return $this->response(['status' => 'success']);
    }

    public function passBlog(array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        return $this->response(['status' => 'success']);
    }

    public function unpassBlog(array $input): array
    {
        if (!$this->authorized()) {
            return $this->response(['status' => 'unauthorized'], 401);
        }
        return $this->response(['status' => 'success']);
    }
}
