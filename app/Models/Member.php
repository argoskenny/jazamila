<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Member extends Model
{
    protected $table = 'm_member';
    protected $primaryKey = 'id';
    public $timestamps = false;
}
