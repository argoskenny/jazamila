<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin\Feedback as FeedbackModel;

class FeedbackController extends Controller
{
    /**
     * List feedback entries. Pagination parameter controls simple paging of
     * 10 records per page.
     */
    public function list($set)
    {
        $page = max(1, (int) $set);
        return FeedbackModel::orderBy('f_time', 'desc')
            ->skip(($page - 1) * 10)
            ->take(10)
            ->get()
            ->toArray();
    }
}
