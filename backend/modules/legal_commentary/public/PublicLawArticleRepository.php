<?php

declare(strict_types=1);

final class PublicLawArticleRepository
{
    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed>|null */
    public function findByCanonicalSlugs(string $lawSlug, string $articleSlug): ?array
    {
        $stmt = $this->db->prepare($this->identitySql() . "
            WHERE l.slug = :law_slug AND BINARY l.slug = :law_slug_case
              AND a.slug = :article_slug AND BINARY a.slug = :article_slug_case
            LIMIT 1");
        $stmt->execute([
            ':law_slug' => $lawSlug, ':law_slug_case' => $lawSlug,
            ':article_slug' => $articleSlug, ':article_slug_case' => $articleSlug,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function findByLawAlias(string $lawAlias, string $articleSlug): ?array
    {
        $stmt = $this->db->prepare($this->identitySql() . "
            WHERE JSON_VALID(l.aliases_json)
              AND JSON_CONTAINS(l.aliases_json, JSON_QUOTE(:law_alias), '$')
              AND a.slug = :article_slug AND BINARY a.slug = :article_slug_case
            ORDER BY l.id
            LIMIT 1");
        $stmt->execute([
            ':law_alias' => $lawAlias,
            ':article_slug' => $articleSlug,
            ':article_slug_case' => $articleSlug,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /** @return list<array<string,mixed>> */
    public function fetchOfficialBlocks(int $articleId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, block_uid, kind, label, text, parent_block_uid, anchor, sort_order
             FROM law_article_blocks
             WHERE law_article_id = :article_id
             ORDER BY sort_order, id'
        );
        $stmt->execute([':article_id' => $articleId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @return array{previous:?array,next:?array} */
    public function fetchNavigation(int $lawId, int $sortOrder, int $articleId): array
    {
        $sql = "
            (SELECT 'previous' AS direction, id, slug, article_number, title
               FROM law_articles
              WHERE law_id = :previous_law_id
                AND official_status IN ('active', 'revoked', 'vetoed')
                AND TRIM(official_text) <> ''
                AND REGEXP_LIKE(slug, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')
                AND (sort_order < :previous_sort OR (sort_order = :previous_sort_equal AND id < :previous_id))
              ORDER BY sort_order DESC, id DESC LIMIT 1)
            UNION ALL
            (SELECT 'next' AS direction, id, slug, article_number, title
               FROM law_articles
              WHERE law_id = :next_law_id
                AND official_status IN ('active', 'revoked', 'vetoed')
                AND TRIM(official_text) <> ''
                AND REGEXP_LIKE(slug, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')
                AND (sort_order > :next_sort OR (sort_order = :next_sort_equal AND id > :next_id))
              ORDER BY sort_order, id LIMIT 1)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':previous_law_id' => $lawId, ':previous_sort' => $sortOrder,
            ':previous_sort_equal' => $sortOrder, ':previous_id' => $articleId,
            ':next_law_id' => $lawId, ':next_sort' => $sortOrder,
            ':next_sort_equal' => $sortOrder, ':next_id' => $articleId,
        ]);
        $result = ['previous' => null, 'next' => null];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $direction = (string) ($row['direction'] ?? '');
            if (array_key_exists($direction, $result)) $result[$direction] = $row;
        }
        return $result;
    }

    private function identitySql(): string
    {
        return "SELECT
                    l.id AS law_id, l.slug AS law_slug, l.title AS law_title,
                    l.short_title AS law_short_title, l.law_number, l.law_year,
                    l.status AS law_status, l.published_at AS law_published_at,
                    l.official_url AS law_official_url, l.source_name AS law_source_name,
                    COALESCE(l.last_updated_at, l.updated_at) AS law_updated_at,
                    a.id AS article_id, a.section_id, a.slug AS article_slug,
                    a.article_number, a.title AS article_title, a.official_text,
                    a.official_status AS article_status, a.official_anchor,
                    a.sort_order AS article_sort_order, a.updated_at AS article_updated_at,
                    s.display_title AS section_display_title,
                    s.title_label AS section_title_label, s.title_name AS section_title_name,
                    s.chapter_label AS section_chapter_label, s.chapter_name AS section_chapter_name
               FROM laws l
               INNER JOIN law_articles a ON a.law_id = l.id
               LEFT JOIN law_sections s ON s.id = a.section_id AND s.law_id = l.id";
    }
}
