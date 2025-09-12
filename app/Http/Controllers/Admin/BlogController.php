<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin\Blog as BlogModel;

/**
 * Admin blog controller for reviewing and editing blog entries.
 */
class BlogController extends Controller
{
    public function unreview($set)
    {
        return BlogModel::where('b_blog_show', 0)->get()->toArray();
    }

    public function passed($set)
    {
        return BlogModel::where('b_blog_show', 1)->get()->toArray();
    }

    public function unpass($set)
    {
        return BlogModel::where('b_blog_show', 2)->get()->toArray();
    }

    public function edit($id)
    {
        return optional(BlogModel::find((int) $id))->toArray();
    }
}
