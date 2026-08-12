<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Repositorio do dominio de filtros/taxonomias.
 *
 * @since 1.0.0
 */
require_once __DIR__ . '/../../../shared/runtime/RuntimeStoreFactory.php';

class FiltersRepository
{
    private PDO $db;

    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Carrega todas as taxonomias cadastradas.
     *
     * @since 1.0.0
     */
    public function fetchAll(): array
    {
        $stmt = $this->db->prepare("
            SELECT id, type, name, slug, acronym, parent_id, description, website,
                   asset_url, icon_key, keywords_json,
                   meta_materia, taxonomy_level, meta_carreira
            FROM filters
            ORDER BY name
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $aliasesByFilterId = $this->fetchAliasesByFilterIds(array_map(
            static fn (array $row): int => (int) $row['id'],
            $rows
        ));
        foreach ($rows as &$row) {
            $row['aliases'] = $aliasesByFilterId[(int) $row['id']] ?? [];
        }
        unset($row);
        return $rows;
    }

    /**
     * Carrega somente taxonomias que podem aparecer nos filtros publicos da pratica.
     *
     * A lista completa ultrapassa dezenas de milhares de registros e nao deve ser
     * materializada durante a hidratacao da pagina. Os ancestrais sao mantidos
     * para que materia, topico e assunto continuem formando uma arvore valida.
     */
    public function fetchPracticeCatalog(): array
    {
        $publishedQuestionClause = "q.publish_status IN ('published', 'scheduled')
            AND q.visibility_status = 'public'
            AND q.published_sort_at IS NOT NULL
            AND q.published_sort_at <= NOW()";

        $stmt = $this->db->prepare(
            "WITH RECURSIVE practice_filters AS (
                SELECT DISTINCT f.id, f.parent_id, 0 AS depth,
                       CAST(CONCAT(',', f.id, ',') AS CHAR(512)) AS visited
                FROM filters f
                INNER JOIN question_filters qf ON qf.filter_id = f.id
                INNER JOIN questions q ON q.id = qf.question_id
                    AND {$publishedQuestionClause}

                UNION ALL

                SELECT parent.id, parent.parent_id, child.depth + 1,
                       CONCAT(child.visited, parent.id, ',')
                FROM practice_filters child
                INNER JOIN filters parent ON parent.id = child.parent_id
                WHERE child.depth < 8
                  AND child.visited NOT LIKE CONCAT('%,', parent.id, ',%')
            )
            SELECT DISTINCT f.id, f.type, f.name, f.slug, f.acronym, f.parent_id,
                   f.description, f.website, f.asset_url, f.icon_key, f.keywords_json,
                   f.meta_materia, f.taxonomy_level, f.meta_carreira
            FROM filters f
            INNER JOIN practice_filters selected ON selected.id = f.id
            ORDER BY f.name ASC, f.id ASC"
        );
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Retorna o uso editorial de cada taxonomia em consultas agregadas.
     *
     * Os contadores representam vinculos existentes, independentemente do
     * estado editorial do conteudo, para que o painel administrativo possa
     * avaliar o impacto de editar ou remover uma taxonomia.
     */
    public function fetchUsageOverview(array $filterIds = []): array
    {
        $byFilterId = [];

        $filterIds = array_values(array_unique(array_filter(array_map('intval', $filterIds))));
        $filterCondition = $filterIds === [] ? '' : ' WHERE filter_id IN (' . implode(',', array_fill(0, count($filterIds), '?')) . ')';

        $this->mergeUsageRows($byFilterId, $this->fetchUsageRows(
            'SELECT filter_id, COUNT(DISTINCT question_id) AS usage_count
             FROM question_filters
             ' . $filterCondition . '
             GROUP BY filter_id',
            $filterIds
        ), 'questions');

        $this->mergeUsageRows($byFilterId, $this->fetchUsageRows(
            'SELECT filter_id, COUNT(DISTINCT prova_id) AS usage_count
             FROM prova_filters
             ' . $filterCondition . '
             GROUP BY filter_id',
            $filterIds
        ), 'exams');

        $this->mergeUsageRows($byFilterId, $this->fetchUsageRows(
            'SELECT filter_id, COUNT(DISTINCT law_id) AS usage_count
             FROM (
                SELECT law_topic_filter_id AS filter_id, id AS law_id
                FROM laws
                WHERE law_topic_filter_id IS NOT NULL
                UNION
                SELECT subtopic_filter_id AS filter_id, law_id
                FROM law_sections
                WHERE subtopic_filter_id IS NOT NULL
                UNION
                SELECT assunto_filter_id AS filter_id, law_id
                FROM law_sections
                WHERE assunto_filter_id IS NOT NULL
                UNION
                SELECT assunto_filter_id AS filter_id, law_id
                FROM law_articles
                WHERE assunto_filter_id IS NOT NULL
             ) AS law_filter_links
             ' . $filterCondition . '
             GROUP BY filter_id',
            $filterIds
        ), 'laws');

        foreach ($byFilterId as &$usage) {
            $usage['total'] = $usage['questions'] + $usage['exams'] + $usage['laws'];
        }
        unset($usage);

        return $byFilterId;
    }

    /**
     * Lista somente a pagina administrativa solicitada, sem materializar toda
     * a arvore de taxonomias no navegador.
     */
    public function fetchPage(int $page, int $perPage, string $uiType = 'all', string $search = ''): array
    {
        [$where, $params] = $this->buildPageWhereClause($uiType, $search);
        $count = $this->db->prepare("SELECT COUNT(*) FROM filters f {$where}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $perPage;

        $query = $this->db->prepare("
            SELECT f.id, f.type, f.name, f.slug, f.acronym, f.parent_id, f.description, f.website,
                   f.asset_url, f.icon_key, f.keywords_json, f.meta_materia, f.taxonomy_level, f.meta_carreira,
                   parent.name AS parent_name
            FROM filters f
            LEFT JOIN filters parent ON parent.id = f.parent_id
            {$where}
            ORDER BY f.name ASC, f.id ASC
            LIMIT :limit OFFSET :offset
        ");
        foreach ($params as $name => $value) {
            $query->bindValue($name, $value);
        }
        $query->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $query->bindValue(':offset', $offset, PDO::PARAM_INT);
        $query->execute();
        $rows = $query->fetchAll(PDO::FETCH_ASSOC);
        $aliasesByFilterId = $this->fetchAliasesByFilterIds(array_map(
            static fn (array $row): int => (int) $row['id'],
            $rows
        ));
        $relationshipsByFilterId = $this->fetchRelationshipsByFilterIds(array_map(
            static fn (array $row): int => (int) $row['id'],
            $rows
        ));
        foreach ($rows as &$row) {
            $row['aliases'] = $aliasesByFilterId[(int) $row['id']] ?? [];
            $row['relationships'] = $relationshipsByFilterId[(int) $row['id']] ?? [];
        }
        unset($row);

        return [
            'rows' => $rows,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'pages' => $pages,
        ];
    }

    /**
     * Resume os vinculos por tipo para a navegacao lateral. A resposta fica
     * cacheada por poucos segundos; os contadores de cada linha continuam
     * sendo calculados para a pagina atual.
     */
    public function fetchUsageSummary(): array
    {
        $store = RuntimeStoreFactory::shared();
        $cacheKey = 'filters:admin:usage-summary:v1';
        $cached = $store->get($cacheKey);
        if (is_string($cached)) {
            $decoded = json_decode($cached, true);
            if (is_array($decoded) && isset($decoded['all'], $decoded['byType'])) {
                return $decoded;
            }
        }

        $summary = $this->emptyUsageSummary();
        foreach ($this->db->query(
            'SELECT type, taxonomy_level, meta_materia, COUNT(*) AS taxonomy_count
             FROM filters
             GROUP BY type, taxonomy_level, meta_materia'
        )->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $type = $this->resolveUsageType($row);
            $this->ensureUsageSummaryType($summary, $type);
            $summary['byType'][$type]['taxonomies'] += (int) $row['taxonomy_count'];
            $summary['all']['taxonomies'] += (int) $row['taxonomy_count'];
        }

        $this->mergeUsageSummaryRows($summary, $this->db->query(
            'SELECT f.type, f.taxonomy_level, f.meta_materia, COUNT(DISTINCT qf.question_id) AS usage_count
             FROM question_filters qf
             INNER JOIN filters f ON f.id = qf.filter_id
             GROUP BY f.type, f.taxonomy_level, f.meta_materia'
        )->fetchAll(PDO::FETCH_ASSOC), 'questions');
        $this->mergeUsageSummaryRows($summary, $this->db->query(
            'SELECT f.type, f.taxonomy_level, f.meta_materia, COUNT(DISTINCT pf.prova_id) AS usage_count
             FROM prova_filters pf
             INNER JOIN filters f ON f.id = pf.filter_id
             GROUP BY f.type, f.taxonomy_level, f.meta_materia'
        )->fetchAll(PDO::FETCH_ASSOC), 'exams');
        $this->mergeUsageSummaryRows($summary, $this->db->query(
            'SELECT f.type, f.taxonomy_level, f.meta_materia, COUNT(DISTINCT law_id) AS usage_count
             FROM (
                SELECT law_topic_filter_id AS filter_id, id AS law_id FROM laws WHERE law_topic_filter_id IS NOT NULL
                UNION
                SELECT subtopic_filter_id AS filter_id, law_id FROM law_sections WHERE subtopic_filter_id IS NOT NULL
                UNION
                SELECT assunto_filter_id AS filter_id, law_id FROM law_sections WHERE assunto_filter_id IS NOT NULL
                UNION
                SELECT assunto_filter_id AS filter_id, law_id FROM law_articles WHERE assunto_filter_id IS NOT NULL
             ) AS law_filter_links
             INNER JOIN filters f ON f.id = law_filter_links.filter_id
             GROUP BY f.type, f.taxonomy_level, f.meta_materia'
        )->fetchAll(PDO::FETCH_ASSOC), 'laws');

        foreach ($summary['byType'] as &$usage) {
            $usage['total'] = $usage['questions'] + $usage['exams'] + $usage['laws'];
        }
        unset($usage);
        $summary['all']['total'] = $summary['all']['questions'] + $summary['all']['exams'] + $summary['all']['laws'];
        $store->set($cacheKey, json_encode($summary), 15);

        return $summary;
    }

    /**
     * Lista taxonomias publicas com a quantidade real de questoes publicadas.
     * A consulta e deliberadamente separada do contrato administrativo: nao
     * expoe metadados internos, aliases, identidades externas ou relacoes.
     */
    public function fetchPublicDirectory(
        string $directoryType,
        int $page,
        int $perPage,
        string $search = '',
        string $letter = ''
    ): array {
        $isSubject = $directoryType === 'subjects';
        $taxonomyClause = $isSubject
            ? "f.type = 'assunto' AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1)"
            : "f.type = 'banca'";
        $params = [];
        $filterClauses = [$taxonomyClause];

        if ($search !== '') {
            $filterClauses[] = '(f.name LIKE :search OR f.acronym LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }
        if ($letter !== '') {
            $filterClauses[] = 'f.name LIKE :letter';
            $params[':letter'] = $letter . '%';
        }

        $where = implode(' AND ', $filterClauses);
        $publishedQuestionClause = "q.publish_status IN ('published', 'scheduled')
            AND q.visibility_status = 'public'
            AND q.published_sort_at IS NOT NULL
            AND q.published_sort_at <= NOW()";
        $publicExamJoin = $isSubject ? '' : "
             LEFT JOIN prova_filters pf ON pf.filter_id = f.id
             LEFT JOIN provas p ON p.id = pf.prova_id
                AND p.status_editorial = 'published'
                AND p.visibility_status = 'public'
                AND p.archived_at IS NULL
                AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())";
        $examCountSelect = $isSubject
            ? '0 AS exam_count'
            : 'COUNT(DISTINCT p.id) AS exam_count';

        $count = $this->db->prepare(
            "SELECT COUNT(*)
             FROM (
                SELECT f.id
                FROM filters f
                INNER JOIN question_filters qf ON qf.filter_id = f.id
                INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                WHERE {$where}
                GROUP BY f.id
             ) public_taxonomies"
        );
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $perPage;

        $query = $this->db->prepare(
            "SELECT f.id, f.name, f.slug, f.acronym, f.description, f.asset_url,
                    COUNT(DISTINCT q.id) AS question_count,
                    {$examCountSelect}
             FROM filters f
             INNER JOIN question_filters qf ON qf.filter_id = f.id
             INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
             {$publicExamJoin}
             WHERE {$where}
             GROUP BY f.id, f.name, f.slug, f.acronym, f.description, f.asset_url
             ORDER BY f.name ASC, f.id ASC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $name => $value) {
            $query->bindValue($name, $value, PDO::PARAM_STR);
        }
        $query->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $query->bindValue(':offset', $offset, PDO::PARAM_INT);
        $query->execute();

        return [
            'rows' => $query->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'pages' => $pages,
        ];
    }

    /**
     * Agrega o perfil publico de uma banca sem expor metadados administrativos.
     * Os status dos concursos sao calculados somente a partir das datas canonicas.
     */
    public function fetchPublicBoardDetail(string $slug, int $page, int $perPage, string $status = 'all'): ?array
    {
        $publishedQuestionClause = "q.publish_status IN ('published', 'scheduled')
            AND q.visibility_status = 'public'
            AND q.published_sort_at IS NOT NULL
            AND q.published_sort_at <= NOW()";
        $publicExamClause = "p.archived_at IS NULL
            AND p.status_editorial = 'published'
            AND p.visibility_status = 'public'
            AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())";

        $boardStmt = $this->db->prepare(
            "SELECT f.id, f.name, f.slug, f.acronym, f.description, f.website, f.asset_url,
                    (SELECT COUNT(DISTINCT q.id)
                       FROM question_filters qf
                       INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                      WHERE qf.filter_id = f.id) AS question_count,
                    (SELECT COUNT(DISTINCT p.id)
                       FROM prova_filters pf
                       INNER JOIN provas p ON p.id = pf.prova_id AND {$publicExamClause}
                      WHERE pf.filter_id = f.id) AS exam_count
               FROM filters f
              WHERE f.type = 'banca' AND f.slug = :slug
              LIMIT 1"
        );
        $boardStmt->execute([':slug' => $slug]);
        $board = $boardStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($board)) {
            return null;
        }

        $boardId = (int) $board['id'];
        $openCondition = "p.inscricoes_inicio IS NOT NULL
            AND p.inscricoes_fim IS NOT NULL
            AND CURDATE() BETWEEN DATE(p.inscricoes_inicio) AND DATE(p.inscricoes_fim)";
        $completedCondition = "NOT ({$openCondition}) AND (
            (p.resultado_data IS NOT NULL AND DATE(p.resultado_data) <= CURDATE())
            OR (p.data_prova IS NOT NULL AND DATE(p.data_prova) < CURDATE())
        )";
        $upcomingCondition = "NOT ({$openCondition}) AND NOT ({$completedCondition}) AND (
            (p.inscricoes_inicio IS NOT NULL AND DATE(p.inscricoes_inicio) > CURDATE())
            OR (p.data_prova IS NOT NULL AND DATE(p.data_prova) >= CURDATE())
        )";
        $unknownCondition = "NOT ({$openCondition}) AND NOT ({$completedCondition}) AND NOT ({$upcomingCondition})";
        $statusConditions = [
            'open' => $openCondition,
            'upcoming' => $upcomingCondition,
            'completed' => $completedCondition,
            'unknown' => $unknownCondition,
        ];
        $statusClause = isset($statusConditions[$status]) ? ' AND ' . $statusConditions[$status] : '';

