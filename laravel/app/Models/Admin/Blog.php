<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Model;

class Blog extends Model
{
    protected $table = 'r_bloglink';
    protected $primaryKey = 'id';
    public $timestamps = false;

    protected $fillable = [
        'b_res_id',
        'b_post_id',
        'b_blogname',
        'b_bloglink',
        'b_blog_show',
    ];
}
