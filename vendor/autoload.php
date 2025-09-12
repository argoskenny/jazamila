<?php
spl_autoload_register(function(string $class){
    $appPrefix = 'App\\';
    $baseDir = __DIR__.'/../laravel/app/';
    if(str_starts_with($class, $appPrefix)){
        $relative = substr($class, strlen($appPrefix));
        $file = $baseDir.str_replace('\\','/',$relative).'.php';
        if(file_exists($file)){
            require $file;
        }
        return;
    }
    $testPrefix = 'Tests\\';
    $testDir = __DIR__.'/../laravel/tests/';
    if(str_starts_with($class, $testPrefix)){
        $relative = substr($class, strlen($testPrefix));
        $file = $testDir.str_replace('\\','/',$relative).'.php';
        if(file_exists($file)){
            require $file;
        }
        return;
    }
    $phpunitPrefix = 'PHPUnit\\';
    $phpunitDir = __DIR__.'/PHPUnit/';
    if(str_starts_with($class, $phpunitPrefix)){
        $relative = substr($class, strlen($phpunitPrefix));
        $file = $phpunitDir.str_replace('\\','/',$relative).'.php';
        if(file_exists($file)){
            require $file;
        }
    }
});
