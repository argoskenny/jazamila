<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function unreview($set)
    {
        return view('admin.post_unreview');
    }

    public function passed($set)
    {
        return view('admin.post_passed');
    }

    public function unpass($set)
    {
        return view('admin.post_unpass');
    }

    public function edit($post_id)
    {
        return view('admin.post_edit');
    }

    public function save(Request $request)
    {
        $request->validate([
            'post_name' => 'required|string',
        ]);
        return back();
    }
}

