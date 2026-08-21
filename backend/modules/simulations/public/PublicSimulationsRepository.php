<?php

declare(strict_types=1);

final class PublicSimulationsRepository
{
    public const PUBLIC_DETAIL_QUERY_BUDGET = 5;

    public function __construct(private readonly PDO $db) {}

    /** @return array{rows:list<array<string,mixed>>,total:int,page:int,pages:int,limit:int} */
    public function listReady(int $page, int $limit, string $search = ''): array
    {
        $where = $this->publicationClause('s') . ' AND ' . $this->validCompositionClause('s');
        $params = [];
        if ($search !== '') {
            $where .= ' AND (s.title LIKE :search OR s.description LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }
        $count = $this->db->prepare("SELECT COUNT(*) FROM public_simulations s WHERE {$where}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / $limit));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $limit;

        $stmt = $this->db->prepare("SELECT s.id, s.slug, s.title, s.description, s.duration_minutes,
                s.availability_status, s.updated_at,
                (SELECT COUNT(*) FROM public_simulation_questions sq
                 INNER JOIN questions q ON q.id = sq.question_id
                    AND q.publish_status IN ('published', 'scheduled')
                    AND q.visibility_status = 'public'
                    AND q.published_sort_at IS NOT NULL AND q.published_sort_at <= NOW()
                 WHERE sq.simulation_id = s.id) AS question_count
            FROM public_simulations s WHERE {$where}
            ORDER BY COALESCE(s.published_at, s.updated_at) DESC, s.id DESC
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
        $stmt = $this->db->prepare("SELECT s.*,
                (SELECT COUNT(*) FROM public_simulation_questions sq
                 INNER JOIN questions q ON q.id = sq.question_id
                    AND q.publish_status IN ('published', 'scheduled')
                    AND q.visibility_status = 'public'
                    AND q.published_sort_at IS NOT NULL AND q.published_sort_at <= NOW()
                 WHERE sq.simulation_id = s.id) AS question_count
            FROM public_simulations s
            WHERE s.slug = :slug AND " . $this->publicationClause('s') . ' LIMIT 1');
        $stmt->execute([':slug' => $slug]);
        $simulation = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$simulation) {
            $alias = $this->db->prepare("SELECT s.slug FROM public_simulation_aliases a
                INNER JOIN public_simulations s ON s.id = a.simulation_id
                WHERE a.normalized_alias = :slug AND " . $this->publicationClause('s') . ' LIMIT 1');
            $alias->execute([':slug' => $slug]);
            $canonical = trim((string) $alias->fetchColumn());
            return $canonical === '' ? null : ['redirectSlug' => $canonical];
        }

        $id = (int) $simulation['id'];
        $questions = $this->fetchAll("SELECT q.id, sq.position,
                LEFT(COALESCE(NULLIF(q.enunciado_clean, ''), NULLIF(q.enunciado, ''), CONCAT('Questao ', q.id)), 240) AS excerpt
            FROM public_simulation_questions sq INNER JOIN questions q ON q.id = sq.question_id
            WHERE sq.simulation_id = :id
              AND q.publish_status IN ('published', 'scheduled') AND q.visibility_status = 'public'
              AND q.published_sort_at IS NOT NULL AND q.published_sort_at <= NOW()
            ORDER BY sq.position, q.id LIMIT 12", $id);
        $taxonomies = $this->fetchAll("SELECT f.id, f.slug, f.name, sf.relation_type AS relationType
            FROM public_simulation_filters sf INNER JOIN filters f ON f.id = sf.filter_id
            WHERE sf.simulation_id = :id AND TRIM(f.name) <> ''
              AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
              AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' AND CHAR_LENGTH(f.slug) <= 190
              AND ((sf.relation_type = 'discipline' AND f.type = 'assunto' AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1))
                OR (sf.relation_type = 'topic' AND f.type = 'assunto' AND f.taxonomy_level = 'topico')
                OR (sf.relation_type = 'subject' AND f.type = 'assunto' AND f.taxonomy_level = 'assunto')
                OR (sf.relation_type = 'career' AND f.type = 'carreira')
                OR (sf.relation_type = 'position' AND f.type = 'cargo')
                OR (sf.relation_type = 'board' AND f.type = 'banca')
                OR (sf.relation_type = 'organization' AND f.type = 'orgao'))
            ORDER BY sf.relation_type, f.name", $id);
        $contests = $this->fetchAll("SELECT c.id, c.slug, c.title
            FROM public_simulation_contests sc INNER JOIN contests c ON c.id = sc.contest_id
            WHERE sc.simulation_id = :id AND c.publication_status = 'published'
              AND c.visibility_status = 'public' AND c.archived_at IS NULL
              AND (c.scheduled_at IS NULL OR c.scheduled_at <= NOW())
              AND TRIM(c.title) <> '' AND BINARY c.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
            ORDER BY c.title LIMIT 12", $id);
        $exams = $this->fetchAll("SELECT p.id, p.slug, p.nome AS title, p.ano AS year
            FROM public_simulation_exams se INNER JOIN provas p ON p.id = se.exam_id
            WHERE se.simulation_id = :id AND p.archived_at IS NULL
              AND p.status_editorial = 'published' AND p.visibility_status = 'public'
              AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
              AND TRIM(p.nome) <> '' AND BINARY p.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
            ORDER BY p.ano DESC, p.id DESC LIMIT 12", $id);
        return compact('simulation', 'questions', 'taxonomies', 'contests', 'exams');
    }

    /** @return list<array<string,mixed>> */
    private function fetchAll(string $sql, int $id): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function publicationClause(string $alias): string
    {
        // Scheduled records require an explicit editorial promotion to published.
        // Unlisted is intentionally nonpublic rather than a secret public URL.
        return "{$alias}.publication_status = 'published'
            AND {$alias}.visibility_status = 'public'
            AND {$alias}.archived_at IS NULL
            AND ({$alias}.scheduled_at IS NULL OR {$alias}.scheduled_at <= NOW())
            AND TRIM({$alias}.title) <> ''
            AND BINARY {$alias}.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
            AND CHAR_LENGTH({$alias}.slug) <= 190";
    }

    private function validCompositionClause(string $alias): string
    {
        return "EXISTS (SELECT 1 FROM public_simulation_questions ready_sq
            INNER JOIN questions ready_q ON ready_q.id = ready_sq.question_id
                AND ready_q.publish_status IN ('published', 'scheduled')
                AND ready_q.visibility_status = 'public'
                AND ready_q.published_sort_at IS NOT NULL AND ready_q.published_sort_at <= NOW()
            WHERE ready_sq.simulation_id = {$alias}.id)";
    }
}
