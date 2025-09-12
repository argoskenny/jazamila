<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login()
    {
        return view('admin.login');
    }

    public function authenticate(Request $request)
    {
        $data = $request->validate([
            'id' => 'required|string',
            'pass' => 'required|string',
        ]);

        $admins = include base_path('laravel/config/admin.php');
        if (isset($admins[$data['id']]) && $admins[$data['id']] === $data['pass']) {
            $request->session()->put('id', $data['id']);
            return redirect()->route('admin.index');
        }

        return back()->withErrors(['login' => 'Invalid credentials']);
    }

    public function logout(Request $request)
    {
        $request->session()->forget('id');
        return redirect()->route('admin.login');
    }
}

