<?php

declare(strict_types=1);

final class ProfessionalTaxonomiesRepository
{
    public const PUBLIC_DETAIL_QUERY_BUDGET = 7;

    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed> */
    public function listPublic(string $kind, int $page, int $limit, string $search = '', string $letter = ''): array
    {
        $type = $this->type($kind);
        $clauses = [$this->publicFilterClause('f', $type)];
        $params = [];
        if ($search !== '') { $clauses[] = 'f.name LIKE :search'; $params[':search'] = '%' . $search . '%'; }
        if ($letter !== '') { $clauses[] = 'f.name LIKE :letter'; $params[':letter'] = $letter . '%'; }
        $where = implode(' AND ', $clauses);
        $count = $this->db->prepare("SELECT COUNT(*) FROM filters f WHERE {$where}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / $limit));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $limit;

        $stmt = $this->db->prepare("SELECT f.id, f.slug, f.name, f.description,
                (SELECT COUNT(DISTINCT q.id) FROM question_filters qf INNER JOIN questions q ON q.id = qf.question_id
                  AND " . $this->publicQuestionClause('q') . " WHERE qf.filter_id = f.id) AS question_count,
                (SELECT COUNT(DISTINCT p.id) FROM prova_filters pf INNER JOIN provas p ON p.id = pf.prova_id
                  AND " . $this->publicExamClause('p') . " WHERE pf.filter_id = f.id) AS exam_count
            FROM filters f WHERE {$where} ORDER BY f.name, f.id LIMIT :limit OFFSET :offset");
        foreach ($params as $key => $value) $stmt->bindValue($key, $value, PDO::PARAM_STR);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return ['rows' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [], 'total' => $total, 'page' => $page, 'pages' => $pages, 'limit' => $limit];
    }

    /** @return array<string,mixed>|null */
    public function findPublicBySlug(string $kind, string $slug): ?array
    {
        $type = $this->type($kind);
        $identity = $this->identity($type, $slug);
        if ($identity === null) {
            $alias = $this->db->prepare("SELECT f.slug FROM filter_aliases a INNER JOIN filters f ON f.id = a.filter_id
                WHERE a.normalized_alias = :slug AND " . $this->publicFilterClause('f', $type) . ' LIMIT 2');
            $alias->execute([':slug' => $slug]);
            $slugs = array_values(array_unique(array_map('strval', $alias->fetchAll(PDO::FETCH_COLUMN) ?: [])));
            return count($slugs) === 1 ? ['redirectSlug' => $slugs[0]] : null;
        }

        $id = (int) $identity['id'];
        $roleScope = $kind === 'career'
            ? "SELECT r.source_filter_id AS role_id FROM filter_relationships r INNER JOIN filters cargo ON cargo.id = r.source_filter_id
                 WHERE r.target_filter_id = :id AND r.relation_type = 'cargo_career' AND " . $this->publicFilterClause('cargo', 'cargo')
            : 'SELECT :id AS role_id';

        $membershipSql = $kind === 'career'
            ? "SELECT cargo.id, cargo.slug, cargo.name,
                    (SELECT COUNT(DISTINCT q.id) FROM question_filters qf INNER JOIN questions q ON q.id=qf.question_id AND " . $this->publicQuestionClause('q') . " WHERE qf.filter_id=cargo.id) questionCount,
                    (SELECT COUNT(DISTINCT p.id) FROM prova_filters pf INNER JOIN provas p ON p.id=pf.prova_id AND " . $this->publicExamClause('p') . " WHERE pf.filter_id=cargo.id) examCount
               FROM filter_relationships r INNER JOIN filters cargo ON cargo.id=r.source_filter_id
              WHERE r.target_filter_id=:id AND r.relation_type='cargo_career' AND " . $this->publicFilterClause('cargo', 'cargo') . ' GROUP BY cargo.id ORDER BY cargo.name LIMIT 40'
            : "SELECT career.id, career.slug, career.name FROM filter_relationships r
               INNER JOIN filters career ON career.id=r.target_filter_id
              WHERE r.source_filter_id=:id AND r.relation_type='cargo_career' AND " . $this->publicFilterClause('career', 'carreira') . ' GROUP BY career.id ORDER BY career.name LIMIT 20';
        $memberships = $this->fetchAll($membershipSql, $id);

        $contests = $this->fetchAll("SELECT c.id, c.slug, c.title, c.domain_status AS status, c.year,
                MIN(org.name) AS organization
            FROM ({$roleScope}) roles INNER JOIN contest_positions cp ON cp.role_filter_id=roles.role_id
            INNER JOIN contests c ON c.id=cp.contest_id
            INNER JOIN contest_organizations co ON co.contest_id=c.id
            INNER JOIN filters org ON org.id=co.organization_filter_id AND " . $this->publicFilterClause('org', 'orgao') . "
            WHERE " . $this->publicContestClause('c') . '
            GROUP BY c.id ORDER BY COALESCE(c.registration_end_at,c.updated_at) DESC,c.id DESC LIMIT 12', $id);

        $organizations = $this->fetchAll("SELECT org.id,org.slug,org.name,org.acronym FROM ({$roleScope}) roles
            INNER JOIN filter_relationships r ON r.source_filter_id=roles.role_id AND r.relation_type='cargo_organization'
            INNER JOIN filters org ON org.id=r.target_filter_id AND " . $this->publicFilterClause('org', 'orgao') . '
            GROUP BY org.id ORDER BY org.name LIMIT 12', $id);

        $exams = $this->fetchAll("SELECT p.id,p.slug,p.nome AS name,p.ano AS year,COUNT(DISTINCT qp.question_id) questionCount
            FROM ({$roleScope}) roles INNER JOIN prova_filters pf ON pf.filter_id=roles.role_id
            INNER JOIN provas p ON p.id=pf.prova_id AND " . $this->publicExamClause('p') . '
            LEFT JOIN question_provas qp ON qp.prova_id=p.id
            GROUP BY p.id ORDER BY COALESCE(p.ano,0) DESC,p.id DESC LIMIT 10', $id);

        $questions = $this->fetchAll("SELECT q.id,LEFT(TRIM(COALESCE(NULLIF(q.enunciado_clean,''),q.enunciado)),320) excerpt
            FROM ({$roleScope}) roles INNER JOIN question_filters qf ON qf.filter_id=roles.role_id
            INNER JOIN questions q ON q.id=qf.question_id AND " . $this->publicQuestionClause('q') . '
            GROUP BY q.id ORDER BY q.published_sort_at DESC,q.id DESC LIMIT 10', $id);

        $boards = $this->fetchAll("SELECT board.id,board.slug,board.name,board.acronym
            FROM ({$roleScope}) roles INNER JOIN prova_filters role_pf ON role_pf.filter_id=roles.role_id
            INNER JOIN provas p ON p.id=role_pf.prova_id AND " . $this->publicExamClause('p') . "
            INNER JOIN prova_filters board_pf ON board_pf.prova_id=p.id
            INNER JOIN filters board ON board.id=board_pf.filter_id AND " . $this->publicFilterClause('board', 'banca') . "
            GROUP BY board.id ORDER BY board.name LIMIT 10", $id);

        return ['identity' => $identity, 'memberships' => $memberships, 'contests' => $contests,
            'organizations' => $organizations, 'exams' => $exams, 'questions' => $questions, 'boards' => $boards];
    }

    /** @return array<string,mixed>|null */
    private function identity(string $type, string $slug): ?array
    {
        $stmt = $this->db->prepare("SELECT f.id,f.type,f.slug,f.name,f.description,f.taxonomy_level,
                (SELECT COUNT(DISTINCT q.id) FROM question_filters qf INNER JOIN questions q ON q.id=qf.question_id AND " . $this->publicQuestionClause('q') . " WHERE qf.filter_id=f.id) question_count,
                (SELECT COUNT(DISTINCT p.id) FROM prova_filters pf INNER JOIN provas p ON p.id=pf.prova_id AND " . $this->publicExamClause('p') . " WHERE pf.filter_id=f.id) exam_count,
                (SELECT MAX(q.updated_at) FROM question_filters qf INNER JOIN questions q ON q.id=qf.question_id AND " . $this->publicQuestionClause('q') . " WHERE qf.filter_id=f.id) content_updated_at
            FROM filters f WHERE f.slug=:slug AND " . $this->publicFilterClause('f', $type) . ' LIMIT 1');
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /** @return list<array<string,mixed>> */
    private function fetchAll(string $sql, int $id): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function type(string $kind): string
    {
        return match ($kind) { 'career' => 'carreira', 'position' => 'cargo', default => throw new InvalidArgumentException('Tipo profissional invalido.') };
    }

    private function publicFilterClause(string $alias, string $type): string
    {
        return "{$alias}.type = '{$type}' AND COALESCE({$alias}.taxonomy_level,'') NOT IN ('pending','internal','technical')
            AND TRIM({$alias}.name) <> ''
            AND LOWER(TRIM({$alias}.name)) NOT IN ('outros','outras','diversos','diversas','geral','nao informado','não informado',
                'sem classificacao','sem classificação','a definir','cargo nao identificado','cargo não identificado')
            AND CHAR_LENGTH({$alias}.slug) <= 190
            AND CAST({$alias}.slug AS BINARY) REGEXP CAST('^[a-z0-9]+(-[a-z0-9]+)*$' AS BINARY)";
    }

    private function publicQuestionClause(string $alias): string
    {
        return "{$alias}.publish_status IN ('published','scheduled') AND {$alias}.visibility_status='public'
            AND {$alias}.published_sort_at IS NOT NULL AND {$alias}.published_sort_at<=NOW()";
    }

    private function publicExamClause(string $alias): string
    {
        return "{$alias}.archived_at IS NULL AND {$alias}.status_editorial='published' AND {$alias}.visibility_status='public'
            AND ({$alias}.scheduled_at IS NULL OR {$alias}.scheduled_at<=NOW()) AND TRIM({$alias}.nome)<>''
            AND CAST({$alias}.slug AS BINARY) REGEXP CAST('^[a-z0-9]+(-[a-z0-9]+)*$' AS BINARY)";
    }

    private function publicContestClause(string $alias): string
    {
        return "{$alias}.publication_status='published' AND {$alias}.visibility_status='public' AND {$alias}.archived_at IS NULL
            AND ({$alias}.scheduled_at IS NULL OR {$alias}.scheduled_at<=NOW()) AND TRIM({$alias}.title)<>''
            AND CAST({$alias}.slug AS BINARY) REGEXP CAST('^[a-z0-9]+(-[a-z0-9]+)*$' AS BINARY)";
    }
}
