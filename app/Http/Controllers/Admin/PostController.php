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
        return PostModel::where('post_prove', 0)->get()->toArray();
    }

    public function passed($set)
    {
        return PostModel::where('post_prove', 1)->get()->toArray();
    }

    public function unpass($set)
    {
        return PostModel::where('post_prove', 2)->get()->toArray();
    }

    public function edit($post_id)
    {
        return optional(PostModel::find((int) $post_id))->toArray();
    }

    public function save(Request $request)
    {
        $data = $request->validate([
            'post_name' => 'required|string',
            'post_prove' => 'nullable|integer',
        ]);

        $data['post_prove'] = $data['post_prove'] ?? 0;

        if ($request->input('id')) {
            $post = PostModel::find((int) $request->input('id'));
            if ($post) {
                $post->update($data);
            }
        } else {
            PostModel::create($data);
        }

        return PostModel::all()->toArray();
    }
}
