<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;

class DashboardController extends Controller
{
    public function index()
    {
        // Display the admin dashboard via Blade view
        return view('admin.index');
    }
}

