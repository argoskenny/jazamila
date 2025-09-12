<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\JazamilaController;

Route::get('/', [JazamilaController::class, 'index']);
Route::get('/listdata/{any?}', [JazamilaController::class, 'listdata']);
Route::get('/detail/{any?}', [JazamilaController::class, 'detail']);
Route::get('/map', [JazamilaController::class, 'map']);
Route::get('/about', [JazamilaController::class, 'about']);
Route::get('/post', [JazamilaController::class, 'post']);
