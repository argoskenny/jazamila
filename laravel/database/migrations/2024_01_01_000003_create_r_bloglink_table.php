<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('r_bloglink', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('b_res_id')->default(0);
            $table->unsignedBigInteger('b_post_id')->default(0);
            $table->string('b_blogname')->nullable();
            $table->string('b_bloglink')->nullable();
            $table->tinyInteger('b_blog_show')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('r_bloglink');
    }
};
