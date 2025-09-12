<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Model;

class Feedback extends Model
{
    protected $table = 'r_feedback';
    protected $primaryKey = 'id';
    public $timestamps = false;

    protected $fillable = [
        'f_name',
        'f_email',
        'f_time',
        'f_content',
        'f_isread',
    ];
}
