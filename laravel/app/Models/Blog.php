<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Blog extends Model
{
    protected $table = 'r_bloglink';
    public $timestamps = false;
    protected $primaryKey = 'id';

    public static function forRestaurant($res_id)
    {
        return static::query()->where(['b_res_id' => $res_id, 'b_blog_show' => '1'])->get()->toArray();
    }
}
