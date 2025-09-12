<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Feedback extends Model
{
    protected $table = 'r_feedback';
    protected $primaryKey = 'id';
    public $timestamps = false;
}
