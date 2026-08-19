<?php

declare(strict_types=1);

require_once __DIR__ . '/../domain/ContestOpenState.php';

final class ContestsRepository
{
    public const PUBLIC_DETAIL_QUERY_BUDGET = 6;

    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed> */
    public function listPublic(int $page, int $limit, string $search = '', ?int $year = null, ?string $status = null, bool $openOnly = false): array
    {
        [$where, $params] = $this->publicWhere($search, $year, $status, $openOnly);
        $count = $this->db->prepare("SELECT COUNT(*) FROM contests c WHERE {$where}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / $limit));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $limit;
        $orderBy = $openOnly
            ? 'c.registration_end_at ASC, c.id ASC'
            : 'COALESCE(c.registration_end_at, c.notice_published_at, c.updated_at) DESC, c.id DESC';

        $openPredicate = ContestOpenState::sqlPredicate('c');
        $stmt = $this->db->prepare("SELECT c.id, c.slug, c.title, c.description, c.domain_status, c.year,
                    c.registration_start_at, c.registration_end_at, c.updated_at,
                    CASE WHEN {$openPredicate} THEN 1 ELSE 0 END AS is_open,
                    primary_org.name AS organization_name, primary_org.acronym AS organization_acronym,
                    public_board.name AS board_name, public_board.acronym AS board_acronym
               FROM contests c
               LEFT JOIN filters primary_org ON primary_org.id = (
                    SELECT co.organization_filter_id
                    FROM contest_organizations co
                    WHERE co.contest_id = c.id
                    ORDER BY co.is_primary DESC, co.organization_filter_id
                    LIMIT 1
               )
                    AND primary_org.type = 'orgao'
                    AND COALESCE(primary_org.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
               LEFT JOIN filters public_board ON public_board.id = c.board_filter_id
                    AND public_board.type = 'banca'
                    AND COALESCE(public_board.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                    AND BINARY public_board.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
              WHERE {$where}
              ORDER BY {$orderBy}
              LIMIT :limit OFFSET :offset");
        foreach ($params as $name => $value) $stmt->bindValue($name, $value);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return ['rows' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [], 'total' => $total, 'page' => $page, 'pages' => $pages, 'limit' => $limit];
    }

    /** @return array<string,mixed>|null */
    public function findPublicBySlug(string $slug): ?array
    {
        $contest = $this->findPublicIdentity($slug);
        if ($contest === null) {
            $alias = $this->db->prepare("SELECT c.slug AS canonical_slug
                FROM contest_aliases a INNER JOIN contests c ON c.id = a.contest_id
                WHERE a.normalized_alias = :slug AND " . $this->publicationClause('c') . ' LIMIT 1');
            $alias->execute([':slug' => $slug]);
            $canonical = trim((string) $alias->fetchColumn());
            return $canonical === '' ? null : ['redirectSlug' => $canonical];
        }

        $id = (int) $contest['id'];
        $organizations = $this->fetchAll("SELECT f.id, f.slug, f.name, f.acronym
            FROM contest_organizations co INNER JOIN filters f ON f.id = co.organization_filter_id
                AND f.type = 'orgao'
                AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
            WHERE co.contest_id = :id ORDER BY co.is_primary DESC, f.name", $id);
        $positions = $this->fetchAll("SELECT cp.id, f.id AS roleId, f.name, cp.vacancies,
                cp.reserve_registry AS reserveRegistry, cp.salary_min AS salaryMin, cp.salary_max AS salaryMax,
                cp.education_level AS educationLevel, cp.weekly_hours AS weeklyHours, cp.location_label AS locationLabel
            FROM contest_positions cp INNER JOIN filters f ON f.id = cp.role_filter_id
                AND f.type = 'cargo'
                AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
            WHERE cp.contest_id = :id ORDER BY f.name", $id);
        $documents = $this->fetchAll("SELECT id, document_type AS type, title, public_url AS url, published_at AS publishedAt
            FROM contest_documents WHERE contest_id = :id AND publication_status = 'published'
            ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT 12", $id);
        $exams = $this->fetchAll("SELECT p.id, p.slug, p.nome AS title, p.ano AS year, COUNT(DISTINCT qp.question_id) AS questionCount
            FROM contest_exams ce INNER JOIN provas p ON p.id = ce.exam_id
            LEFT JOIN question_provas qp ON qp.prova_id = p.id
            WHERE ce.contest_id = :id AND p.archived_at IS NULL AND p.status_editorial = 'published'
              AND p.visibility_status = 'public' AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
              AND TRIM(p.nome) <> '' AND BINARY p.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
            GROUP BY p.id ORDER BY p.ano DESC, p.id DESC LIMIT 12", $id);
        $questions = $this->fetchAll("SELECT q.id,
                LEFT(COALESCE(NULLIF(q.enunciado_clean, ''), NULLIF(q.enunciado, ''), CONCAT('Questao ', q.id)), 240) AS excerpt
            FROM contest_exams ce INNER JOIN provas p ON p.id = ce.exam_id
                AND p.archived_at IS NULL AND p.status_editorial = 'published'
                AND p.visibility_status = 'public' AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
            INNER JOIN question_provas qp ON qp.prova_id = ce.exam_id
            INNER JOIN questions q ON q.id = qp.question_id
            WHERE ce.contest_id = :id AND q.publish_status IN ('published', 'scheduled') AND q.visibility_status = 'public'
              AND q.published_sort_at IS NOT NULL AND q.published_sort_at <= NOW()
            ORDER BY q.published_sort_at DESC, q.id DESC LIMIT 10", $id);
        return compact('contest', 'organizations', 'positions', 'documents', 'exams', 'questions')
            + ['questionCount' => (int) ($contest['question_count'] ?? 0)];
    }

    /** @return array<string,mixed>|null */
    private function findPublicIdentity(string $slug): ?array
    {
        $openPredicate = ContestOpenState::sqlPredicate('c');
        $stmt = $this->db->prepare("SELECT c.*, CASE WHEN {$openPredicate} THEN 1 ELSE 0 END AS is_open,
            b.id AS board_id, b.slug AS board_slug, b.name AS board_name, b.acronym AS board_acronym,
            (SELECT COUNT(DISTINCT q.id) FROM contest_exams ce
             INNER JOIN provas p ON p.id = ce.exam_id
                AND p.archived_at IS NULL AND p.status_editorial = 'published'
                AND p.visibility_status = 'public' AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
             INNER JOIN question_provas qp ON qp.prova_id = ce.exam_id
             INNER JOIN questions q ON q.id = qp.question_id
             WHERE ce.contest_id = c.id AND q.publish_status IN ('published', 'scheduled') AND q.visibility_status = 'public'
               AND q.published_sort_at IS NOT NULL AND q.published_sort_at <= NOW()) AS question_count
            FROM contests c LEFT JOIN filters b ON b.id = c.board_filter_id
                AND b.type = 'banca'
                AND COALESCE(b.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                AND BINARY b.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
            WHERE c.slug = :slug AND " . $this->publicationClause('c') . ' LIMIT 1');
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /** @return list<array<string,mixed>> */
    private function fetchAll(string $sql, int $id): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @return array{0:string,1:array<string,mixed>} */
    private function publicWhere(string $search, ?int $year, ?string $status, bool $openOnly): array
    {
        $clauses = [$this->publicationClause('c')];
        $params = [];
        if ($search !== '') { $clauses[] = '(c.title LIKE :search OR c.description LIKE :search)'; $params[':search'] = '%' . $search . '%'; }
        if ($year !== null) { $clauses[] = 'c.year = :year'; $params[':year'] = $year; }
        if ($status !== null) { $clauses[] = 'c.domain_status = :status'; $params[':status'] = $status; }
        if ($openOnly) {
            $clauses[] = ContestOpenState::sqlPredicate('c');
        }
        return [implode(' AND ', $clauses), $params];
    }

    private function publicationClause(string $alias): string
    {
        return "{$alias}.publication_status = 'published'
            AND {$alias}.visibility_status = 'public'
            AND {$alias}.archived_at IS NULL
            AND ({$alias}.scheduled_at IS NULL OR {$alias}.scheduled_at <= NOW())
            AND TRIM({$alias}.title) <> ''
            AND BINARY {$alias}.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
            AND EXISTS (
                SELECT 1
                FROM contest_organizations public_co
                INNER JOIN filters public_org ON public_org.id = public_co.organization_filter_id
                    AND public_org.type = 'orgao'
                    AND COALESCE(public_org.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                    AND TRIM(public_org.name) <> ''
                    AND BINARY public_org.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
                WHERE public_co.contest_id = {$alias}.id
            )";
    }
}
