<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Admin\Post as PostModel;

/**
 * CRUD operations for posts in the admin area.
 */
class PostController extends Controller
{
    public function unreview($set)
    {
        return PostModel::byStatus('pending');
    }

    public function passed($set)
    {
        return PostModel::byStatus('passed');
    }

    public function unpass($set)
    {
        return PostModel::byStatus('rejected');
    }

    public function edit($post_id)
    {
        return PostModel::find((int)$post_id);
    }

    public function save(Request $request)
    {
        $data = $request->validate([
            'post_name' => 'required|string',
            'status' => 'nullable|string',
        ]);

        if ($request->input('id')) {
            PostModel::update((int)$request->input('id'), $data);
        } else {
            $data['status'] = $data['status'] ?? 'pending';
            PostModel::create($data);
        }

        return PostModel::all();
    }
}
