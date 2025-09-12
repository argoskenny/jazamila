<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StatusRecord extends Model
{
    protected $table = 'm_status_record';
    protected $primaryKey = 'id';
    public $timestamps = false;
}
