<?php

declare(strict_types=1);

final class DeprecationPolicy
{
    public const ACTIVE = 'ACTIVE';
    public const STALE_SOURCE = 'STALE_SOURCE';
    public const DEPRECATED = 'DEPRECATED';
    public const UNPUBLISHED = 'UNPUBLISHED';
    public const REMOVED_BY_SOURCE = 'REMOVED_BY_SOURCE';
    public const REVIEW_REQUIRED = 'REVIEW_REQUIRED';

    public static function sourceDisappearanceAction(bool $explicitRemovalPolicy): string
    {
        return $explicitRemovalPolicy ? self::REMOVED_BY_SOURCE : self::STALE_SOURCE;
    }
}
