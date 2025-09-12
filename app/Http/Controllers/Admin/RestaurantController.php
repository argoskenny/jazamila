<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Admin\Restaurant as RestaurantModel;

/**
 * Controller providing basic CRUD actions for restaurants in the admin panel.
 * Now backed by an actual Eloquent model instead of the previous in-memory
 * array implementation.
 */
class RestaurantController extends Controller
{
    /**
     * List restaurants. The parameter represents the page number but is
     * ignored in this simplified implementation.
     */
    public function list($set)
    {
        $page = max(1, (int) $set);
        return RestaurantModel::orderBy('id')
            ->skip(($page - 1) * 10)
            ->take(10)
            ->get()
            ->toArray();
    }

    /**
     * Show details for a single restaurant.
     */
    public function detail($res_id)
    {
        return optional(RestaurantModel::find((int) $res_id))->toArray();
    }

    /**
     * Provide data for inserting a new restaurant.
     */
    public function insert()
    {
        return [];
    }

    /**
     * Edit an existing restaurant.
     */
    public function edit($res_id)
    {
        return optional(RestaurantModel::find((int) $res_id))->toArray();
    }

    /**
     * Persist restaurant data. Accepts optional uploaded file `img_url` which
     * will be copied to the assets directories.
     */
    public function save(Request $request)
    {
        $data = $request->validate([
            'res_name' => 'required|string',
            'res_price' => 'nullable|numeric',
            'res_area_num' => 'nullable|string',
            'res_tel_num' => 'nullable|string',
            'res_region' => 'nullable|string',
            'res_address' => 'nullable|string',
            'res_foodtype' => 'nullable|string',
            'res_note' => 'nullable|string',
        ]);

        // handle optional image upload
        if ($request->files->has('img_url')) {
            $file = $request->files->get('img_url');
            $base = dirname(__DIR__, 4);
            $tmpDir = $base . '/assets/tmp';
            $picsDir = $base . '/assets/pics';
            if (!is_dir($tmpDir)) {
                mkdir($tmpDir, 0777, true);
            }
            if (!is_dir($picsDir)) {
                mkdir($picsDir, 0777, true);
            }
            $filename = time() . '_' . $file->getClientOriginalName();
            $file->move($tmpDir, $filename);
            copy($tmpDir . '/' . $filename, $picsDir . '/' . $filename);
            $data['res_img_url'] = $filename;
        }

        if ($request->input('id')) {
            $restaurant = RestaurantModel::find((int) $request->input('id'));
            if ($restaurant) {
                $restaurant->update($data);
            }
        } else {
            RestaurantModel::create($data);
        }

        return RestaurantModel::all()->toArray();
    }
}
