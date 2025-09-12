<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;

class JazamilaController extends Controller
{
    /**
     * Display the homepage.
     *
     * Mirrors CI's Jazamila@index behavior.
     */
    public function index(Request $request)
    {
        // TODO: Port cookie and configuration logic
        return response()->view('jazamila.index', []);
    }

    /**
     * List restaurants based on filters.
     *
     * Mirrors CI's Jazamila@listdata.
     */
    public function listdata($location, $type, $max, $min, $page, Request $request)
    {
        // TODO: Implement filtering and pagination
        return response()->view('jazamila.listdata', [
            'url_region'   => $location,
            'url_type'     => $type,
            'url_maxmoney' => $max,
            'url_minmoney' => $min,
            'url_page'     => $page,
        ]);
    }

    /**
     * Show a restaurant detail.
     */
    public function detail($id, Request $request)
    {
        // TODO: Fetch restaurant and blog data
        return response()->view('jazamila.detail', ['res_id' => $id]);
    }

    /**
     * JSON API placeholder.
     */
    public function jsonapi(Request $request)
    {
        // TODO: Return restaurant data as JSON
        return response()->json([]);
    }
}
