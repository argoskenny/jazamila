<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StaticPageController;

Route::get('/map', [StaticPageController::class, 'map']);
Route::get('/about', [StaticPageController::class, 'about']);
Route::get('/post', [StaticPageController::class, 'post']);
Route::get('/CaptchaImg', [StaticPageController::class, 'captchaImg']);

