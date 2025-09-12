<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class RestaurantController extends Controller
{
    public function list($set)
    {
        return view('admin.res_list');
    }

    public function detail($res_id)
    {
        return view('admin.res_detail');
    }

    public function insert()
    {
        return view('admin.res_insert');
    }

    public function edit($res_id)
    {
        return view('admin.res_edit');
    }

    public function save(Request $request)
    {
        $request->validate([
            'res_name' => 'required|string',
            'res_price' => 'nullable|numeric',
        ]);
        return view('admin.save_res_data');
    }
}

