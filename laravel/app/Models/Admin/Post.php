<?php
namespace App\Models\Admin;

/**
 * Very small in-memory Post model.
 */
class Post
{
    /** @var array<int,array<string,mixed>> */
    private static array $data = [];
    private static int $autoId = 1;

    public static function create(array $attributes): array
    {
        $attributes['id'] = self::$autoId++;
        self::$data[$attributes['id']] = $attributes;
        return $attributes;
    }

    public static function update(int $id, array $attributes): ?array
    {
        if (!isset(self::$data[$id])) {
            return null;
        }
        self::$data[$id] = array_merge(self::$data[$id], $attributes);
        return self::$data[$id];
    }

    public static function find(int $id): ?array
    {
        return self::$data[$id] ?? null;
    }

    /**
     * Filter posts by status.
     *
     * @param string $status
     * @return array<int,array<string,mixed>>
     */
    public static function byStatus(string $status): array
    {
        return array_values(array_filter(self::$data, fn($row) => ($row['status'] ?? '') === $status));
    }

    /**
     * Return all posts.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function all(): array
    {
        return array_values(self::$data);
    }
}
