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
        require_once dirname(__DIR__, 2) . '/seo/launch/SeoInstanceReadinessAssembler.php';
        return (new SeoInstanceReadinessAssembler())->assemblePublicEntity(
            'simulation',
            self::publicationInput($row),
            self::profileSignals($row)
        );
    }

    /** @return array<string,mixed> */
    public static function publicationInput(array $row): array
    {
        return [
            'status' => (string) ($row['publication_status'] ?? 'unpublished'),
            'visibility' => (string) ($row['visibility_status'] ?? 'restricted'),
            'scheduledAt' => $row['scheduled_at'] ?? null,
            'provenanceStatus' => 'verified',
            'rightsStatus' => 'allowed',
        ];
    }

    /** @return array<string,bool> */
    public static function profileSignals(array $row): array
    {
        $slug = trim((string) ($row['slug'] ?? ''));
        return [
            'entityExists' => (int) ($row['id'] ?? 0) > 0,
            'validSlug' => $slug !== '' && strlen($slug) <= 190 && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) === 1,
            'hasDefinition' => trim((string) ($row['title'] ?? '')) !== '',
            'notArchived' => empty($row['archived_at']),
            'hasQuestion' => (int) ($row['question_count'] ?? $row['questionCount'] ?? $row['has_ready_question'] ?? 0) >= 1,
        ];
    }
}
