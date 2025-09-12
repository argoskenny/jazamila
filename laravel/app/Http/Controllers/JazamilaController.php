<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class JazamilaController extends Controller
{
    public function index()
    {
        return view('jazamila.index');
    }

    public function listdata()
    {
        return view('jazamila.listdata');
    }

    public function detail()
    {
        return view('jazamila.detail');
    }

    public function map()
    {
        return view('jazamila.map');
    }

    public function about()
    {
        return view('jazamila.about');
    }

    public function post()
    {
        return view('jazamila.post');
    }
}
