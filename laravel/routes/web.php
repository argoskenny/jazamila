<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StaticPageController;
use App\Http\Controllers\JazamilaController;

// Core site routes
Route::get('/', [JazamilaController::class, 'index']);
Route::get('/listdata/{location}/{type}/{max}/{min}/{page}', [JazamilaController::class, 'listdata']);
Route::get('/detail/{id}', [JazamilaController::class, 'detail'])->whereNumber('id');
Route::get('/jsonapi', [JazamilaController::class, 'jsonapi']);

// Static pages
Route::get('/map', [StaticPageController::class, 'map']);
Route::get('/about', [StaticPageController::class, 'about']);
Route::get('/post', [StaticPageController::class, 'post']);
Route::get('/CaptchaImg', [StaticPageController::class, 'captchaImg']);
