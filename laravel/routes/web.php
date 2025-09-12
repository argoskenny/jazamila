<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\JazamilaController;
use App\Http\Controllers\JazamilaAjaxController;
use App\Http\Controllers\Admin\{DashboardController,AuthController,RestaurantController,PostController,BlogController,FeedbackController,UtilityController};

Route::get('/', [JazamilaController::class, 'index']);
Route::get('/listdata/{any?}', [JazamilaController::class, 'listdata']);
Route::get('/detail/{any?}', [JazamilaController::class, 'detail']);
Route::get('/map', [JazamilaController::class, 'map']);
Route::get('/about', [JazamilaController::class, 'about']);
Route::get('/post', [JazamilaController::class, 'post']);

Route::prefix('jazamila_ajax')->group(function () {
    Route::post('/pick', [JazamilaAjaxController::class, 'pick']);
    Route::post('/check_captcha', [JazamilaAjaxController::class, 'checkCaptcha']);
    Route::post('/save_feedback_post', [JazamilaAjaxController::class, 'saveFeedbackPost']);
    Route::post('/get_section', [JazamilaAjaxController::class, 'getSection']);
    Route::post('/get_section_cookie', [JazamilaAjaxController::class, 'getSectionCookie']);
    Route::post('/listdata_get_section', [JazamilaAjaxController::class, 'listdataGetSection']);
    Route::post('/blog_save', [JazamilaAjaxController::class, 'blogSave']);
});

Route::prefix('admin')->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('admin.index');
    Route::get('/login', [AuthController::class, 'login'])->name('admin.login');
    Route::post('/login', [AuthController::class, 'authenticate'])->name('admin.login.post');

    Route::middleware('admin.auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout'])->name('admin.logout');

        // Restaurant routes
        Route::get('/res_list/{set}', [RestaurantController::class, 'list'])->name('admin.res_list');
        Route::get('/res_detail/{res_id}', [RestaurantController::class, 'detail'])->name('admin.res_detail');
        Route::get('/res_insert', [RestaurantController::class, 'insert'])->name('admin.res_insert');
        Route::get('/res_edit/{res_id}', [RestaurantController::class, 'edit'])->name('admin.res_edit');
        Route::post('/save_res_data', [RestaurantController::class, 'save'])->name('admin.save_res_data');

        // Post routes
        Route::get('/post_unreview/{set}', [PostController::class, 'unreview'])->name('admin.post_unreview');
        Route::get('/post_passed/{set}', [PostController::class, 'passed'])->name('admin.post_passed');
        Route::get('/post_unpass/{set}', [PostController::class, 'unpass'])->name('admin.post_unpass');
        Route::get('/post_edit/{post_id}', [PostController::class, 'edit'])->name('admin.post_edit');
        Route::post('/save_post_data', [PostController::class, 'save'])->name('admin.save_post_data');

        // Blog routes
        Route::get('/blog_unreview/{set}', [BlogController::class, 'unreview'])->name('admin.blog_unreview');
        Route::get('/blog_passed/{set}', [BlogController::class, 'passed'])->name('admin.blog_passed');
        Route::get('/blog_unpass/{set}', [BlogController::class, 'unpass'])->name('admin.blog_unpass');
        Route::get('/blog_edit/{id}', [BlogController::class, 'edit'])->name('admin.blog_edit');

        // Feedback
        Route::get('/feedback_list/{set}', [FeedbackController::class, 'list'])->name('admin.feedback_list');

        // Utilities
        Route::get('/admin_menu', [UtilityController::class, 'menu'])->name('admin.admin_menu');
        Route::post('/fix_address', [UtilityController::class, 'fixAddress'])->name('admin.fix_address');
    });
});