        $examSummaryStmt = $this->db->prepare(
            "SELECT COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN {$openCondition} THEN 1 ELSE 0 END), 0) AS open_count,
                    COALESCE(SUM(CASE WHEN {$upcomingCondition} THEN 1 ELSE 0 END), 0) AS upcoming_count,
                    COALESCE(SUM(CASE WHEN {$completedCondition} THEN 1 ELSE 0 END), 0) AS completed_count,
                    COALESCE(SUM(CASE WHEN {$unknownCondition} THEN 1 ELSE 0 END), 0) AS unknown_count
               FROM provas p
              WHERE {$publicExamClause}
                AND EXISTS (
                    SELECT 1 FROM prova_filters pf_board
                     WHERE pf_board.prova_id = p.id AND pf_board.filter_id = :board_id
                )"
        );
        $examSummaryStmt->execute([':board_id' => $boardId]);
        $examSummary = $examSummaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $totalForStatus = $status === 'all'
            ? (int) ($examSummary['total'] ?? 0)
            : (int) ($examSummary[$status . '_count'] ?? 0);
        $pages = max(1, (int) ceil($totalForStatus / max(1, $perPage)));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $perPage;

        $examsStmt = $this->db->prepare(
            "SELECT p.id, p.nome, p.slug, p.ano, p.inscricoes_inicio, p.inscricoes_fim,
                    p.data_prova, p.resultado_data,
                    COUNT(DISTINCT q_exam.id) AS question_count,
                    GROUP_CONCAT(DISTINCT CASE WHEN f.type = 'orgao' THEN COALESCE(NULLIF(f.acronym, ''), f.name) END ORDER BY f.name SEPARATOR '||') AS organizations,
                    CASE
                        WHEN {$openCondition} THEN 'open'
                        WHEN {$completedCondition} THEN 'completed'
                        WHEN {$upcomingCondition} THEN 'upcoming'
                        ELSE 'unknown'
                    END AS public_status
               FROM provas p
               LEFT JOIN question_provas qp ON qp.prova_id = p.id
               LEFT JOIN questions q_exam ON q_exam.id = qp.question_id
                    AND q_exam.publish_status IN ('published', 'scheduled')
                    AND q_exam.visibility_status = 'public'
                    AND q_exam.published_sort_at IS NOT NULL
                    AND q_exam.published_sort_at <= NOW()
               LEFT JOIN prova_filters pf ON pf.prova_id = p.id
               LEFT JOIN filters f ON f.id = pf.filter_id
              WHERE {$publicExamClause}
                AND EXISTS (
                    SELECT 1 FROM prova_filters pf_board
                     WHERE pf_board.prova_id = p.id AND pf_board.filter_id = :board_id
                )
                {$statusClause}
              GROUP BY p.id, p.nome, p.slug, p.ano, p.inscricoes_inicio, p.inscricoes_fim,
                       p.data_prova, p.resultado_data
              ORDER BY CASE public_status WHEN 'open' THEN 1 WHEN 'upcoming' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
                       COALESCE(p.data_prova, p.inscricoes_inicio, CONCAT(COALESCE(p.ano, 0), '-01-01')) DESC,
                       p.id DESC
              LIMIT :limit OFFSET :offset"
        );
        $examsStmt->bindValue(':board_id', $boardId, PDO::PARAM_INT);
        $examsStmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $examsStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $examsStmt->execute();

