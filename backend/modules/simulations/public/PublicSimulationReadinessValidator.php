<?php

declare(strict_types=1);

final class PublicSimulationReadinessValidator
{
    /**
     * Availability controls the attempt CTA, not the historical landing.
     * Only visibility_status=public is public; unlisted remains nonpublic.
     *
     * @return array{status:'READY'|'NOT_READY',reasonCodes:list<string>}
     */
    public static function evaluate(array $row): array
    {
        $reasons = [];
        $slug = trim((string) ($row['slug'] ?? ''));
        if ((int) ($row['id'] ?? 0) <= 0) $reasons[] = 'instance_readiness.entity_missing';
        if ($slug === '' || strlen($slug) > 190 || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) !== 1) {
            $reasons[] = 'instance_readiness.invalid_slug';
        }
        if (trim((string) ($row['title'] ?? '')) === '') $reasons[] = 'instance_readiness.invalid_definition';
        if (($row['publication_status'] ?? '') !== 'published' || ($row['visibility_status'] ?? '') !== 'public') {
            $reasons[] = 'instance_readiness.publication_blocked';
        }
        if ((int) ($row['question_count'] ?? $row['questionCount'] ?? 0) < 1) {
            $reasons[] = 'instance_readiness.invalid_definition';
        }

        $reasons = array_values(array_unique($reasons));
        return ['status' => $reasons === [] ? 'READY' : 'NOT_READY', 'reasonCodes' => $reasons];
    }
}
