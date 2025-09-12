<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    protected $table = 'r_post';
    protected $primaryKey = 'id';
    public $timestamps = false;

    protected $fillable = [
        'post_name',
        'post_area_num',
        'post_tel_num',
        'post_region',
        'post_section',
        'post_address',
        'post_foodtype',
        'post_price',
        'post_open_time',
        'post_close_time',
        'post_note',
        'post_updatetime',
        'post_img_url',
        'post_img_ori_url',
        'post_prove',
    ];
}
