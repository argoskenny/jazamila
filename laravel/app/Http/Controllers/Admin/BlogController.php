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
        return array_values(array_filter(BlogModel::all(), fn($row) => $row['b_blog_show'] === '0'));
    }

    public function passed($set)
    {
        return array_values(array_filter(BlogModel::all(), fn($row) => $row['b_blog_show'] === '1'));
    }

    public function unpass($set)
    {
        return array_values(array_filter(BlogModel::all(), fn($row) => $row['b_blog_show'] === '2'));
    }

    public function edit($id)
    {
        return BlogModel::find((int)$id);
    }
}
