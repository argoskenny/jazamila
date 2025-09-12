<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('r_post', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('post_name');
            $table->string('post_area_num', 10)->nullable();
            $table->string('post_tel_num', 20)->nullable();
            $table->integer('post_region')->default(0);
            $table->integer('post_section')->default(0);
            $table->string('post_address')->nullable();
            $table->integer('post_foodtype')->default(0);
            $table->integer('post_price')->default(0);
            $table->unsignedBigInteger('post_open_time')->default(0);
            $table->unsignedBigInteger('post_close_time')->default(0);
            $table->text('post_note')->nullable();
            $table->unsignedBigInteger('post_updatetime')->default(0);
            $table->string('post_img_url')->nullable();
            $table->string('post_img_ori_url')->nullable();
            $table->tinyInteger('post_prove')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('r_post');
    }
};
