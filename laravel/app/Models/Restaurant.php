<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Restaurant extends Model
{
    protected $table = 'r_restaurant';
    public $timestamps = false;
    protected $primaryKey = 'id';

    public static function countWhere($where = [], $keyword = '')
    {
        $query = static::query();
        if(!empty($where)) {
            foreach($where as $key => $val) {
                if(is_array($val)) {
                    $query->where($val[0], $val[1], $val[2]);
                } else {
                    $query->where($key, $val);
                }
            }
        }
        if($keyword !== '') {
            $query->where(function($q) use ($keyword){
                $q->where('res_name','like',"%$keyword%")
                  ->orWhere('res_note','like',"%$keyword%");
            });
        }
        return $query->count();
    }

    public static function showList($set_id, $where = [], $keyword = '')
    {
        $offset = ($set_id==1)?0:(($set_id-1)*10);
        $query = static::query();
        if(!empty($where)) {
            foreach($where as $key => $val) {
                if(is_array($val)) {
                    $query->where($val[0], $val[1], $val[2]);
                } else {
                    $query->where($key, $val);
                }
            }
        }
        if($keyword !== '') {
            $query->where(function($q) use ($keyword){
                $q->where('res_name','like',"%$keyword%")
                  ->orWhere('res_note','like',"%$keyword%");
            });
        }
        $query->orderBy('res_region','ASC')->orderBy('res_section','ASC')->offset($offset)->limit(10);
        $results = $query->get()->toArray();
        return static::resDataSwitch($results);
    }

    public static function detail($res_id)
    {
        $query = static::query()->where('id',$res_id)->get()->toArray();
        return static::resDataSwitch($query);
    }

    public static function apiAllList()
    {
        $query = static::query()->orderBy('res_region','ASC')->orderBy('res_section','ASC')->limit(100)->get()->toArray();
        return static::resDataSwitch($query);
    }

    protected static function resDataSwitch($query_arr)
    {
        require base_path('application/rf_config/area.inc.php');
        require base_path('application/rf_config/type.inc.php');
        $data = [];
        foreach($query_arr as $data_arr) {
            $data_arr['res_area_num'] = str_pad($data_arr['res_area_num'], 2, '0', STR_PAD_LEFT);
            $data_arr['res_region'] = $Regionid[$data_arr['res_region']];
            $data_arr['res_section'] = $Sectionid[$data_arr['res_section']];
            $data_arr['res_foodtype'] = $Foodtype[$data_arr['res_foodtype']];
            $data_arr['res_open_time_hr'] = ($data_arr['res_open_time'] != 0) ? date('H',$data_arr['res_open_time']) : '';
            $data_arr['res_open_time_min'] = ($data_arr['res_open_time'] != 0) ? date('i',$data_arr['res_open_time']) : '';
            $data_arr['res_close_time_hr'] = ($data_arr['res_close_time'] != 0) ? date('H',$data_arr['res_close_time']) : '';
            $data_arr['res_close_time_min'] = ($data_arr['res_close_time'] != 0) ? date('i',$data_arr['res_close_time']) : '';
            $data[] = $data_arr;
        }
        return $data;
    }
}
