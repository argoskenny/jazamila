<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('r_feedback', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('f_name')->nullable();
            $table->string('f_email')->nullable();
            $table->text('f_content')->nullable();
            $table->unsignedBigInteger('f_time')->default(0);
            $table->tinyInteger('f_isread')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('r_feedback');
    }
};
