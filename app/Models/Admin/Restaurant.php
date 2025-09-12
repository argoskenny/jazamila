<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Model;

class Restaurant extends Model
{
    protected $table = 'r_restaurant';
    protected $primaryKey = 'id';
    public $timestamps = false;

    protected $fillable = [
        'res_name',
        'res_area_num',
        'res_tel_num',
        'res_region',
        'res_section',
        'res_address',
        'res_foodtype',
        'res_price',
        'res_open_time',
        'res_close_time',
        'res_note',
        'res_img_url',
        'res_img_ori_url',
        'res_updatetime',
        'res_post_id',
        'res_close',
    ];
}
