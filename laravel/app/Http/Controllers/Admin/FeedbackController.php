<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;

class FeedbackController extends Controller
{
    public function list($set)
    {
        return view('admin.feedback_list');
    }
}