        $subjectsStmt = $this->db->prepare(
            "SELECT subject.id, subject.name, subject.slug, COUNT(DISTINCT q.id) AS question_count
               FROM question_filters qf_board
               INNER JOIN questions q ON q.id = qf_board.question_id AND {$publishedQuestionClause}
               INNER JOIN question_filters qf_subject ON qf_subject.question_id = q.id
               INNER JOIN filters subject ON subject.id = qf_subject.filter_id
                    AND subject.type = 'assunto'
                    AND (subject.taxonomy_level = 'materia' OR subject.meta_materia = 1)
              WHERE qf_board.filter_id = :board_id
              GROUP BY subject.id, subject.name, subject.slug
              ORDER BY question_count DESC, subject.name ASC
              LIMIT 10"
        );
        $subjectsStmt->execute([':board_id' => $boardId]);

        $profileStmt = $this->db->prepare(
            "SELECT COALESCE(NULLIF(LOWER(TRIM(q.tipo)), ''), 'nao_informado') AS modality,
                    COALESCE(q.dificuldade, 0) AS difficulty,
                    COUNT(DISTINCT q.id) AS question_count
               FROM question_filters qf_board
               INNER JOIN questions q ON q.id = qf_board.question_id AND {$publishedQuestionClause}
              WHERE qf_board.filter_id = :board_id
              GROUP BY modality, difficulty
              ORDER BY question_count DESC"
        );
        $profileStmt->execute([':board_id' => $boardId]);

