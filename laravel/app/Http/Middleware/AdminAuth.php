<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        if (!$request->session()->has('id')) {
            return redirect()->route('admin.login');
        }
        return $next($request);
    }
}

