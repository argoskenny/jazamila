<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('r_restaurant', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('res_name');
            $table->string('res_area_num', 10)->nullable();
            $table->string('res_tel_num', 20)->nullable();
            $table->integer('res_region')->default(0);
            $table->integer('res_section')->default(0);
            $table->string('res_address')->nullable();
            $table->integer('res_foodtype')->default(0);
            $table->integer('res_price')->default(0);
            $table->unsignedBigInteger('res_open_time')->default(0);
            $table->unsignedBigInteger('res_close_time')->default(0);
            $table->text('res_note')->nullable();
            $table->string('res_img_url')->nullable();
            $table->string('res_img_ori_url')->nullable();
            $table->unsignedBigInteger('res_updatetime')->nullable();
            $table->unsignedBigInteger('res_post_id')->default(0);
            $table->tinyInteger('res_close')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('r_restaurant');
    }
};
