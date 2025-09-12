<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin\Feedback as FeedbackModel;

class FeedbackController extends Controller
{
    /**
     * List feedback entries. Pagination parameter is ignored in this
     * simplified implementation.
     */
    public function list($set)
    {
        return FeedbackModel::all();
    }
}
