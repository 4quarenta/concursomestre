<?php

declare(strict_types=1);

final class PublicLawArticleReadiness
{
    private const PUBLIC_LAW_STATUSES = ['active', 'published', 'revoked'];
    private const PUBLIC_ARTICLE_STATUSES = ['active', 'revoked', 'vetoed'];

    /** @return array{status:'READY'|'NOT_READY',reasonCodes:list<string>} */
    public static function evaluate(array $row, ?DateTimeImmutable $now = null): array
    {
        $reasons = [];
        $lawSlug = trim((string) ($row['law_slug'] ?? ''));
        $articleSlug = trim((string) ($row['article_slug'] ?? ''));
        if ((int) ($row['law_id'] ?? 0) <= 0) {
            $reasons[] = 'instance_readiness.invalid_law_identity';
        }
        if ((int) ($row['article_id'] ?? 0) <= 0) {
            $reasons[] = 'instance_readiness.invalid_article_identity';
        }
        if (!self::validSlug($lawSlug, 160) || !self::validSlug($articleSlug, 180)) {
            $reasons[] = 'instance_readiness.invalid_slug';
            $reasons[] = 'instance_readiness.invalid_canonical';
        }
        if (!self::lawIsPublic($row, $now)) {
            $reasons[] = 'instance_readiness.nonpublic_law';
        }
        if (!in_array(strtolower(trim((string) ($row['article_status'] ?? 'active'))), self::PUBLIC_ARTICLE_STATUSES, true)) {
            $reasons[] = 'instance_readiness.nonpublic_article';
        }
        if (trim((string) ($row['article_number'] ?? '')) === '') {
            $reasons[] = 'instance_readiness.invalid_definition';
        }
        if (trim((string) ($row['official_text'] ?? '')) === '') {
            $reasons[] = 'instance_readiness.empty_official_content';
        }

        $reasons = array_values(array_unique($reasons));
        return ['status' => $reasons === [] ? 'READY' : 'NOT_READY', 'reasonCodes' => $reasons];
    }

    public static function isPublicRecord(array $row, ?DateTimeImmutable $now = null): bool
    {
        return self::lawIsPublic($row, $now)
            && in_array(strtolower(trim((string) ($row['article_status'] ?? 'active'))), self::PUBLIC_ARTICLE_STATUSES, true);
    }

    private static function lawIsPublic(array $row, ?DateTimeImmutable $now): bool
    {
        $status = strtolower(trim((string) ($row['law_status'] ?? '')));
        if (in_array($status, self::PUBLIC_LAW_STATUSES, true)) return true;
        if ($status !== 'scheduled') return false;
        $publishedAt = trim((string) ($row['law_published_at'] ?? ''));
        if ($publishedAt === '') return false;
        try {
            $publication = new DateTimeImmutable($publishedAt);
            return $publication <= ($now ?? new DateTimeImmutable('now'));
        } catch (Throwable) {
            return false;
        }
    }

    private static function validSlug(string $slug, int $limit): bool
    {
        return $slug !== '' && strlen($slug) <= $limit
            && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) === 1;
    }
}
