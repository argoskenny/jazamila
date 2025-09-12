<?php
if (!function_exists('config')) {
    function config(string $key, $default = null) {
        static $configs = [];
        $segments = explode('.', $key);
        $file = array_shift($segments);
        if (!isset($configs[$file])) {
            $path = __DIR__ . '/../config/' . $file . '.php';
            if (file_exists($path)) {
                $configs[$file] = require $path;
            } else {
                $configs[$file] = [];
            }
        }
        $data = $configs[$file];
        foreach ($segments as $segment) {
            if (!is_array($data) || !array_key_exists($segment, $data)) {
                return $default;
            }
            $data = $data[$segment];
        }
        return $data;
    }
}

spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $base_dir = __DIR__ . '/';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    $relative = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative) . '.php';
    if (file_exists($file)) {
        require $file;
    }
});
