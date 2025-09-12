<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        $admins = config('admin', []);
        $id = $request->session()->get('id');
        if (!$id || !array_key_exists($id, $admins)) {
            return redirect('/admin/login');
        }
        return $next($request);
    }
}
