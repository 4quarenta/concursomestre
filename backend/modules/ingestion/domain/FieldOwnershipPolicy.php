<?php

declare(strict_types=1);

final class FieldOwnershipPolicy
{
    public const SOURCE_OWNED = 'SOURCE_OWNED';
    public const EDITORIAL_OWNED = 'EDITORIAL_OWNED';
    public const DERIVED = 'DERIVED';
    public const SYSTEM_OWNED = 'SYSTEM_OWNED';

    /** @param array<string,mixed> $existing @param array<string,mixed> $incoming @param array<string,string> $ownership */
    public static function merge(array $existing, array $incoming, array $ownership): array
    {
        $merged = $existing;
        foreach ($incoming as $field => $value) {
            $owner = $ownership[$field] ?? self::SOURCE_OWNED;
            if ($owner === self::EDITORIAL_OWNED && array_key_exists($field, $existing)) {
                continue;
            }
            if ($owner === self::SYSTEM_OWNED && array_key_exists($field, $existing)) {
                continue;
            }
            $merged[$field] = $value;
        }
        return $merged;
    }
}
