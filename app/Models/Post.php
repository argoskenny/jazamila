<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    protected $table = 'r_post';
    protected $primaryKey = 'id';
    public $timestamps = false;
}
