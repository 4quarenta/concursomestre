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
    public const PUBLIC_DISCIPLINE_QUERY_BUDGET = 6;
    public const PUBLIC_KNOWLEDGE_TAXONOMY_QUERY_BUDGET = 6;
    public const PUBLIC_ORGANIZATION_QUERY_BUDGET = 7;

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
        $isOrganization = $directoryType === 'organizations';
        $taxonomyClause = match ($directoryType) {
            'subjects' => "f.type = 'assunto' AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1)",
            'organizations' => "f.type = 'orgao' AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')",
            default => "f.type = 'banca'",
        };
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
        $questionJoin = $isOrganization ? 'LEFT JOIN' : 'INNER JOIN';

        $count = $this->db->prepare(
            "SELECT COUNT(*)
             FROM (
                SELECT f.id
                FROM filters f
                {$questionJoin} question_filters qf ON qf.filter_id = f.id
                {$questionJoin} questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
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
             {$questionJoin} question_filters qf ON qf.filter_id = f.id
             {$questionJoin} questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
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
     * Carrega o perfil publico de um orgao em sete consultas constantes.
     * Nenhuma consulta depende da quantidade de cards retornados.
     *
     * @return array<string, mixed>|null
     */
    public function fetchPublicOrganizationProjectionData(
        string $slug,
        int $questionLimit = 10,
        int $examLimit = 8,
        int $roleLimit = 12,
        int $disciplineLimit = 10,
        int $boardLimit = 8
    ): ?array {
        $publishedQuestionClause = "q.publish_status IN ('published', 'scheduled')
            AND q.visibility_status = 'public'
            AND q.published_sort_at IS NOT NULL
            AND q.published_sort_at <= NOW()";
        $publicExamClause = "p.archived_at IS NULL
            AND p.status_editorial = 'published'
            AND p.visibility_status = 'public'
            AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())";

        $identityStmt = $this->db->prepare(
            "SELECT f.id, f.type, f.taxonomy_level, f.slug, f.name, f.acronym,
                    f.description, f.website, f.asset_url, f.meta_uf, f.meta_esfera,
                    (SELECT COUNT(DISTINCT q.id)
                       FROM question_filters qf
                       INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                      WHERE qf.filter_id = f.id) AS question_count,
                    (SELECT COUNT(DISTINCT p.id)
                       FROM prova_filters pf
                       INNER JOIN provas p ON p.id = pf.prova_id AND {$publicExamClause}
                      WHERE pf.filter_id = f.id) AS exam_count,
                    (SELECT MAX(q.updated_at)
                       FROM question_filters qf
                       INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                      WHERE qf.filter_id = f.id) AS content_updated_at
               FROM filters f
              WHERE f.type = 'orgao'
                AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                AND f.slug = :slug
              LIMIT 1"
        );
        $identityStmt->execute([':slug' => $slug]);
        $identity = $identityStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($identity)) {
            return null;
        }
        $organizationId = (int) $identity['id'];

        $questionsStmt = $this->db->prepare(
            "SELECT q.id, LEFT(TRIM(COALESCE(NULLIF(q.enunciado_clean, ''), q.enunciado)), 320) AS excerpt,
                    q.updated_at AS updatedAt
               FROM question_filters qf
               INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
              WHERE qf.filter_id = :organization_id
              ORDER BY q.published_sort_at DESC, q.id DESC
              LIMIT :limit"
        );
        $questionsStmt->bindValue(':organization_id', $organizationId, PDO::PARAM_INT);
        $questionsStmt->bindValue(':limit', max(1, $questionLimit), PDO::PARAM_INT);
        $questionsStmt->execute();

        $examsStmt = $this->db->prepare(
            "SELECT p.id, p.slug, p.nome AS name, p.ano AS year, COUNT(DISTINCT qp.question_id) AS questionCount
               FROM prova_filters pf
               INNER JOIN provas p ON p.id = pf.prova_id AND {$publicExamClause}
               LEFT JOIN question_provas qp ON qp.prova_id = p.id
              WHERE pf.filter_id = :organization_id
                AND COALESCE(p.slug, '') <> ''
              GROUP BY p.id, p.slug, p.nome, p.ano
              ORDER BY COALESCE(p.ano, 0) DESC, p.id DESC
              LIMIT :limit"
        );
        $examsStmt->bindValue(':organization_id', $organizationId, PDO::PARAM_INT);
        $examsStmt->bindValue(':limit', max(1, $examLimit), PDO::PARAM_INT);
        $examsStmt->execute();

        $rolesStmt = $this->db->prepare(
            "SELECT cargo.id, cargo.slug, cargo.name
               FROM filter_relationships relationship
               INNER JOIN filters cargo ON cargo.id = relationship.source_filter_id AND cargo.type = 'cargo'
              WHERE relationship.target_filter_id = :organization_id
                AND relationship.relation_type = 'cargo_organization'
                AND COALESCE(cargo.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                AND TRIM(cargo.name) <> ''
                AND BINARY cargo.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
              GROUP BY cargo.id, cargo.slug, cargo.name
              ORDER BY cargo.name ASC
              LIMIT :limit"
        );
        $rolesStmt->bindValue(':organization_id', $organizationId, PDO::PARAM_INT);
        $rolesStmt->bindValue(':limit', max(1, $roleLimit), PDO::PARAM_INT);
        $rolesStmt->execute();

        $disciplinesStmt = $this->db->prepare(
            "SELECT discipline.id, discipline.slug, discipline.name,
                    COUNT(DISTINCT q.id) AS questionCount
               FROM question_filters qf_organization
               INNER JOIN questions q ON q.id = qf_organization.question_id AND {$publishedQuestionClause}
               INNER JOIN question_filters qf_discipline ON qf_discipline.question_id = q.id
               INNER JOIN filters discipline ON discipline.id = qf_discipline.filter_id
                    AND discipline.type = 'assunto'
                    AND (discipline.taxonomy_level = 'materia' OR discipline.meta_materia = 1)
                    AND COALESCE(discipline.taxonomy_level, '') <> 'pending'
              WHERE qf_organization.filter_id = :organization_id
                AND COALESCE(discipline.slug, '') <> ''
              GROUP BY discipline.id, discipline.slug, discipline.name
              ORDER BY questionCount DESC, discipline.name ASC
              LIMIT :limit"
        );
        $disciplinesStmt->bindValue(':organization_id', $organizationId, PDO::PARAM_INT);
        $disciplinesStmt->bindValue(':limit', max(1, $disciplineLimit), PDO::PARAM_INT);
        $disciplinesStmt->execute();

        $boardsStmt = $this->db->prepare(
            "SELECT board.id, board.slug, board.name, board.acronym,
                    COUNT(DISTINCT p.id) AS examCount
               FROM prova_filters pf_organization
               INNER JOIN provas p ON p.id = pf_organization.prova_id AND {$publicExamClause}
               INNER JOIN prova_filters pf_board ON pf_board.prova_id = p.id
               INNER JOIN filters board ON board.id = pf_board.filter_id AND board.type = 'banca'
              WHERE pf_organization.filter_id = :organization_id
                AND COALESCE(board.slug, '') <> ''
              GROUP BY board.id, board.slug, board.name, board.acronym
              ORDER BY examCount DESC, board.name ASC
              LIMIT :limit"
        );
        $boardsStmt->bindValue(':organization_id', $organizationId, PDO::PARAM_INT);
        $boardsStmt->bindValue(':limit', max(1, $boardLimit), PDO::PARAM_INT);
        $boardsStmt->execute();

        $contestsStmt = $this->db->prepare(
            "SELECT c.id, c.slug, c.title, c.domain_status AS status, c.year
               FROM contest_organizations co
               INNER JOIN contests c ON c.id = co.contest_id
              WHERE co.organization_filter_id = :organization_id
                AND c.publication_status = 'published'
                AND c.visibility_status = 'public'
                AND c.archived_at IS NULL
                AND (c.scheduled_at IS NULL OR c.scheduled_at <= NOW())
                AND BINARY c.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
              ORDER BY COALESCE(c.registration_end_at, c.updated_at) DESC, c.id DESC
              LIMIT 8"
        );
        $contestsStmt->execute([':organization_id' => $organizationId]);

        return [
            'identity' => $identity,
            'questions' => $questionsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'exams' => $examsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'roles' => $rolesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'disciplines' => $disciplinesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'boards' => $boardsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'contests' => $contestsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
        ];
    }

    /**
     * Dados sanitizados e limitados do piloto. Executa no maximo cinco consultas
     * constantes; nao existe consulta por topico, prova, banca ou questao.
     *
     * @return array<string, mixed>|null
     */
    public function fetchPublicDisciplineProjectionData(
        string $slug,
        int $topicLimit = 12,
        int $examLimit = 8,
        int $boardLimit = 8,
        int $questionLimit = 10
    ): ?array {
        return $this->fetchPublicKnowledgeTaxonomyProjectionData(
            $slug,
            'materia',
            $topicLimit,
            $examLimit,
            $boardLimit,
            $questionLimit
        );
    }

    /**
     * Carrega uma taxonomia publica e suas relacoes em seis consultas
     * constantes. O nivel esperado faz parte da identidade da rota.
     *
     * @return array<string, mixed>|null
     */
    public function fetchPublicKnowledgeTaxonomyProjectionData(
        string $slug,
        string $level,
        int $childLimit = 40,
        int $examLimit = 8,
        int $boardLimit = 8,
        int $questionLimit = 10
    ): ?array {
        if (!in_array($level, ['materia', 'topico', 'assunto'], true)) {
            throw new InvalidArgumentException('Nivel publico de taxonomia invalido.');
        }
        $publishedQuestionClause = "q.publish_status IN ('published', 'scheduled')
            AND q.visibility_status = 'public'
            AND q.published_sort_at IS NOT NULL
            AND q.published_sort_at <= NOW()";
        $publicExamClause = "p.archived_at IS NULL
            AND p.status_editorial = 'published'
            AND p.visibility_status = 'public'
            AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())";

        $identity = $this->fetchPublicKnowledgeIdentity($slug, $level, $publishedQuestionClause);
        if ($identity === null) return null;
        $taxonomyId = (int) $identity['id'];

        $childrenSql = $level === 'materia'
            ? "SELECT child.id, child.type, child.meta_materia, child.slug, child.name, child.taxonomy_level,
                      child.parent_id, NULL AS parent_name,
                      COUNT(DISTINCT q.id) AS questionCount
                 FROM filters child
                 LEFT JOIN question_filters qf ON qf.filter_id = child.id
                 LEFT JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                WHERE child.type = 'assunto' AND child.taxonomy_level = 'topico'
                  AND child.parent_id = :taxonomy_id
                GROUP BY child.id, child.type, child.meta_materia, child.slug, child.name, child.taxonomy_level, child.parent_id
                ORDER BY child.name ASC, child.id ASC LIMIT :limit"
            : ($level === 'topico'
                ? "SELECT child.id, child.type, child.meta_materia, child.slug, child.name, child.taxonomy_level,
                          child.parent_id, child.parent_name, child.parent_slug,
                          COUNT(DISTINCT q.id) AS questionCount
                     FROM (
                         SELECT direct.id, direct.type, direct.meta_materia, direct.slug, direct.name, direct.taxonomy_level,
                                direct.parent_id, parent.name AS parent_name, parent.slug AS parent_slug
                           FROM filters direct
                           LEFT JOIN filters parent ON parent.id = direct.parent_id
                          WHERE direct.type = 'assunto'
                            AND direct.parent_id = :taxonomy_id_direct
                            AND direct.taxonomy_level IN ('subtopico', 'assunto')
                         UNION ALL
                         SELECT nested.id, nested.type, nested.meta_materia, nested.slug, nested.name, nested.taxonomy_level,
                                nested.parent_id, subtopic.name AS parent_name, subtopic.slug AS parent_slug
                           FROM filters subtopic
                           INNER JOIN filters nested ON nested.parent_id = subtopic.id
                                AND nested.type = 'assunto' AND nested.taxonomy_level = 'assunto'
                          WHERE subtopic.type = 'assunto'
                            AND subtopic.taxonomy_level = 'subtopico'
                            AND subtopic.parent_id = :taxonomy_id_nested
                     ) child
                     LEFT JOIN question_filters qf ON qf.filter_id = child.id
                     LEFT JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                    GROUP BY child.id, child.type, child.meta_materia, child.slug, child.name, child.taxonomy_level, child.parent_id, child.parent_name, child.parent_slug
                    ORDER BY COALESCE(child.parent_name, child.name), child.taxonomy_level DESC, child.name, child.id
                    LIMIT :limit"
                : "SELECT child.id, child.type, child.meta_materia, child.slug, child.name, child.taxonomy_level,
                          child.parent_id, NULL AS parent_name, NULL AS parent_slug, 0 AS questionCount
                     FROM filters child WHERE 1 = 0 LIMIT :limit");
        $childrenStmt = $this->db->prepare($childrenSql);
        if ($level === 'materia') {
            $childrenStmt->bindValue(':taxonomy_id', $taxonomyId, PDO::PARAM_INT);
        } elseif ($level === 'topico') {
            $childrenStmt->bindValue(':taxonomy_id_direct', $taxonomyId, PDO::PARAM_INT);
            $childrenStmt->bindValue(':taxonomy_id_nested', $taxonomyId, PDO::PARAM_INT);
        }
        $childrenStmt->bindValue(':limit', max(1, $childLimit), PDO::PARAM_INT);
        $childrenStmt->execute();

        $examsStmt = $this->db->prepare(
            "SELECT p.id, p.slug, p.nome AS name, p.ano AS year, COUNT(DISTINCT q.id) AS questionCount
               FROM question_filters qf
               INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
               INNER JOIN question_provas qp ON qp.question_id = q.id
               INNER JOIN provas p ON p.id = qp.prova_id AND {$publicExamClause}
              WHERE qf.filter_id = :taxonomy_id
                AND COALESCE(p.slug, '') <> ''
              GROUP BY p.id, p.slug, p.nome, p.ano
              ORDER BY COALESCE(p.ano, 0) DESC, questionCount DESC, p.id DESC
              LIMIT :limit"
        );
        $examsStmt->bindValue(':taxonomy_id', $taxonomyId, PDO::PARAM_INT);
        $examsStmt->bindValue(':limit', max(1, $examLimit), PDO::PARAM_INT);
        $examsStmt->execute();

        $boardsStmt = $this->db->prepare(
            "SELECT board.id, board.slug, board.name, board.acronym, COUNT(DISTINCT q.id) AS questionCount
               FROM question_filters qf_taxonomy
               INNER JOIN questions q ON q.id = qf_taxonomy.question_id AND {$publishedQuestionClause}
               INNER JOIN question_filters qf_board ON qf_board.question_id = q.id
               INNER JOIN filters board ON board.id = qf_board.filter_id AND board.type = 'banca'
              WHERE qf_taxonomy.filter_id = :taxonomy_id
                AND COALESCE(board.slug, '') <> ''
              GROUP BY board.id, board.slug, board.name, board.acronym
              ORDER BY questionCount DESC, board.name ASC
              LIMIT :limit"
        );
        $boardsStmt->bindValue(':taxonomy_id', $taxonomyId, PDO::PARAM_INT);
        $boardsStmt->bindValue(':limit', max(1, $boardLimit), PDO::PARAM_INT);
        $boardsStmt->execute();

        $questionsStmt = $this->db->prepare(
            "SELECT q.id, LEFT(TRIM(COALESCE(NULLIF(q.enunciado_clean, ''), q.enunciado)), 320) AS excerpt,
                    q.updated_at AS updatedAt
               FROM question_filters qf
               INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
              WHERE qf.filter_id = :taxonomy_id
              ORDER BY q.published_sort_at DESC, q.id DESC
              LIMIT :limit"
        );
        $questionsStmt->bindValue(':taxonomy_id', $taxonomyId, PDO::PARAM_INT);
        $questionsStmt->bindValue(':limit', max(1, $questionLimit), PDO::PARAM_INT);
        $questionsStmt->execute();

        $organizationsStmt = $this->db->prepare(
            "SELECT organization.id, organization.slug, organization.name, organization.acronym,
                    COUNT(DISTINCT q.id) AS questionCount
               FROM question_filters qf_taxonomy
               INNER JOIN questions q ON q.id = qf_taxonomy.question_id AND {$publishedQuestionClause}
               INNER JOIN question_filters qf_organization ON qf_organization.question_id = q.id
               INNER JOIN filters organization ON organization.id = qf_organization.filter_id
                    AND organization.type = 'orgao'
                    AND COALESCE(organization.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
              WHERE qf_taxonomy.filter_id = :taxonomy_id
                AND COALESCE(organization.slug, '') <> ''
              GROUP BY organization.id, organization.slug, organization.name, organization.acronym
              ORDER BY questionCount DESC, organization.name ASC
              LIMIT :limit"
        );
        $organizationsStmt->bindValue(':taxonomy_id', $taxonomyId, PDO::PARAM_INT);
        $organizationsStmt->bindValue(':limit', max(1, $boardLimit), PDO::PARAM_INT);
        $organizationsStmt->execute();

        return [
            'identity' => $identity,
            'children' => $childrenStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'exams' => $examsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'boards' => $boardsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'organizations' => $organizationsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'questions' => $questionsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
        ];
    }

    /** @return array<string, mixed>|null */
    private function fetchPublicKnowledgeIdentity(string $requestedSlug, string $level, string $publishedQuestionClause): ?array
    {
        $identity = $this->fetchPublicKnowledgeIdentityWhere('f.slug = :identity', [':identity' => $requestedSlug], $level, $publishedQuestionClause);
        if ($identity !== null) {
            $identity['requested_slug'] = $requestedSlug;
            $identity['alias_resolved'] = false;
            return $identity;
        }

        $canonicalConflict = $this->db->prepare("SELECT id FROM filters WHERE type = 'assunto' AND slug = :slug LIMIT 1");
        $canonicalConflict->execute([':slug' => $requestedSlug]);
        if ($canonicalConflict->fetchColumn()) return null;

        $levelClause = $this->publicKnowledgeLevelClause('f', $level);
        $aliasStmt = $this->db->prepare(
            "SELECT DISTINCT f.id
               FROM filter_aliases alias
               INNER JOIN filters f ON f.id = alias.filter_id
              WHERE f.type = 'assunto' AND {$levelClause}
                AND (alias.alias = :alias OR alias.normalized_alias = :normalized)
              LIMIT 2"
        );
        $aliasStmt->execute([':alias' => $requestedSlug, ':normalized' => $requestedSlug]);
        $ids = array_values(array_unique(array_map('intval', $aliasStmt->fetchAll(PDO::FETCH_COLUMN) ?: [])));
        if (count($ids) !== 1) return null;

        $identity = $this->fetchPublicKnowledgeIdentityWhere('f.id = :identity', [':identity' => $ids[0]], $level, $publishedQuestionClause);
        if ($identity === null) return null;
        $identity['requested_slug'] = $requestedSlug;
        $identity['alias_resolved'] = true;
        return $identity;
    }

    /** @param array<string, scalar> $params @return array<string, mixed>|null */
    private function fetchPublicKnowledgeIdentityWhere(string $identityWhere, array $params, string $level, string $publishedQuestionClause): ?array
    {
        $levelClause = $this->publicKnowledgeLevelClause('f', $level);
        $stmt = $this->db->prepare(
            "SELECT f.id, f.type, f.parent_id AS own_parent_id, f.taxonomy_level, f.meta_materia,
                    f.slug, f.name, f.description,
                    parent.id AS parent_id, parent.parent_id AS parent_parent_id,
                    parent.type AS parent_type, parent.taxonomy_level AS parent_taxonomy_level,
                    parent.meta_materia AS parent_meta_materia, parent.slug AS parent_slug, parent.name AS parent_name,
                    grandparent.id AS grandparent_id, grandparent.parent_id AS grandparent_parent_id,
                    grandparent.type AS grandparent_type, grandparent.taxonomy_level AS grandparent_taxonomy_level,
                    grandparent.meta_materia AS grandparent_meta_materia, grandparent.slug AS grandparent_slug, grandparent.name AS grandparent_name,
                    great_grandparent.id AS great_grandparent_id, great_grandparent.parent_id AS great_grandparent_parent_id,
                    great_grandparent.type AS great_grandparent_type,
                    great_grandparent.taxonomy_level AS great_grandparent_taxonomy_level,
                    great_grandparent.meta_materia AS great_grandparent_meta_materia,
                    great_grandparent.slug AS great_grandparent_slug, great_grandparent.name AS great_grandparent_name,
                    (SELECT COUNT(DISTINCT q.id)
                       FROM question_filters qf
                       INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                      WHERE qf.filter_id = f.id) AS question_count,
                    (SELECT MAX(q.updated_at)
                       FROM question_filters qf
                       INNER JOIN questions q ON q.id = qf.question_id AND {$publishedQuestionClause}
                      WHERE qf.filter_id = f.id) AS content_updated_at
               FROM filters f
               LEFT JOIN filters parent ON parent.id = f.parent_id
               LEFT JOIN filters grandparent ON grandparent.id = parent.parent_id
               LEFT JOIN filters great_grandparent ON great_grandparent.id = grandparent.parent_id
              WHERE f.type = 'assunto' AND {$levelClause} AND {$identityWhere}
              LIMIT 1"
        );
        $stmt->execute($params);
        $identity = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($identity) ? $identity : null;
    }

    private function publicKnowledgeLevelClause(string $alias, string $level): string
    {
        return match ($level) {
            'materia' => "({$alias}.taxonomy_level = 'materia' OR {$alias}.meta_materia = 1)",
            'topico' => "{$alias}.taxonomy_level = 'topico' AND COALESCE({$alias}.meta_materia, 0) = 0",
            'assunto' => "{$alias}.taxonomy_level = 'assunto' AND COALESCE({$alias}.meta_materia, 0) = 0",
            default => throw new InvalidArgumentException('Nivel publico de taxonomia invalido.'),
        };
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
