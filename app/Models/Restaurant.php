<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Restaurant extends Model
{
    protected $table = 'r_restaurant';
    protected $primaryKey = 'id';
    public $timestamps = false;
}
