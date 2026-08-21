<?php

declare(strict_types=1);

final class PublicMaterialsRepository
{
    public const DIRECTORY_QUERY_BUDGET = 2;
    public const DETAIL_QUERY_BUDGET = 2;

    public function __construct(private readonly PDO $db) {}

    /** @return array{rows:list<array<string,mixed>>,total:int,page:int,pages:int,limit:int} */
    public function directory(int $page, int $limit, string $search, bool $marketplaceOnly): array
    {
        $where = $this->publicClause('m') . ' AND ' . $this->assetClause('m');
        if ($marketplaceOnly) $where .= ' AND ' . $this->listingClause('m');
        $params = [];
        if ($search !== '') {
            $where .= ' AND (m.title LIKE :search OR m.description LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }
        $count = $this->db->prepare("SELECT COUNT(*) FROM materials m WHERE {$where}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / $limit));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $limit;

        $stmt = $this->db->prepare('SELECT ' . $this->summaryColumns('m') . "
            FROM materials m WHERE {$where}
            ORDER BY COALESCE(m.published_at, m.updated_at) DESC, m.id DESC
            LIMIT :limit OFFSET :offset");
        foreach ($params as $key => $value) $stmt->bindValue($key, $value);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return ['rows' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [], 'total' => $total, 'page' => $page, 'pages' => $pages, 'limit' => $limit];
    }

    /** @return array<string,mixed>|null */
    public function findPublicBySlug(string $slug): ?array
    {
        $stmt = $this->db->prepare('SELECT ' . $this->summaryColumns('m') . ",
                m.status, m.publication_status, m.visibility_status, m.rights_status, m.archived_at,
                m.subject_id, m.topic_id
            FROM materials m WHERE m.slug = :slug AND BINARY m.slug = :slug_case
              AND " . $this->publicIdentityClause('m') . ' LIMIT 1');
        $stmt->execute([':slug' => $slug, ':slug_case' => $slug]);
        $material = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$material) {
            $alias = $this->db->prepare("SELECT m.slug FROM material_aliases a
                INNER JOIN materials m ON m.id = a.material_id
                WHERE a.normalized_alias = :slug AND " . $this->publicIdentityClause('m') . ' LIMIT 1');
            $alias->execute([':slug' => $slug]);
            $canonical = trim((string) $alias->fetchColumn());
            return $canonical === '' ? null : ['redirectSlug' => $canonical];
        }
        $material['taxonomies'] = $this->taxonomies((string) $material['id']);
        return $material;
    }

    public function findCanonicalSlugByLegacyId(string $id): ?string
    {
        $stmt = $this->db->prepare("SELECT m.slug FROM materials m WHERE m.id = :id
            AND " . $this->publicIdentityClause('m') . "
            AND BINARY m.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' AND CHAR_LENGTH(m.slug) <= 190 LIMIT 1");
        $stmt->execute([':id' => $id]);
        $slug = trim((string) $stmt->fetchColumn());
        return $slug === '' ? null : $slug;
    }

    /** @return list<array<string,mixed>> */
    private function taxonomies(string $materialId): array
    {
        $stmt = $this->db->prepare("SELECT f.id, f.slug, f.name,
                CASE
                    WHEN f.id = m.subject_id AND f.type = 'assunto' AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1) THEN 'discipline'
                    WHEN f.id = m.topic_id AND f.type = 'assunto' AND f.taxonomy_level = 'topico' THEN 'topic'
                    ELSE NULL
                END AS relationType
            FROM materials m
            INNER JOIN filters f ON f.id = m.subject_id OR f.id = m.topic_id
            WHERE m.id = :id AND TRIM(f.name) <> ''
              AND COALESCE(f.taxonomy_level, '') NOT IN ('pending','internal','technical')
              AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' AND CHAR_LENGTH(f.slug) <= 190
            HAVING relationType IS NOT NULL
            ORDER BY relationType, f.name");
        $stmt->execute([':id' => $materialId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function summaryColumns(string $alias): string
    {
        return "{$alias}.id, {$alias}.slug, {$alias}.title, {$alias}.description, {$alias}.type,
            {$alias}.page_count, {$alias}.year, {$alias}.public_author_name,
            {$alias}.cover_url, {$alias}.cover_is_public, {$alias}.preview_url, {$alias}.preview_is_public,
            {$alias}.availability_status, {$alias}.is_free, {$alias}.currency,
            CAST({$alias}.price AS CHAR) AS price_decimal, {$alias}.updated_at,
            EXISTS (SELECT 1 FROM material_uploads mu
                WHERE mu.attached_material_id = {$alias}.id AND mu.status = 'attached') AS has_asset";
    }

    private function publicIdentityClause(string $alias): string
    {
        return "{$alias}.status = 'approved' AND {$alias}.publication_status = 'published'
            AND {$alias}.visibility_status = 'public' AND {$alias}.rights_status = 'approved'
            AND {$alias}.archived_at IS NULL
            AND ({$alias}.scheduled_at IS NULL OR {$alias}.scheduled_at <= NOW())";
    }

    private function publicClause(string $alias): string
    {
        return $this->publicIdentityClause($alias) . " AND TRIM({$alias}.title) <> ''
            AND BINARY {$alias}.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' AND CHAR_LENGTH({$alias}.slug) <= 190";
    }

    private function assetClause(string $alias): string
    {
        return "EXISTS (SELECT 1 FROM material_uploads ready_mu
            WHERE ready_mu.attached_material_id = {$alias}.id AND ready_mu.status = 'attached')";
    }

    private function listingClause(string $alias): string
    {
        return "({$alias}.availability_status = 'included_in_plan'
            OR ({$alias}.availability_status = 'available' AND (
                ({$alias}.is_free = 1 AND ({$alias}.price IS NULL OR {$alias}.price = 0))
                OR ({$alias}.is_free = 0 AND {$alias}.price > 0 AND BINARY {$alias}.currency = 'BRL')
            )))";
    }
}
