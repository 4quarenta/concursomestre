<?php

declare(strict_types=1);

final class TaxonomyResolutionPolicy
{
    public const EXACT_MATCH = 'EXACT_MATCH';
    public const ALIAS_MATCH = 'ALIAS_MATCH';
    public const AUTHORIZED_CREATE = 'AUTHORIZED_CREATE';
    public const REVIEW_REQUIRED = 'REVIEW_REQUIRED';
    public const REJECT = 'REJECT';

    public static function resolve(string $result): string
    {
        $result = strtoupper(trim($result));
        if (!in_array($result, [self::EXACT_MATCH, self::ALIAS_MATCH, self::AUTHORIZED_CREATE, self::REVIEW_REQUIRED, self::REJECT], true)) {
            return self::REVIEW_REQUIRED;
        }
        return $result;
    }
}
