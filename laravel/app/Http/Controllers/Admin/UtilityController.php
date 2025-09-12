<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Admin\Restaurant as RestaurantModel;

class UtilityController extends Controller
{
    /**
     * Return a simple array representing admin menu items.
     */
    public function menu()
    {
        return ['restaurants', 'posts', 'blogs', 'feedback'];
    }

    /**
     * Update a restaurant address. Expects `id` and `address` in the request.
     */
    public function fixAddress(Request $request)
    {
        $data = $request->validate([
            'id' => 'required|integer',
            'address' => 'required|string',
        ]);
        RestaurantModel::update($data['id'], ['res_address' => $data['address']]);
        return RestaurantModel::find($data['id']);
    }
}
