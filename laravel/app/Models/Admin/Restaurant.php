<?php
namespace App\Models\Admin;

/**
 * Simplified in-memory model representing a restaurant record.
 * Acts as a very small subset of Eloquent functionality used
 * by the admin controllers and tests.
 */
class Restaurant
{
    /** @var array<int,array<string,mixed>> */
    private static array $data = [];

    private static int $autoId = 1;

    /**
     * Create a new restaurant record.
     *
     * @param array<string,mixed> $attributes
     * @return array<string,mixed>
     */
    public static function create(array $attributes): array
    {
        $attributes['id'] = self::$autoId++;
        self::$data[$attributes['id']] = $attributes;
        return $attributes;
    }

    /**
     * Update an existing restaurant by id.
     *
     * @param int $id
     * @param array<string,mixed> $attributes
     * @return array<string,mixed>|null
     */
    public static function update(int $id, array $attributes): ?array
    {
        if (!isset(self::$data[$id])) {
            return null;
        }
        self::$data[$id] = array_merge(self::$data[$id], $attributes);
        return self::$data[$id];
    }

    /**
     * Find a restaurant by id.
     *
     * @param int $id
     * @return array<string,mixed>|null
     */
    public static function find(int $id): ?array
    {
        return self::$data[$id] ?? null;
    }

    /**
     * Return all restaurants.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function all(): array
    {
        return array_values(self::$data);
    }
}
