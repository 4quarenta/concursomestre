<?php

declare(strict_types=1);

final class BlogTaxonomyReadinessReporter
{
    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed> */
    public function report(): array
    {
        return [
            'generatedAt' => gmdate(DATE_ATOM),
            'mode' => 'READ_ONLY',
            'policies' => [
                'category' => 'INDEXABLE',
                'tag' => 'PERMANENT_NOINDEX',
            ],
            'categories' => $this->taxonomyMetrics('category'),
            'tags' => $this->taxonomyMetrics('tag'),
            'relations' => [
                'wrongTypeIssues' => 0,
                'wrongTypeDetection' => 'MODEL_ENFORCED_BY_SEPARATE_CATEGORY_AND_TAG_RELATIONS',
                'orphanArticleCategories' => $this->scalar(
                    'SELECT COUNT(*) FROM blog_articles a LEFT JOIN blog_categories c ON c.id = a.category_id WHERE c.id IS NULL'
                ),
                'orphanArticleTags' => $this->scalar(
                    'SELECT COUNT(*) FROM blog_article_tags bat '
                    . 'LEFT JOIN blog_articles a ON a.id = bat.article_id '
                    . 'LEFT JOIN blog_tags t ON t.id = bat.tag_id WHERE a.id IS NULL OR t.id IS NULL'
                ),
                'duplicateArticleTags' => $this->scalar(
                    'SELECT COUNT(*) FROM ('
                    . 'SELECT article_id, tag_id FROM blog_article_tags GROUP BY article_id, tag_id HAVING COUNT(*) > 1'
                    . ') duplicates'
                ),
            ],
            'publicationSafety' => [
                'draftRowsMatchingPublicWindow' => $this->scalar(
                    "SELECT COUNT(*) FROM blog_articles WHERE deleted_at IS NULL AND status = 'draft' "
                    . 'AND published_at IS NOT NULL AND published_at <= NOW()'
                ),
                'futureScheduledRows' => $this->scalar(
                    "SELECT COUNT(*) FROM blog_articles WHERE deleted_at IS NULL AND status = 'scheduled' "
                    . 'AND published_at > NOW()'
                ),
                'publicRows' => $this->scalar(
                    "SELECT COUNT(*) FROM blog_articles WHERE deleted_at IS NULL "
                    . "AND status IN ('published', 'scheduled') AND published_at IS NOT NULL AND published_at <= NOW()"
                ),
            ],
            'aliases' => ['modelExists' => false, 'count' => 0],
            'pagination' => [
                'authority' => 'published_at DESC, id DESC',
                'cursor' => 'signed_keyset',
            ],
        ];
    }

    /** @return array<string,int> */
    private function taxonomyMetrics(string $type): array
    {
        $isCategory = $type === 'category';
        $table = $isCategory ? 'blog_categories' : 'blog_tags';
        $id = $isCategory ? 'c.id' : 't.id';
        $alias = $isCategory ? 'c' : 't';
        $join = $isCategory
            ? "LEFT JOIN blog_articles a ON a.category_id = c.id AND a.deleted_at IS NULL "
                . "AND a.status IN ('published', 'scheduled') AND a.published_at IS NOT NULL AND a.published_at <= NOW()"
            : "LEFT JOIN blog_article_tags bat ON bat.tag_id = t.id LEFT JOIN blog_articles a ON a.id = bat.article_id "
                . "AND a.deleted_at IS NULL AND a.status IN ('published', 'scheduled') "
                . 'AND a.published_at IS NOT NULL AND a.published_at <= NOW()';
        $countExpression = $isCategory ? 'COUNT(a.id)' : 'COUNT(DISTINCT a.id)';
        $rows = $this->db->query(
            "SELECT {$id} AS id, {$alias}.name, {$alias}.slug, {$countExpression} AS public_posts "
            . "FROM {$table} {$alias} {$join} GROUP BY {$id}, {$alias}.name, {$alias}.slug"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $normalizedNames = [];
        $slugs = [];
        $metrics = ['total' => count($rows), 'ready' => 0, 'notReady' => 0, 'zeroPublicPosts' => 0,
            'onePublicPost' => 0, 'potentialThinGroups' => 0, 'invalidSlug' => 0,
            'duplicateSlugGroups' => 0, 'normalizedNameDuplicateGroups' => 0];
        foreach ($rows as $row) {
            $posts = (int) ($row['public_posts'] ?? 0);
            $validSlug = preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', (string) ($row['slug'] ?? '')) === 1;
            $ready = $posts > 0 && $validSlug && trim((string) ($row['name'] ?? '')) !== '';
            $metrics[$ready ? 'ready' : 'notReady']++;
            if ($posts === 0) $metrics['zeroPublicPosts']++;
            if ($posts === 1) {
                $metrics['onePublicPost']++;
                $metrics['potentialThinGroups']++;
            }
            if (!$validSlug) $metrics['invalidSlug']++;
            $slugs[(string) ($row['slug'] ?? '')] = ($slugs[(string) ($row['slug'] ?? '')] ?? 0) + 1;
            $normalized = self::normalizedName((string) ($row['name'] ?? ''));
            $normalizedNames[$normalized] = ($normalizedNames[$normalized] ?? 0) + 1;
        }
        $metrics['duplicateSlugGroups'] = count(array_filter($slugs, static fn (int $count): bool => $count > 1));
        $metrics['normalizedNameDuplicateGroups'] = count(array_filter(
            $normalizedNames,
            static fn (int $count, string $name): bool => $name !== '' && $count > 1,
            ARRAY_FILTER_USE_BOTH
        ));
        return $metrics;
    }

    private function scalar(string $sql): int
    {
        return (int) $this->db->query($sql)->fetchColumn();
    }

    private static function normalizedName(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($value));
        return strtolower(preg_replace('/[^a-z0-9]+/', '', (string) ($ascii ?: $value)) ?? '');
    }
}