        return [
            'board' => $board,
            'exams' => $examsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'examSummary' => $examSummary,
            'topSubjects' => $subjectsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'questionProfile' => $profileStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'page' => $page,
            'perPage' => $perPage,
            'pages' => $pages,
            'total' => $totalForStatus,
            'status' => $status,
        ];
    }

    /**
     * Lista somente o proximo nivel de uma taxonomia de conhecimento.
     * A arvore publica e expandida sob demanda para evitar payloads gigantes.
     */
    public function fetchPublicTaxonomyChildren(int $parentId, int $page, int $perPage): array
    {
        $publishedQuestionClause = "q.publish_status IN ('published', 'scheduled')
            AND q.visibility_status = 'public'
            AND q.published_sort_at IS NOT NULL
            AND q.published_sort_at <= NOW()";
        $baseFrom = "FROM filters f
             INNER JOIN question_filters qf ON qf.filter_id = f.id
             INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
             WHERE f.type = 'assunto' AND f.parent_id = :parent_id";

        $count = $this->db->prepare(
            "SELECT COUNT(*) FROM (
                SELECT f.id {$baseFrom} GROUP BY f.id
             ) public_taxonomy_children"
        );
        $count->bindValue(':parent_id', $parentId, PDO::PARAM_INT);
        $count->execute();
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $perPage;

        $query = $this->db->prepare(
            "SELECT f.id, f.name, f.slug, f.taxonomy_level,
                    COUNT(DISTINCT q.id) AS question_count,
                    EXISTS(
                        SELECT 1 FROM filters child
                        WHERE child.type = 'assunto' AND child.parent_id = f.id
                        LIMIT 1
                    ) AS has_children
             {$baseFrom}
             GROUP BY f.id, f.name, f.slug, f.taxonomy_level
             ORDER BY f.name ASC, f.id ASC
             LIMIT :limit OFFSET :offset"
        );
        $query->bindValue(':parent_id', $parentId, PDO::PARAM_INT);
        $query->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $query->bindValue(':offset', $offset, PDO::PARAM_INT);
        $query->execute();

        return [
            'rows' => $query->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'pages' => $pages,
        ];
    }

    public function publicKnowledgeTaxonomyExists(int $id): bool
    {
        $query = $this->db->prepare(
            "SELECT 1 FROM filters WHERE id = :id AND type = 'assunto' LIMIT 1"
        );
        $query->bindValue(':id', $id, PDO::PARAM_INT);
        $query->execute();

        return (bool) $query->fetchColumn();
    }

    /**
     * Verifica se o slug ja existe, ignorando um id opcional.
     *
     * @since 1.0.0
     */
    public function slugExists(string $type, string $slug, ?int $exceptId = null): bool
    {
        $query = 'SELECT id FROM filters WHERE type = :type AND slug = :slug';
        if ($exceptId !== null) {
            $query .= ' AND id != :id';
        }

        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':slug', $slug);
        if ($exceptId !== null) {
            $stmt->bindValue(':id', $exceptId, PDO::PARAM_INT);
        }
        $stmt->execute();

        return (bool) $stmt->fetch();
    }

    public function fetchById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT f.id, f.type, f.name, f.slug, f.acronym, f.parent_id, f.description, f.website,
                   f.asset_url, f.icon_key, f.keywords_json,
                   f.meta_materia, f.taxonomy_level, f.meta_carreira,
                   parent.name AS parent_name
            FROM filters f
            LEFT JOIN filters parent ON parent.id = f.parent_id
            WHERE f.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }
        $aliases = $this->fetchAliasesByFilterIds([$id]);
        $row['aliases'] = $aliases[$id] ?? [];
        $relationships = $this->fetchRelationshipsByFilterIds([$id]);
        $row['relationships'] = $relationships[$id] ?? [];
        $sourceIdentities = $this->fetchSourceIdentitiesByFilterIds([$id]);
        $row['sourceIdentities'] = $sourceIdentities[$id] ?? [];
        return $row;
    }

    /**
     * Localiza uma banca ou orgao pelo conjunto canonico nome/sigla/slug/alias.
     */
    public function findCanonicalMatch(string $type, string $name, string $slug, string $acronym): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, type, name, slug, acronym, parent_id, description, website,
                   asset_url, icon_key, keywords_json,
                   meta_materia, taxonomy_level, meta_carreira
            FROM filters
            WHERE type = :type
            ORDER BY id
        ");
        $stmt->execute([':type' => $type]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $aliasesByFilterId = $this->fetchAliasesByFilterIds(array_map(
            static fn (array $row): int => (int) $row['id'],
            $rows
        ));
        $requested = array_filter(array_unique([
            $this->normalizeLookupText($name),
            $this->normalizeLookupText($slug),
            $this->normalizeLookupText($acronym),
        ]));

        foreach ($rows as $row) {
            $aliases = $aliasesByFilterId[(int) $row['id']] ?? [];
            $candidate = array_filter(array_unique([
                $this->normalizeLookupText((string) ($row['name'] ?? '')),
                $this->normalizeLookupText((string) ($row['slug'] ?? '')),
                $this->normalizeLookupText((string) ($row['acronym'] ?? '')),
                ...array_map(fn (string $alias): string => $this->normalizeLookupText($alias), $aliases),
            ]));
            if (array_intersect($requested, $candidate) !== []) {
                $row['aliases'] = $aliases;
                return $row;
            }
        }

        return null;
    }

    public function acronymExists(string $type, string $acronym, ?int $exceptId = null): bool
    {
        if ($acronym === '') {
            return false;
        }
        $query = 'SELECT id FROM filters WHERE type = :type AND acronym = :acronym';
        if ($exceptId !== null) {
            $query .= ' AND id != :id';
        }
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':acronym', $acronym);
        if ($exceptId !== null) {
            $stmt->bindValue(':id', $exceptId, PDO::PARAM_INT);
        }
        $stmt->execute();
        return (bool) $stmt->fetch();
    }

    /**
     * Atualiza um filtro existente.
     *
     * @since 1.0.0
     */
    public function update(array $payload): void
    {
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $stmt = $this->db->prepare("
            UPDATE filters
            SET type = :type,
                name = :name,
                slug = :slug,
                acronym = :acronym,
                parent_id = :parent_id,
                description = :description,
                website = :website,
                asset_url = :asset_url,
                icon_key = :icon_key,
                keywords_json = :keywords_json,
                meta_materia = :meta_materia,
                taxonomy_level = :taxonomy_level,
                meta_carreira = :meta_carreira
            WHERE id = :id
            ");
            $stmt->execute([
            ':type' => $payload['type'],
            ':name' => $payload['name'],
            ':slug' => $payload['slug'],
            ':acronym' => $payload['acronym'],
            ':parent_id' => $payload['parent_id'],
            ':description' => $payload['description'],
            ':website' => $payload['website'],
            ':asset_url' => $payload['asset_url'],
            ':icon_key' => $payload['icon_key'],
            ':keywords_json' => $payload['keywords_json'],
            ':meta_materia' => $payload['meta_materia'],
            ':taxonomy_level' => $payload['taxonomy_level'],
            ':meta_carreira' => $payload['meta_carreira'],
            ':id' => $payload['id'],
            ]);
            $this->replaceAliases((int) $payload['id'], $payload['aliases']);
            if ($ownsTransaction) {
                $this->db->commit();
            }
            $this->invalidateUsageSummary();
        } catch (Throwable $exception) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Cria um filtro novo.
     *
     * @since 1.0.0
     */
    public function create(array $payload): int
    {
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $stmt = $this->db->prepare("
                INSERT INTO filters (
                    type, name, slug, acronym, parent_id, description, website,
                    asset_url, icon_key, keywords_json,
                    meta_materia, taxonomy_level, meta_carreira
                ) VALUES (
                    :type, :name, :slug, :acronym, :parent_id, :description, :website,
                    :asset_url, :icon_key, :keywords_json,
                    :meta_materia, :taxonomy_level, :meta_carreira
                )
            ");
            $stmt->execute([
            ':type' => $payload['type'],
            ':name' => $payload['name'],
            ':slug' => $payload['slug'],
            ':acronym' => $payload['acronym'],
            ':parent_id' => $payload['parent_id'],
            ':description' => $payload['description'],
            ':website' => $payload['website'],
            ':asset_url' => $payload['asset_url'],
            ':icon_key' => $payload['icon_key'],
            ':keywords_json' => $payload['keywords_json'],
            ':meta_materia' => $payload['meta_materia'],
            ':taxonomy_level' => $payload['taxonomy_level'],
            ':meta_carreira' => $payload['meta_carreira'],
            ]);
            $id = (int) $this->db->lastInsertId();
            $this->replaceAliases($id, $payload['aliases']);
            if ($ownsTransaction) {
                $this->db->commit();
            }
            $this->invalidateUsageSummary();
            return $id;
        } catch (Throwable $exception) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Exclui um filtro pelo id.
     *
     * @since 1.0.0
     */
    public function delete(int $id): void
    {
        $this->deleteMany([$id]);
    }

    /**
     * Exclui taxonomias sem vinculos em uma unica transacao.
     *
     * @param int[] $ids
     * @return int[] ids efetivamente removidos
     */
    public function deleteMany(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if ($ids === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $ownsTransaction = !$this->db->inTransaction();

        try {
            if ($ownsTransaction) {
                $this->db->beginTransaction();
            }

            $existingStatement = $this->db->prepare(
                "SELECT id FROM filters WHERE id IN ({$placeholders}) FOR UPDATE"
            );
            $existingStatement->execute($ids);
            $existingIds = array_map('intval', $existingStatement->fetchAll(PDO::FETCH_COLUMN));
            if ($existingIds === []) {
                throw new RuntimeException('As taxonomias selecionadas nao existem mais.', 409);
            }

            $usageByFilterId = $this->fetchUsageOverview($existingIds);
            $linkedIds = array_values(array_filter(
                $existingIds,
                static fn (int $id): bool => (int) ($usageByFilterId[$id]['total'] ?? 0) > 0
            ));
            if ($linkedIds !== []) {
                throw new RuntimeException(
                    count($linkedIds) . ' taxonomia(s) possuem vinculos com questoes, provas ou leis. Remova os vinculos antes de excluir.',
                    409
                );
            }

            $existingPlaceholders = implode(',', array_fill(0, count($existingIds), '?'));
            $childStatement = $this->db->prepare(
                "SELECT COUNT(*) FROM filters
                 WHERE parent_id IN ({$existingPlaceholders})
                   AND id NOT IN ({$existingPlaceholders})"
            );
            $childStatement->execute(array_merge($existingIds, $existingIds));
            if ((int) $childStatement->fetchColumn() > 0) {
                throw new RuntimeException(
                    'A selecao possui taxonomias com subitens nao selecionados. Exclua ou inclua os subitens primeiro.',
                    409
                );
            }

            $deleteStatement = $this->db->prepare(
                "DELETE FROM filters WHERE id IN ({$existingPlaceholders})"
            );
            $deleteStatement->execute($existingIds);

            if ($ownsTransaction) {
                $this->db->commit();
            }
            $this->invalidateUsageSummary();

            return $existingIds;
        } catch (Throwable $exception) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($exception instanceof PDOException && (string) $exception->getCode() === '23000') {
                throw new RuntimeException(
                    'Uma ou mais taxonomias ainda possuem vinculos protegidos. Remova os vinculos antes de excluir.',
                    409,
                    $exception
                );
            }
            throw $exception;
        }
    }

    private function fetchAliasesByFilterIds(array $filterIds): array
    {
        $filterIds = array_values(array_unique(array_filter(array_map('intval', $filterIds))));
        if ($filterIds === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($filterIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT filter_id, alias FROM filter_aliases
             WHERE filter_id IN ({$placeholders})
             ORDER BY alias"
        );
        $stmt->execute($filterIds);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $result[(int) $row['filter_id']][] = (string) $row['alias'];
        }
        return $result;
    }

    private function fetchRelationshipsByFilterIds(array $filterIds): array
    {
        $filterIds = array_values(array_unique(array_filter(array_map('intval', $filterIds))));
        if ($filterIds === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($filterIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT relationship.source_filter_id, relationship.relation_type,
                    relationship.source_provider, target.id AS target_id,
                    target.type AS target_type, target.name AS target_name,
                    target.slug AS target_slug, target.acronym AS target_acronym
             FROM filter_relationships relationship
             INNER JOIN filters target ON target.id = relationship.target_filter_id
             WHERE relationship.source_filter_id IN ({$placeholders})
             ORDER BY relationship.source_filter_id, relationship.relation_type, target.name, target.id"
        );
        $stmt->execute($filterIds);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $result[(int) $row['source_filter_id']][] = [
                'type' => (string) $row['relation_type'],
                'sourceProvider' => (string) $row['source_provider'],
                'target' => [
                    'id' => (int) $row['target_id'],
                    'type' => (string) $row['target_type'],
                    'name' => (string) $row['target_name'],
                    'slug' => (string) $row['target_slug'],
                    'acronym' => $row['target_acronym'] !== null ? (string) $row['target_acronym'] : null,
                ],
            ];
        }
        return $result;
    }

    private function fetchSourceIdentitiesByFilterIds(array $filterIds): array
    {
        $filterIds = array_values(array_unique(array_filter(array_map('intval', $filterIds))));
        if ($filterIds === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($filterIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT filter_id, filter_type, source_provider, source_entity_type,
                    source_external_id, source_parent_external_id, source_root_external_id,
                    source_metadata_json, updated_at
             FROM filter_source_identities
             WHERE filter_id IN ({$placeholders})
             ORDER BY filter_id, source_provider, source_entity_type, source_external_id"
        );
        $stmt->execute($filterIds);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $metadata = json_decode((string) ($row['source_metadata_json'] ?? ''), true);
            $result[(int) $row['filter_id']][] = [
                'filterType' => (string) $row['filter_type'],
                'provider' => (string) $row['source_provider'],
                'entityType' => (string) $row['source_entity_type'],
                'externalId' => (string) $row['source_external_id'],
                'parentExternalId' => $row['source_parent_external_id'] !== null
                    ? (string) $row['source_parent_external_id']
                    : null,
                'rootExternalId' => $row['source_root_external_id'] !== null
                    ? (string) $row['source_root_external_id']
                    : null,
                'metadata' => is_array($metadata) ? $metadata : [],
                'updatedAt' => (string) $row['updated_at'],
            ];
        }
        return $result;
    }

    private function mergeUsageRows(array &$usageByFilterId, array $rows, string $field): void
    {
        foreach ($rows as $row) {
            $filterId = (int) ($row['filter_id'] ?? 0);
            if ($filterId <= 0) {
                continue;
            }
            if (!isset($usageByFilterId[$filterId])) {
                $usageByFilterId[$filterId] = [
                    'questions' => 0,
                    'exams' => 0,
                    'laws' => 0,
                    'total' => 0,
                ];
            }
            $usageByFilterId[$filterId][$field] = (int) ($row['usage_count'] ?? 0);
        }
    }

    private function fetchUsageRows(string $sql, array $filterIds): array
    {
        if ($filterIds === []) {
            return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        }
        $statement = $this->db->prepare($sql);
        $statement->execute($filterIds);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    private function buildPageWhereClause(string $uiType, string $search): array
    {
        $conditions = [];
        $params = [];
        $uiType = strtolower(trim($uiType));
        if ($uiType !== '' && $uiType !== 'all') {
            switch ($uiType) {
                case 'materia':
                    $conditions[] = "f.type = 'assunto' AND (f.meta_materia = 1 OR f.taxonomy_level = 'materia')";
                    break;
                case 'topico':
                    $conditions[] = "f.type = 'assunto' AND f.meta_materia = 0 AND f.taxonomy_level = 'topico'";
                    break;
                case 'assunto':
                    $conditions[] = "f.type = 'assunto' AND f.meta_materia = 0 AND (f.taxonomy_level IS NULL OR f.taxonomy_level NOT IN ('materia', 'topico'))";
                    break;
                default:
                    $conditions[] = 'f.type = :type';
                    $params[':type'] = $uiType;
                    break;
            }
        }

        $search = trim($search);
        if ($search !== '') {
            $escapedSearch = '%' . addcslashes($search, '%_\\') . '%';
            $params[':search_name'] = $escapedSearch;
            $params[':search_slug'] = $escapedSearch;
            $params[':search_acronym'] = $escapedSearch;
            $params[':search_alias'] = $escapedSearch;
            $conditions[] = "(
                f.name LIKE :search_name ESCAPE '\\\\'
                OR f.slug LIKE :search_slug ESCAPE '\\\\'
                OR f.acronym LIKE :search_acronym ESCAPE '\\\\'
                OR EXISTS (
                    SELECT 1 FROM filter_aliases alias
                    WHERE alias.filter_id = f.id AND alias.alias LIKE :search_alias ESCAPE '\\\\'
                )
            )";
        }

        return [$conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions), $params];
    }

    private function emptyUsageSummary(): array
    {
        $types = ['banca', 'orgao', 'cargo', 'materia', 'topico', 'assunto', 'ano', 'carreira', 'area'];
        $empty = [
            'taxonomies' => 0,
            'questions' => 0,
            'exams' => 0,
            'laws' => 0,
            'total' => 0,
        ];
        return [
            'all' => $empty,
            'byType' => array_fill_keys($types, $empty),
        ];
    }

    private function mergeUsageSummaryRows(array &$summary, array $rows, string $field): void
    {
        foreach ($rows as $row) {
            $type = $this->resolveUsageType($row);
            $this->ensureUsageSummaryType($summary, $type);
            $count = (int) ($row['usage_count'] ?? 0);
            $summary['byType'][$type][$field] += $count;
            $summary['all'][$field] += $count;
        }
    }

    private function ensureUsageSummaryType(array &$summary, string $type): void
    {
        if (isset($summary['byType'][$type])) {
            return;
        }

        $summary['byType'][$type] = [
            'taxonomies' => 0,
            'questions' => 0,
            'exams' => 0,
            'laws' => 0,
            'total' => 0,
        ];
    }

    private function resolveUsageType(array $row): string
    {
        if (($row['type'] ?? '') !== 'assunto') {
            return (string) ($row['type'] ?? '');
        }
        if (!empty($row['meta_materia']) || ($row['taxonomy_level'] ?? '') === 'materia') {
            return 'materia';
        }
        return ($row['taxonomy_level'] ?? '') === 'topico' ? 'topico' : 'assunto';
    }

    private function invalidateUsageSummary(): void
    {
        RuntimeStoreFactory::shared()->delete('filters:admin:usage-summary:v1');
    }

    private function replaceAliases(int $filterId, array $aliases): void
    {
        $delete = $this->db->prepare('DELETE FROM filter_aliases WHERE filter_id = :filter_id');
        $delete->execute([':filter_id' => $filterId]);
        if ($aliases === []) {
            return;
        }
        $insert = $this->db->prepare(
            'INSERT INTO filter_aliases (filter_id, alias, normalized_alias)
             VALUES (:filter_id, :alias, :normalized_alias)'
        );
        $normalizedAliases = [];
        foreach ($aliases as $alias) {
            $alias = trim((string) $alias);
            $normalizedAlias = $this->normalizeLookupText($alias);
            if ($alias === '' || $normalizedAlias === '' || isset($normalizedAliases[$normalizedAlias])) {
                continue;
            }
            $normalizedAliases[$normalizedAlias] = true;
            $insert->execute([
                ':filter_id' => $filterId,
                ':alias' => $alias,
                ':normalized_alias' => $normalizedAlias,
            ]);
        }
    }

    private function normalizeLookupText(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $transliterated !== false ? $transliterated : $value;
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $value));
    }
}
