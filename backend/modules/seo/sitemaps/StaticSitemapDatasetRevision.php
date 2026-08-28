<?php

declare(strict_types=1);

final class StaticSitemapDatasetRevision
{
    public const VERSION = 'sitemap-dataset-revision.v1';

    /** @return array{revision: int, token: string, updatedAt: string} */
    public static function current(PDO $db): array
    {
        $stmt = $db->query(
            'SELECT revision, updated_at FROM seo_dataset_revisions WHERE id = 1 LIMIT 1'
        );
        $row = $stmt instanceof PDOStatement ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        if (!is_array($row) || !is_numeric($row['revision'] ?? null)) {
            throw new RuntimeException('Autoridade de revisao do dataset de sitemap indisponivel.');
        }

        $revision = (int) $row['revision'];
        return [
            'revision' => $revision,
            'token' => hash('sha256', self::VERSION . "\0" . $revision),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }
}
