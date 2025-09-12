<?php
namespace App\Models\Admin;

/**
 * Simple in-memory Feedback model.
 */
class Feedback
{
    /**
     * @var array<int,array<string,mixed>>
     */
    private static array $data = [];
    private static int $autoId = 1;

    public static function create(array $attributes): array
    {
        $attributes['id'] = self::$autoId++;
        self::$data[$attributes['id']] = $attributes;
        return $attributes;
    }

    /**
     * Return all feedback entries.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function all(): array
    {
        return array_values(self::$data);
    }
}
