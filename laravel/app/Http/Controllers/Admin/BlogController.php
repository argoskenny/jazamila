<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;

class BlogController extends Controller
{
    public function unreview($set)
    {
        return view('admin.blog_unreview');
    }

    public function passed($set)
    {
        return view('admin.blog_passed');
    }

    public function unpass($set)
    {
        return view('admin.blog_unpass');
    }

    public function edit($id)
    {
        return view('admin.blog_edit');
    }
}

