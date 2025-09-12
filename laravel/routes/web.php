<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\{DashboardController,AuthController,RestaurantController,PostController,BlogController,FeedbackController,UtilityController};

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