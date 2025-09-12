<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class UtilityController extends Controller
{
    public function menu()
    {
        return view('admin.admin_menu');
    }

    public function fixAddress(Request $request)
    {
        $request->validate([
            'address' => 'required|string',
        ]);
        return redirect()->back();
    }
}

