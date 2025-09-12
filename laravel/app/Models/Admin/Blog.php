<?php
namespace App\Models\Admin;

/**
 * In-memory blog model used by admin controllers and tests.
 */
class Blog
{
    /**
     * @var array<int,array<string,mixed>>
     */
    private static array $data = [
        1 => ['id' => 1, 'b_res_id' => 1, 'b_blog_show' => '0', 'b_blogname' => 'Blog1', 'b_bloglink' => 'http://blog1'],
        2 => ['id' => 2, 'b_res_id' => 1, 'b_blog_show' => '0', 'b_blogname' => 'Blog2', 'b_bloglink' => 'http://blog2'],
    ];

    /**
     * Find a blog by id.
     *
     * @param int $id
     * @return array<string,mixed>|null
     */
    public static function find(int $id): ?array
    {
        return self::$data[$id] ?? null;
    }

    /**
     * Update blog attributes.
     *
     * @param int $id
     * @param array<string,mixed> $attributes
     * @return bool
     */
    public static function update(int $id, array $attributes): bool
    {
        if (!isset(self::$data[$id])) {
            return false;
        }
        self::$data[$id] = array_merge(self::$data[$id], $attributes);
        return true;
    }

    /**
     * Return all blogs.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function all(): array
    {
        return array_values(self::$data);
    }
}
