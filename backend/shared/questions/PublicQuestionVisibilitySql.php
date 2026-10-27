<?php

declare(strict_types=1);

final class PublicQuestionVisibilitySql
{
    public static function scaleColumns(string $alias): string
    {
        if (preg_match('/^[a-z_][a-z0-9_]*$/i', $alias) !== 1) {
            throw new InvalidArgumentException('Alias SQL invalido.');
        }

        return "{$alias}.visibility_status = 'public'
            AND {$alias}.publish_status IN ('published', 'scheduled')
            AND {$alias}.published_sort_at IS NOT NULL
            AND ({$alias}.publish_status = 'published' OR {$alias}.published_sort_at <= NOW())";
    }
}
