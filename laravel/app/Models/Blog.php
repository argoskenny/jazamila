<?php
namespace App\Models;

class Blog
{
    /**
     * In-memory blog records.
     * @var array<int,array<string,mixed>>
     */
    private static array $data = [
        ['id' => 1, 'b_res_id' => 1, 'b_blog_show' => '1', 'b_blogname' => 'Sushi Blog', 'b_bloglink' => 'http://blog1'],
        ['id' => 2, 'b_res_id' => 2, 'b_blog_show' => '1', 'b_blogname' => 'Burger Blog', 'b_bloglink' => 'http://blog2'],
    ];

    public static function forRestaurant($res_id): array
    {
        return array_values(array_filter(self::$data, function ($row) use ($res_id) {
            return $row['b_res_id'] == $res_id && $row['b_blog_show'] === '1';
        }));
    }
}
