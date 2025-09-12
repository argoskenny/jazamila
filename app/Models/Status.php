<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Status extends Model
{
    protected $table = 'm_status';
    protected $primaryKey = 'id';
    public $timestamps = false;
}
