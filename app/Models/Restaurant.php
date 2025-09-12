<?php
namespace {
    require_once __DIR__ . '/../helpers.php';
}

namespace App\Models {

class Restaurant
{ 
    /**
     * In-memory restaurant records mimicking database rows.
     * @var array<int,array<string,mixed>>
     */
    private static array $data = [
        [
            'id' => 1,
            'res_name' => 'Sushi House',
            'res_region' => 1,
            'res_section' => 2,
            'res_price' => 100,
            'res_foodtype' => 1,
            'res_address' => 'Addr1',
            'res_area_num' => '2',
            'res_tel_num' => '1234567',
            'res_img_url' => 'sushi.jpg',
            'res_note' => 'nice sushi',
            'res_open_time' => 0,
            'res_close_time' => 0,
        ],
        [
            'id' => 2,
            'res_name' => 'Burger Place',
            'res_region' => 1,
            'res_section' => 3,
            'res_price' => 200,
            'res_foodtype' => 2,
            'res_address' => 'Addr2',
            'res_area_num' => '2',
            'res_tel_num' => '7654321',
            'res_img_url' => 'burger.jpg',
            'res_note' => 'tasty burger',
            'res_open_time' => 0,
            'res_close_time' => 0,
        ],
        [
            'id' => 3,
            'res_name' => 'Pasta Corner',
            'res_region' => 2,
            'res_section' => 1,
            'res_price' => 300,
            'res_foodtype' => 1,
            'res_address' => 'Addr3',
            'res_area_num' => '3',
            'res_tel_num' => '1111111',
            'res_img_url' => 'pasta.jpg',
            'res_note' => 'italian pasta',
            'res_open_time' => 0,
            'res_close_time' => 0,
        ],
    ];

    private static function filter(array $where, string $keyword): array
    {
        return array_values(array_filter(self::$data, function ($row) use ($where, $keyword) {
            foreach ($where as $key => $val) {
                if (strpos($key, ' ') !== false) {
                    [$field, $op] = explode(' ', $key);
                } else {
                    $field = $key; $op = '=';
                }
                $rowVal = $row[$field];
                switch ($op) {
                    case '<=':
                        if ($rowVal > $val) return false;
                        break;
                    case '>=':
                        if ($rowVal < $val) return false;
                        break;
                    default:
                        if ($rowVal != $val) return false;
                }
            }
            if ($keyword !== '') {
                if (strpos($row['res_name'], $keyword) === false && strpos($row['res_note'], $keyword) === false) {
                    return false;
                }
            }
            return true;
        }));
    }

    public static function countWhere(array $where = [], string $keyword = ''): int
    {
        return count(self::filter($where, $keyword));
    }

    public static function showList($page, array $where = [], string $keyword = ''): array
    {
        $all = self::filter($where, $keyword);
        $offset = ($page - 1) * 10;
        $slice = array_slice($all, $offset, 10);
        return self::resDataSwitch($slice);
    }

    public static function detail($id): array
    {
        $arr = array_values(array_filter(self::$data, fn($r) => $r['id'] == $id));
        return self::resDataSwitch($arr);
    }

    public static function apiAllList(): array
    {
        return self::resDataSwitch(array_slice(self::$data, 0, 100));
    }

    private static function resDataSwitch(array $rows): array
    {
        $Regionid = config('area.Regionid', []);
        $Sectionid = config('area.Sectionid', []);
        $Foodtype = config('type', []);
        $data = [];
        foreach ($rows as $row) {
            $row['res_area_num'] = str_pad($row['res_area_num'], 2, '0', STR_PAD_LEFT);
            $row['res_region'] = $Regionid[$row['res_region']] ?? $row['res_region'];
            $row['res_section'] = $Sectionid[$row['res_section']] ?? $row['res_section'];
            $row['res_foodtype'] = $Foodtype[$row['res_foodtype']] ?? $row['res_foodtype'];
            $row['res_open_time_hr'] = $row['res_open_time'] ? date('H', $row['res_open_time']) : '';
            $row['res_open_time_min'] = $row['res_open_time'] ? date('i', $row['res_open_time']) : '';
            $row['res_close_time_hr'] = $row['res_close_time'] ? date('H', $row['res_close_time']) : '';
            $row['res_close_time_min'] = $row['res_close_time'] ? date('i', $row['res_close_time']) : '';
            $data[] = $row;
        }
        return $data;
    }
}
}
