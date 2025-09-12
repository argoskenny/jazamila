<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FriendList extends Model
{
    protected $table = 'm_friend_list';
    protected $primaryKey = 'id';
    public $timestamps = false;
}
