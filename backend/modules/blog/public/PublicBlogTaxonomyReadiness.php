<?php

declare(strict_types=1);

final class PublicBlogTaxonomyReadiness
{
    public const TYPES = ['category', 'tag'];

    /** @return array{status:'READY'|'NOT_READY',reasonCodes:list<string>} */
    public static function evaluate(array $row): array
    {
        $reasons = [];
        if ((int) ($row['id'] ?? 0) <= 0 || trim((string) ($row['name'] ?? '')) === '') {
            $reasons[] = 'instance_readiness.invalid_definition';
        }
        if (!self::validSlug((string) ($row['slug'] ?? ''))) {
            $reasons[] = 'instance_readiness.invalid_slug';
            $reasons[] = 'instance_readiness.canonical_invalid';
        }
        if ((int) ($row['article_count'] ?? 0) < 1) {
            $reasons[] = 'instance_readiness.publication_blocked';
        }
        $reasons = array_values(array_unique($reasons));
        return ['status' => $reasons === [] ? 'READY' : 'NOT_READY', 'reasonCodes' => $reasons];
    }

    public static function validType(string $type): bool
    {
        return in_array($type, self::TYPES, true);
    }

    public static function validSlug(string $slug): bool
    {
        return strlen($slug) <= 140 && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug) === 1;
    }
}
