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

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';
require_once __DIR__ . '/../../seo/sitemaps/StaticSitemapMutationInvalidator.php';

class ExamsRepository
{
    private PDO $db;
    private bool $schemaChecked = false;

    private const FILTER_KEY_MAP = [
        'banca' => ['banca_id', 'bancaId', 'banca', 'bancas'],
        'orgao' => ['orgao_id', 'orgaoId', 'orgao', 'orgaos'],
        'cargo' => ['cargo_id', 'cargoId', 'cargo', 'cargos', 'roles'],
        'nivel' => ['nivel_id', 'nivelId', 'nivel', 'niveis'],
        'tipo_prova' => ['tipo_prova_id', 'tipoProvaId', 'tipoProva', 'tiposProva', 'examType'],
        'carreira' => ['carreira_id', 'carreiraId', 'carreira', 'carreiras'],
        'area' => ['area_id', 'areaId', 'area', 'areas'],
        'ano' => ['ano_filter_id', 'anoFilterId', 'anos'],
        'modalidade' => ['modalidade_id', 'modalidadeId', 'modalidade', 'modalidades'],
        'assunto' => ['assunto_id', 'assuntoId', 'assunto', 'assuntos'],
    ];

    private const CONTENT_FILTER_TYPES = ['materia', 'disciplina', 'topico', 'subtopico', 'assunto'];

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function ensureSchema(): void
    {
        if ($this->schemaChecked) {
            return;
        }
        $this->schemaChecked = true;
        SchemaReadiness::assertTablesAndColumns($this->db, 'banco de provas', [
            'provas' => [
                'id', 'nome', 'slug', 'ano', 'banca_id', 'orgao_id', 'cargo_id', 'nivel_id', 'tipo_prova_id',
                'carreira_id', 'metadata_json', 'status_editorial', 'visibility_status', 'scheduled_at',
            ],
            'prova_filters' => ['prova_id', 'filter_id', 'role'],
            'prova_cargo_detalhes' => ['prova_id', 'cargo_filter_id', 'nome', 'metadata_json'],
            'prova_cargo_requisitos' => ['prova_id', 'cargo_detalhe_id', 'requisito', 'ordem'],
            'prova_cargo_vagas' => ['prova_id', 'cargo_detalhe_id', 'ampla', 'pcd', 'cotas', 'cadastro_reserva'],
            'prova_cadernos' => ['id', 'prova_id', 'nome', 'tipo', 'cor', 'metadata_json'],
            'prova_caderno_cargos' => ['caderno_id', 'cargo_filter_id'],
            'prova_caderno_filters' => ['caderno_id', 'filter_id', 'role'],
            'prova_arquivos' => ['prova_id', 'tipo', 'nome_original', 'caminho', 'metadata_json'],
            'question_provas' => ['question_id', 'prova_id', 'numero_na_prova'],
            'prova_extracoes' => ['prova_id', 'origem', 'status', 'extracted_json'],
        ]);
    }

    public function list(array $filters = []): array
    {
        $this->ensureSchema();
        $search = trim((string) ($filters['search'] ?? ''));
        $includeArchived = filter_var($filters['include_archived'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $params = [];
        $where = [];
        $limit = max(1, min(101, (int) ($filters['limit'] ?? 31)));

        if (!$includeArchived) {
            $where[] = 'p.archived_at IS NULL';
        }

        if ($search !== '') {
            $where[] = '(p.nome LIKE :search OR p.titulo_oficial LIKE :search OR p.nome_curto LIKE :search OR p.slug LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $cursor = is_array($filters['cursor_data'] ?? null) ? $filters['cursor_data'] : null;
        if ($cursor !== null) {
            $where[] = '(
                COALESCE(p.ano, 0) < :cursor_year
                OR (COALESCE(p.ano, 0) = :cursor_year AND p.nome > :cursor_name)
                OR (COALESCE(p.ano, 0) = :cursor_year AND p.nome = :cursor_name AND p.id < :cursor_id)
            )';
            $params[':cursor_year'] = (int) ($cursor['year'] ?? 0);
            $params[':cursor_name'] = (string) ($cursor['name'] ?? '');
            $params[':cursor_id'] = (int) ($cursor['id'] ?? 0);
        }

        $query = "SELECT p.*, COUNT(DISTINCT qp.question_id) AS question_count
            FROM provas p
            LEFT JOIN question_provas qp ON qp.prova_id = p.id";
        if ($where) {
            $query .= ' WHERE ' . implode(' AND ', $where);
        }
        $query .= ' GROUP BY p.id ORDER BY COALESCE(p.ano, 0) DESC, p.nome ASC, p.id DESC LIMIT ' . $limit;

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $this->hydrateMany($rows);
    }

    /**
     * Retorna somente os campos publicos usados pelo diretorio editorial.
     */
    public function listPublicDirectory(array $options): array
    {
        $this->ensureSchema();
        $limit = max(1, min(48, (int) ($options['limit'] ?? 12)));
        $offset = max(0, (int) ($options['offset'] ?? 0));
        $year = (int) ($options['year'] ?? 0);
        $stateCodes = array_values(array_unique(array_filter(array_map(
            static fn (mixed $value): string => strtoupper(trim((string) $value)),
            is_array($options['state_codes'] ?? null) ? $options['state_codes'] : []
        ), static fn (string $value): bool => preg_match('/^[A-Z]{2}$/', $value) === 1)));
        $where = [
            'p.archived_at IS NULL',
            "p.status_editorial = 'published'",
            "p.visibility_status = 'public'",
            '(p.scheduled_at IS NULL OR p.scheduled_at <= NOW())',
        ];
        $params = [];
        if ($year >= 1900 && $year <= 2200) {
            $where[] = 'p.ano = :directory_year';
            $params[':directory_year'] = $year;
        }
        if ($stateCodes !== []) {
            $placeholders = [];
            foreach ($stateCodes as $index => $stateCode) {
                $placeholder = ':directory_state_' . $index;
                $placeholders[] = $placeholder;
                $params[$placeholder] = $stateCode;
            }
            $where[] = "EXISTS (
                SELECT 1
                FROM prova_filters pf_location
                INNER JOIN filters f_location ON f_location.id = pf_location.filter_id
                WHERE pf_location.prova_id = p.id
                  AND f_location.type = 'orgao'
                  AND UPPER(f_location.meta_uf) IN (" . implode(', ', $placeholders) . ')
            )';
        }
        $whereSql = implode(' AND ', $where);
        $query = "SELECT
                p.id,
                p.nome,
                p.slug,
                p.ano,
                COUNT(DISTINCT qp.question_id) AS question_count,
                GROUP_CONCAT(DISTINCT CASE WHEN f.type = 'orgao' THEN f.name END ORDER BY f.name SEPARATOR '||') AS organization_names,
                GROUP_CONCAT(DISTINCT CASE WHEN f.type = 'orgao' THEN f.acronym END ORDER BY f.acronym SEPARATOR '||') AS organization_acronyms,
                MAX(CASE WHEN f.type = 'orgao' THEN f.meta_uf END) AS state_code,
                MAX(CASE WHEN f.type = 'banca' THEN COALESCE(NULLIF(f.acronym, ''), f.name) END) AS board_name,
                MAX(CASE WHEN f.type = 'banca' THEN f.slug END) AS board_slug,
                MAX(CASE WHEN pa.tipo = 'prova' THEN pa.caminho END) AS proof_url,
                MAX(CASE WHEN pa.tipo = 'gabarito' THEN pa.caminho END) AS answer_key_url
            FROM provas p
            LEFT JOIN question_provas qp ON qp.prova_id = p.id
            LEFT JOIN prova_filters pf ON pf.prova_id = p.id
            LEFT JOIN filters f ON f.id = pf.filter_id
            LEFT JOIN prova_arquivos pa ON pa.prova_id = p.id
                AND pa.archived_at IS NULL
                AND pa.visibility_status = 'public'
            WHERE {$whereSql}
            GROUP BY p.id, p.nome, p.slug, p.ano
            ORDER BY COALESCE(p.ano, 0) DESC, p.id DESC
            LIMIT {$limit} OFFSET {$offset}";

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM provas p WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $publicWhere = "p.archived_at IS NULL
            AND p.status_editorial = 'published'
            AND p.visibility_status = 'public'
            AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())";
        $years = $this->db->query("SELECT DISTINCT p.ano
            FROM provas p
            WHERE {$publicWhere} AND p.ano IS NOT NULL
            ORDER BY p.ano DESC")->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $states = $this->db->query("SELECT DISTINCT UPPER(f.meta_uf) AS state_code
            FROM provas p
            INNER JOIN prova_filters pf ON pf.prova_id = p.id
            INNER JOIN filters f ON f.id = pf.filter_id AND f.type = 'orgao'
            WHERE {$publicWhere}
              AND f.meta_uf IS NOT NULL
              AND f.meta_uf <> ''
            ORDER BY state_code")->fetchAll(PDO::FETCH_COLUMN) ?: [];

        return [
            'rows' => $rows,
            'total' => $total,
            'years' => array_map('intval', $years),
            'states' => array_values(array_map('strval', $states)),
        ];
    }

    public function listRelatedPublic(
        int $examId,
        int $year,
        array $taxonomyIds,
        int $limit = 6
    ): array {
        $this->ensureSchema();
        $limit = max(1, min(12, $limit));
        $taxonomyIds = array_slice(array_values(array_unique(array_filter(array_map(
            'intval',
            $taxonomyIds
        ), static fn (int $value): bool => $value > 0))), 0, 100);
        $params = [
            ':related_exam_id' => $examId,
            ':related_year_match' => $year,
            ':related_year_distance' => $year,
        ];
        $relationScoreSql = '0';

        if ($taxonomyIds !== []) {
            $placeholders = [];
            foreach ($taxonomyIds as $index => $taxonomyId) {
                $placeholder = ':related_taxonomy_' . $index;
                $placeholders[] = $placeholder;
                $params[$placeholder] = $taxonomyId;
            }
            $relationScoreSql = "(
                SELECT COALESCE(SUM(CASE f_relation.type
                    WHEN 'banca' THEN 12
                    WHEN 'orgao' THEN 10
                    WHEN 'cargo' THEN 8
                    WHEN 'carreira' THEN 6
                    WHEN 'area' THEN 4
                    WHEN 'foco' THEN 4
                    WHEN 'materia' THEN 3
                    ELSE 1
                END), 0)
                FROM prova_filters pf_relation
                INNER JOIN filters f_relation ON f_relation.id = pf_relation.filter_id
                WHERE pf_relation.prova_id = p.id
                  AND pf_relation.filter_id IN (" . implode(', ', $placeholders) . ')
            )';
        }

        $query = "SELECT
                p.id,
                p.nome,
                p.slug,
                p.ano,
                COUNT(DISTINCT qp.question_id) AS question_count,
                GROUP_CONCAT(DISTINCT CASE WHEN f.type = 'orgao' THEN f.name END ORDER BY f.name SEPARATOR '||') AS organization_names,
                GROUP_CONCAT(DISTINCT CASE WHEN f.type = 'orgao' THEN f.acronym END ORDER BY f.acronym SEPARATOR '||') AS organization_acronyms,
                MAX(CASE WHEN f.type = 'orgao' THEN f.meta_uf END) AS state_code,
                MAX(CASE WHEN f.type = 'banca' THEN COALESCE(NULLIF(f.acronym, ''), f.name) END) AS board_name,
                MAX(CASE WHEN f.type = 'banca' THEN f.slug END) AS board_slug,
                MAX(CASE WHEN pa.tipo = 'prova' THEN pa.caminho END) AS proof_url,
                MAX(CASE WHEN pa.tipo = 'gabarito' THEN pa.caminho END) AS answer_key_url,
                {$relationScoreSql} AS relation_score
            FROM provas p
            LEFT JOIN question_provas qp ON qp.prova_id = p.id
            LEFT JOIN prova_filters pf ON pf.prova_id = p.id
            LEFT JOIN filters f ON f.id = pf.filter_id
            LEFT JOIN prova_arquivos pa ON pa.prova_id = p.id
                AND pa.archived_at IS NULL
                AND pa.visibility_status = 'public'
            WHERE p.id <> :related_exam_id
              AND p.archived_at IS NULL
              AND p.status_editorial = 'published'
              AND p.visibility_status = 'public'
              AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
            GROUP BY p.id, p.nome, p.slug, p.ano
            ORDER BY relation_score DESC,
                CASE WHEN p.ano = :related_year_match THEN 0 ELSE 1 END ASC,
                ABS(COALESCE(p.ano, 0) - :related_year_distance) ASC,
                question_count DESC,
                p.id DESC
            LIMIT {$limit}";

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function findPublicBySlug(string $slug): ?array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("SELECT p.*, COUNT(DISTINCT qp.question_id) AS question_count
            FROM provas p
            LEFT JOIN question_provas qp ON qp.prova_id = p.id
            WHERE p.slug = :slug
              AND p.archived_at IS NULL
              AND p.status_editorial = 'published'
              AND p.visibility_status = 'public'
              AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
            GROUP BY p.id
            LIMIT 1");
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? ($this->hydrateMany([$row])[0] ?? null) : null;
    }

    public function find(int $id): ?array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("SELECT p.*, COUNT(DISTINCT qp.question_id) AS question_count
            FROM provas p
            LEFT JOIN question_provas qp ON qp.prova_id = p.id
            WHERE p.id = :id
            GROUP BY p.id
            LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return $this->hydrateMany([$row])[0] ?? null;
    }

    /** @return array<string,mixed>|null */
    public function findPublicContestForExam(int $examId): ?array
    {
        $stmt = $this->db->prepare("SELECT c.id, c.slug, c.title, c.domain_status AS status
            FROM contest_exams ce INNER JOIN contests c ON c.id = ce.contest_id
            WHERE ce.exam_id = :exam_id AND c.publication_status = 'published'
              AND c.visibility_status = 'public' AND c.archived_at IS NULL
              AND (c.scheduled_at IS NULL OR c.scheduled_at <= NOW())
              AND BINARY c.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
              AND EXISTS (
                  SELECT 1 FROM contest_organizations public_co
                  INNER JOIN filters public_org ON public_org.id = public_co.organization_filter_id
                      AND public_org.type = 'orgao'
                      AND COALESCE(public_org.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                      AND BINARY public_org.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
                  WHERE public_co.contest_id = c.id
              )
            LIMIT 1");
        $stmt->execute([':exam_id' => $examId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function save(array $payload, string $userId): array
    {
        StaticSitemapMutationInvalidator::invalidate('EXAM_CONTENT_MUTATION');
        $this->ensureSchema();
        $startedTransaction = !$this->db->inTransaction();

        if ($startedTransaction) {
            $this->db->beginTransaction();
        }

        try {
            $saved = $this->saveWithinTransaction($payload, $userId);
            if ($startedTransaction) {
                $this->db->commit();
            }
            return $saved;
        } catch (Throwable $exception) {
            if ($startedTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    private function saveWithinTransaction(array $payload, string $userId): array
    {
        unset($userId);
        $filterIdsByType = $this->collectFilterIdsByType($payload);
        $id = isset($payload['id']) && is_numeric($payload['id']) && (int) $payload['id'] > 0
            ? (int) $payload['id']
            : null;

        $nome = $this->limitString(trim((string) ($payload['nome'] ?? $payload['name'] ?? '')), 255);
        $slug = $this->uniqueSlug(
            trim((string) ($payload['slug'] ?? '')) ?: $this->slugify($nome),
            $id
        );
        $ano = $this->normalizeInt($payload['ano'] ?? $payload['year'] ?? null);
        $publishStatus = $this->limitString((string) ($payload['publishStatus'] ?? $payload['statusEditorial'] ?? $payload['status_editorial'] ?? 'published'), 30);
        $currentRow = $id !== null ? $this->findRawById($id) : null;
        $currentMetadata = $this->decodeJson($currentRow['metadata_json'] ?? null);
        if ($publishStatus === 'published' && trim((string) ($payload['publishedAt'] ?? '')) === '') {
            $payload['publishedAt'] = $currentMetadata['publishedAt']
                ?? $currentRow['created_at']
                ?? date('Y-m-d H:i:s');
        }

        $fields = [
            'nome' => $nome,
            'titulo_oficial' => $this->nullableString($payload['tituloOficial'] ?? $payload['titulo_oficial'] ?? null, 255),
            'nome_curto' => $this->nullableString($payload['nomeCurto'] ?? $payload['nome_curto'] ?? null, 180),
            'slug' => $slug,
            'edital_numero' => $this->nullableString($payload['editalNumero'] ?? $payload['edital_numero'] ?? null, 80),
            'ano' => $ano,
            'banca_id' => $filterIdsByType['banca'][0] ?? null,
            'orgao_id' => $filterIdsByType['orgao'][0] ?? null,
            'cargo_id' => $filterIdsByType['cargo'][0] ?? null,
            'nivel_id' => $filterIdsByType['nivel'][0] ?? null,
            'tipo_prova_id' => $filterIdsByType['tipo_prova'][0] ?? null,
            'carreira_id' => $filterIdsByType['carreira'][0] ?? null,
            'area_id' => $filterIdsByType['area'][0] ?? null,
            'inscricoes_inicio' => $this->nullableDate($payload['inscricoesInicio'] ?? $payload['inscricoes_inicio'] ?? null),
            'inscricoes_fim' => $this->nullableDate($payload['inscricoesFim'] ?? $payload['inscricoes_fim'] ?? null),
            'data_prova' => $this->nullableDate($payload['dataProva'] ?? $payload['data_prova'] ?? null),
            'resultado_data' => $this->nullableDate($payload['resultadoData'] ?? $payload['resultado_data'] ?? null),
            'vagas_total' => $this->normalizeInt($payload['vagasTotal'] ?? $payload['vagas_total'] ?? null),
            'cadastro_reserva_total' => $this->normalizeInt($payload['cadastroReservaTotal'] ?? $payload['cadastro_reserva_total'] ?? null),
            'url_oficial' => $this->nullableString($payload['urlOficial'] ?? $payload['url_oficial'] ?? null, 500),
            'status_editorial' => $publishStatus,
            'visibility_status' => $this->limitString((string) ($payload['visibilityStatus'] ?? $payload['visibility_status'] ?? 'public'), 30),
            'scheduled_at' => $publishStatus === 'scheduled'
                ? $this->nullableDate($payload['scheduledAt'] ?? $payload['scheduled_at'] ?? null)
                : null,
            'metadata_json' => json_encode($this->buildMetadata($payload), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];

        if ($id !== null && $this->findRawById($id)) {
            $assignments = [];
            foreach ($fields as $field => $_) {
                $assignments[] = "{$field} = :{$field}";
            }
            $fields['id'] = $id;
            $stmt = $this->db->prepare('UPDATE provas SET ' . implode(', ', $assignments) . ' WHERE id = :id');
            $stmt->execute($fields);
        } else {
            $columns = array_keys($fields);
            $stmt = $this->db->prepare('INSERT INTO provas (' . implode(', ', $columns) . ') VALUES (:' . implode(', :', $columns) . ')');
            $stmt->execute($fields);
            $id = (int) $this->db->lastInsertId();
        }

        $this->syncFilters($id, $filterIdsByType);
        $this->syncFiles($id, $payload);
        $this->syncCargos($id, $payload, $filterIdsByType['cargo'] ?? []);
        $this->syncCadernos($id, $payload);
        $this->syncCadernoFilters($id, $payload);

        return $this->find($id) ?? [];
    }

    public function archive(int $id): void
    {
        StaticSitemapMutationInvalidator::invalidate('EXAM_CONTENT_MUTATION');
        $this->ensureSchema();
        $stmt = $this->db->prepare("UPDATE provas SET archived_at = NOW(), status_editorial = 'archived' WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }

    public function listFiles(int $provaId): array
    {
        $this->ensureSchema();
        return $this->fetchFilesForProvas([$provaId])[$provaId] ?? [];
    }

    public function addFile(int $provaId, array $file, string $userId): array
    {
        $this->ensureSchema();
        if (!$this->findRawById($provaId)) {
            throw new InvalidArgumentException('Prova não encontrada para anexar o arquivo.');
        }

        $kind = $this->normalizeFileKind($file['kind'] ?? $file['tipo'] ?? '');
        $url = trim((string) ($file['url'] ?? $file['caminho'] ?? ''));
        if ($url === '') {
            throw new InvalidArgumentException('Arquivo sem URL persistente.');
        }

        $versionStmt = $this->db->prepare('SELECT COALESCE(MAX(versao), 0) + 1 FROM prova_arquivos WHERE prova_id = :prova_id AND tipo = :tipo');
        $versionStmt->execute([':prova_id' => $provaId, ':tipo' => $kind]);
        $version = max(1, (int) $versionStmt->fetchColumn());

        $insert = $this->db->prepare('INSERT INTO prova_arquivos
            (prova_id, tipo, nome_original, caminho, mime_type, tamanho, versao, visibility_status, uploaded_by_user_id, metadata_json)
            VALUES (:prova_id, :tipo, :nome, :caminho, :mime, :tamanho, :versao, :visibility_status, :uploaded_by_user_id, :metadata)');
        $insert->execute([
            ':prova_id' => $provaId,
            ':tipo' => $kind,
            ':nome' => trim((string) ($file['name'] ?? $file['nome_original'] ?? $file['label'] ?? $kind)),
            ':caminho' => $url,
            ':mime' => $file['mimeType'] ?? $file['mime_type'] ?? null,
            ':tamanho' => isset($file['size']) ? (int) $file['size'] : ($file['tamanho'] ?? null),
            ':versao' => $version,
            ':visibility_status' => $file['visibilityStatus'] ?? $file['visibility_status'] ?? 'public',
            ':uploaded_by_user_id' => $userId !== '' ? $userId : null,
            ':metadata' => json_encode($file, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $fileId = (int) $this->db->lastInsertId();
        return $this->findFileById($fileId) ?? [];
    }

    public function findFileById(int $id): ?array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('SELECT * FROM prova_arquivos WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->formatFile($row) : null;
    }

    public function archiveFile(int $provaId, int $fileId): void
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("UPDATE prova_arquivos SET archived_at = NOW(), visibility_status = 'archived' WHERE id = :id AND prova_id = :prova_id");
        $stmt->execute([':id' => $fileId, ':prova_id' => $provaId]);
    }

    public function createExtraction(array $payload): array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('INSERT INTO prova_extracoes
            (prova_id, arquivo_id, origem, status, parser_profile, extracted_json, created_by)
            VALUES (:prova_id, :arquivo_id, :origem, :status, :parser_profile, :extracted_json, :created_by)');
        $stmt->execute([
            ':prova_id' => $payload['prova_id'] ?? null,
            ':arquivo_id' => $payload['arquivo_id'] ?? null,
            ':origem' => $payload['origem'] ?? 'manual',
            ':status' => $payload['status'] ?? 'review',
            ':parser_profile' => $payload['parser_profile'] ?? null,
            ':extracted_json' => json_encode($payload['extracted'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':created_by' => $payload['created_by'] ?? null,
        ]);

        return $this->findExtraction((int) $this->db->lastInsertId()) ?? [];
    }

    public function findExtraction(int $id): ?array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('SELECT * FROM prova_extracoes WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->formatExtraction($row) : null;
    }

    public function reviewExtraction(int $id, array $reviewPayload, string $reviewedBy, string $status = 'done'): array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('UPDATE prova_extracoes
            SET status = :status, review_json = :review_json, reviewed_by = :reviewed_by, updated_at = NOW()
            WHERE id = :id');
        $stmt->execute([
            ':id' => $id,
            ':status' => $status,
            ':review_json' => json_encode($reviewPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':reviewed_by' => $reviewedBy !== '' ? $reviewedBy : null,
        ]);

        return $this->findExtraction($id) ?? [];
    }

    private function findRawById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM provas WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    private function hydrateMany(array $rows): array
    {
        if (!$rows) {
            return [];
        }

        $ids = array_map(fn ($row) => (int) $row['id'], $rows);
        $filters = $this->fetchFiltersForProvas($ids);
        $files = $this->fetchFilesForProvas($ids);
        $cadernos = $this->fetchCadernosForProvas($ids);
        $cadernoFilters = $this->fetchCadernoFiltersForProvas($ids);
        $cargos = $this->fetchCargosForProvas($ids);

        return array_map(function (array $row) use ($filters, $files, $cadernos, $cadernoFilters, $cargos): array {
            return $this->formatExam(
                $row,
                $filters[(int) $row['id']] ?? [],
                $files[(int) $row['id']] ?? [],
                $cadernos[(int) $row['id']] ?? [],
                $cadernoFilters[(int) $row['id']] ?? [],
                $cargos[(int) $row['id']] ?? []
            );
        }, $rows);
    }

    private function fetchFiltersForProvas(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT pf.prova_id, pf.role, f.id, f.type, f.name, f.slug, f.parent_id, f.taxonomy_level, f.meta_materia, f.meta_uf
            FROM prova_filters pf
            INNER JOIN filters f ON f.id = pf.filter_id
            WHERE pf.prova_id IN ({$placeholders})
            ORDER BY f.type, f.name");
        $stmt->execute($ids);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $result[(int) $row['prova_id']][] = $row;
        }
        return $result;
    }

    private function fetchFilesForProvas(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT * FROM prova_arquivos WHERE prova_id IN ({$placeholders}) AND archived_at IS NULL ORDER BY tipo, versao DESC, created_at DESC");
        $stmt->execute($ids);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $result[(int) $row['prova_id']][] = $this->formatFile($row);
        }
        return $result;
    }

    private function formatFile(array $row): array
    {
        $kind = (string) ($row['tipo'] ?? 'outro');
        $label = [
            'edital' => 'Edital',
            'prova' => 'Prova',
            'gabarito' => 'Gabarito',
            'outro' => 'Outro',
        ][$kind] ?? ucfirst($kind);

        return [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'kind' => $kind,
            'type' => $kind,
            'label' => $label,
            'name' => $row['nome_original'],
            'url' => $row['caminho'],
            'mimeType' => $row['mime_type'],
            'size' => $row['tamanho'] !== null ? (int) $row['tamanho'] : null,
            'version' => isset($row['versao']) ? (int) $row['versao'] : 1,
            'versao' => isset($row['versao']) ? (int) $row['versao'] : 1,
            'visibilityStatus' => $row['visibility_status'] ?? 'public',
            'uploadedByUserId' => $row['uploaded_by_user_id'] ?? null,
            'uploadedAt' => $row['created_at'] ?? null,
            'archivedAt' => $row['archived_at'] ?? null,
        ];
    }

    private function formatExtraction(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'provaId' => isset($row['prova_id']) ? (int) $row['prova_id'] : null,
            'arquivoId' => isset($row['arquivo_id']) ? (int) $row['arquivo_id'] : null,
            'origem' => $row['origem'],
            'status' => $row['status'],
            'parserProfile' => $row['parser_profile'] ?? null,
            'extracted' => $this->decodeJson($row['extracted_json'] ?? null),
            'review' => $this->decodeJson($row['review_json'] ?? null),
            'errorMessage' => $row['error_message'] ?? null,
            'createdBy' => $row['created_by'] ?? null,
            'reviewedBy' => $row['reviewed_by'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }

    private function fetchCadernosForProvas(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT * FROM prova_cadernos WHERE prova_id IN ({$placeholders}) ORDER BY ordem, nome");
        $stmt->execute($ids);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $result[(int) $row['prova_id']][] = [
                'id' => (int) $row['id'],
                'nome' => $row['nome'],
                'tipo' => $row['tipo'],
                'cor' => $row['cor'],
                'ordem' => (int) $row['ordem'],
            ];
        }
        return $result;
    }

    private function fetchCadernoFiltersForProvas(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT pc.prova_id, pcf.caderno_id, pcf.role, pcf.ordem, f.id, f.name, f.slug, f.type, f.parent_id, f.taxonomy_level
            FROM prova_caderno_filters pcf
            INNER JOIN prova_cadernos pc ON pc.id = pcf.caderno_id
            INNER JOIN filters f ON f.id = pcf.filter_id
            WHERE pc.prova_id IN ({$placeholders})
            ORDER BY pc.ordem, pcf.ordem, f.name");
        $stmt->execute($ids);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $result[(int) $row['prova_id']][(int) $row['caderno_id']][] = [
                'id' => (int) $row['id'],
                'nome' => $row['name'],
                'name' => $row['name'],
                'slug' => $row['slug'],
                'type' => $row['type'],
                'role' => $row['role'],
                'ordem' => (int) $row['ordem'],
                'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
                'taxonomyLevel' => $row['taxonomy_level'],
            ];
        }
        return $result;
    }

    private function fetchCargosForProvas(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT * FROM prova_cargo_detalhes WHERE prova_id IN ({$placeholders}) ORDER BY nome");
        $stmt->execute($ids);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $cargoIds = array_values(array_filter(array_map(fn ($row) => (int) ($row['id'] ?? 0), $rows)));
        $vacanciesByCargo = [];

        if ($cargoIds) {
            $cargoPlaceholders = implode(',', array_fill(0, count($cargoIds), '?'));
            $vacancyStmt = $this->db->prepare("SELECT * FROM prova_cargo_vagas WHERE cargo_detalhe_id IN ({$cargoPlaceholders}) ORDER BY id");
            $vacancyStmt->execute($cargoIds);
            foreach ($vacancyStmt->fetchAll(PDO::FETCH_ASSOC) as $vacancy) {
                $vacanciesByCargo[(int) $vacancy['cargo_detalhe_id']][] = [
                    'id' => (int) $vacancy['id'],
                    'ampla' => (int) $vacancy['ampla'],
                    'pcd' => (int) $vacancy['pcd'],
                    'cotas' => (int) $vacancy['cotas'],
                    'cadastroReserva' => (int) $vacancy['cadastro_reserva'],
                    'cadastro_reserva' => (int) $vacancy['cadastro_reserva'],
                    'descricao' => $vacancy['descricao'],
                    'description' => $vacancy['descricao'],
                ];
            }
        }

        $result = [];
        foreach ($rows as $row) {
            $row['vagas'] = $vacanciesByCargo[(int) $row['id']] ?? [];
            $row['vacancies'] = $row['vagas'];
            $result[(int) $row['prova_id']][] = $row;
        }
        return $result;
    }

    private function formatExam(array $row, array $filters, array $files, array $cadernos, array $cadernoFilters, array $cargoDetails): array
    {
        $grouped = [];
        foreach ($filters as $filter) {
            $grouped[$filter['type']][] = [
                'id' => (int) $filter['id'],
                'nome' => $filter['name'],
                'name' => $filter['name'],
                'slug' => $filter['slug'],
                'type' => $filter['type'],
                'parentId' => $filter['parent_id'] !== null ? (int) $filter['parent_id'] : null,
                'taxonomyLevel' => $filter['taxonomy_level'],
                'metaUf' => $filter['meta_uf'] ?? null,
            ];
        }

        $metadata = $this->decodeJson($row['metadata_json'] ?? null);
        $banca = $grouped['banca'][0] ?? $this->legacyTaxonomy((int) ($row['banca_id'] ?? 0));
        $orgao = $grouped['orgao'][0] ?? $this->legacyTaxonomy((int) ($row['orgao_id'] ?? 0));
        $cargo = $grouped['cargo'][0] ?? $this->legacyTaxonomy((int) ($row['cargo_id'] ?? 0));

        $requisitos = $this->normalizeTextList($metadata['requisitos'] ?? $metadata['requirements'] ?? []);
        $remuneracoes = $this->normalizeTextList($metadata['remuneracoes'] ?? $metadata['remunerations'] ?? []);
        $formattedCadernos = $this->attachContentToCadernos($cadernos, $cadernoFilters);
        $conteudo = $this->normalizeTextList($metadata['conteudoProgramatico'] ?? $metadata['programmaticContent'] ?? []);
        if (!$conteudo) {
            foreach ($formattedCadernos as $caderno) {
                foreach (($caderno['conteudoProgramatico'] ?? []) as $item) {
                    $conteudo[] = (string) ($item['nome'] ?? $item['name'] ?? '');
                }
            }
            $conteudo = array_values(array_unique(array_filter($conteudo)));
        }

        if (!$requisitos) {
            $requisitos = $this->fetchRequirementTexts((int) $row['id']);
        }

        return [
            'id' => (int) $row['id'],
            'nome' => $row['nome'],
            'tituloOficial' => $row['titulo_oficial'] ?? null,
            'nomeCurto' => $row['nome_curto'] ?? null,
            'slug' => $row['slug'],
            'editalNumero' => $row['edital_numero'] ?? null,
            'ano' => $row['ano'] !== null ? (int) $row['ano'] : 0,
            'inscricoesInicio' => $row['inscricoes_inicio'] ?? null,
            'inscricoesFim' => $row['inscricoes_fim'] ?? null,
            'dataProva' => $row['data_prova'] ?? null,
            'resultadoData' => $row['resultado_data'] ?? null,
            'vagasTotal' => $row['vagas_total'] !== null ? (int) $row['vagas_total'] : null,
            'cadastroReservaTotal' => $row['cadastro_reserva_total'] !== null ? (int) $row['cadastro_reserva_total'] : null,
            'urlOficial' => $row['url_oficial'] ?? null,
            'tipo' => (int) ($row['tipo_prova_id'] ?? 0),
            'index' => (string) ($metadata['index'] ?? ''),
            'nivel' => $grouped['nivel'][0]['nome'] ?? (string) ($metadata['nivel'] ?? ''),
            'caderno' => $cadernos[0]['nome'] ?? (string) ($metadata['caderno'] ?? ''),
            'tipoCaderno' => $cadernos[0]['tipo'] ?? (string) ($metadata['tipoCaderno'] ?? $metadata['bookletType'] ?? ''),
            'corCaderno' => $cadernos[0]['cor'] ?? (string) ($metadata['corCaderno'] ?? $metadata['bookletColor'] ?? ''),
            'bookletType' => $cadernos[0]['tipo'] ?? (string) ($metadata['bookletType'] ?? $metadata['tipoCaderno'] ?? ''),
            'bookletColor' => $cadernos[0]['cor'] ?? (string) ($metadata['bookletColor'] ?? $metadata['corCaderno'] ?? ''),
            'publishStatus' => $row['status_editorial'] ?? 'published',
            'visibilityStatus' => $row['visibility_status'] ?? 'public',
            'scheduledAt' => $row['scheduled_at'] ?? null,
            'publishedAt' => $metadata['publishedAt']
                ?? (($row['status_editorial'] ?? '') === 'published' ? ($row['created_at'] ?? null) : null),
            'pdfUrl' => $this->firstFileUrl($files, 'prova'),
            'proofUrl' => $this->firstFileUrl($files, 'prova'),
            'editalUrl' => $this->firstFileUrl($files, 'edital'),
            'gabaritoUrl' => $this->firstFileUrl($files, 'gabarito'),
            'answerKeyUrl' => $this->firstFileUrl($files, 'gabarito'),
            'files' => $files,
            'examFiles' => $files,
            'banca' => $banca,
            'orgao' => $orgao,
            'orgaos' => $grouped['orgao'] ?? [],
            'cargo' => $cargo,
            'cargos' => ($grouped['cargo'] ?? []) ?: array_map(fn ($cargoRow) => [
                'id' => $cargoRow['cargo_filter_id'] !== null ? (int) $cargoRow['cargo_filter_id'] : null,
                'nome' => $cargoRow['nome'],
                'name' => $cargoRow['nome'],
                'descricao' => $cargoRow['nome'],
                'remuneracao' => $cargoRow['remuneracao'] ?? null,
                'vagas' => $cargoRow['vagas'] ?? [],
                'vacancies' => $cargoRow['vacancies'] ?? [],
            ], $cargoDetails),
            'vagas' => array_values(array_merge(...array_map(fn ($cargoRow) => $cargoRow['vagas'] ?? [], $cargoDetails ?: [[]]))),
            'vacancies' => array_values(array_merge(...array_map(fn ($cargoRow) => $cargoRow['vacancies'] ?? [], $cargoDetails ?: [[]]))),
            'roles' => ($grouped['cargo'] ?? [])
                ? array_values(array_filter(array_map(fn ($item) => $item['nome'] ?? $item['name'] ?? null, $grouped['cargo'] ?? [])))
                : array_values(array_filter(array_map(fn ($cargoRow) => $cargoRow['nome'] ?? null, $cargoDetails))),
            'requisitos' => $requisitos,
            'requirements' => $requisitos,
            'remuneracoes' => $remuneracoes,
            'remunerations' => $remuneracoes,
            'conteudoProgramatico' => $conteudo,
            'programmaticContent' => $conteudo,
            'taxonomies' => $grouped,
            'cadernos' => $formattedCadernos,
            'questionCount' => (int) ($row['question_count'] ?? 0),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }

    private function attachContentToCadernos(array $cadernos, array $cadernoFilters): array
    {
        return array_map(function (array $caderno) use ($cadernoFilters): array {
            $content = $cadernoFilters[(int) ($caderno['id'] ?? 0)] ?? [];
            $caderno['conteudoProgramatico'] = $content;
            $caderno['programmaticContent'] = $content;
            return $caderno;
        }, $cadernos);
    }

    private function fetchRequirementTexts(int $provaId): array
    {
        $stmt = $this->db->prepare('SELECT requisito FROM prova_cargo_requisitos WHERE prova_id = :id ORDER BY ordem, id');
        $stmt->execute([':id' => $provaId]);
        return array_values(array_filter(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [])));
    }

    private function firstFileUrl(array $files, string $kind): ?string
    {
        foreach ($files as $file) {
            if (($file['kind'] ?? null) === $kind) {
                return $file['url'] ?? null;
            }
        }
        return null;
    }

    private function legacyTaxonomy(int $id): array
    {
        if ($id <= 0) {
            return [];
        }
        $stmt = $this->db->prepare('SELECT id, name, slug, type FROM filters WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return ['id' => $id];
        }
        return [
            'id' => (int) $row['id'],
            'nome' => $row['name'],
            'name' => $row['name'],
            'slug' => $row['slug'],
            'type' => $row['type'],
        ];
    }

    private function syncFilters(int $provaId, array $filterIdsByType): void
    {
        $stmt = $this->db->prepare('DELETE FROM prova_filters WHERE prova_id = :id');
        $stmt->execute([':id' => $provaId]);

        $insert = $this->db->prepare('INSERT IGNORE INTO prova_filters (prova_id, filter_id, role) VALUES (:prova_id, :filter_id, :role)');
        foreach ($filterIdsByType as $type => $ids) {
            foreach (array_unique(array_filter(array_map('intval', $ids))) as $filterId) {
                $insert->execute([
                    ':prova_id' => $provaId,
                    ':filter_id' => $filterId,
                    ':role' => $type,
                ]);
            }
        }
    }

    private function syncFiles(int $provaId, array $payload): void
    {
        $files = $payload['files'] ?? $payload['examFiles'] ?? [];
        if (!is_array($files)) {
            return;
        }

        $insert = $this->db->prepare('INSERT INTO prova_arquivos
            (prova_id, tipo, nome_original, caminho, mime_type, tamanho, versao, visibility_status, uploaded_by_user_id, metadata_json)
            VALUES (:prova_id, :tipo, :nome, :caminho, :mime, :tamanho, :versao, :visibility_status, :uploaded_by_user_id, :metadata)');
        $update = $this->db->prepare('UPDATE prova_arquivos SET
                tipo = :tipo,
                nome_original = :nome,
                caminho = :caminho,
                mime_type = :mime,
                tamanho = :tamanho,
                visibility_status = :visibility_status,
                metadata_json = :metadata
            WHERE id = :id AND prova_id = :prova_id');
        $findExisting = $this->db->prepare('SELECT id, versao FROM prova_arquivos WHERE prova_id = :prova_id AND caminho = :caminho LIMIT 1');
        $findNextVersion = $this->db->prepare('SELECT COALESCE(MAX(versao), 0) + 1 FROM prova_arquivos WHERE prova_id = :prova_id AND tipo = :tipo');
        foreach ($files as $file) {
            if (!is_array($file)) {
                continue;
            }
            $kind = $this->normalizeFileKind($file['kind'] ?? $file['tipo'] ?? '');
            $url = trim((string) ($file['url'] ?? $file['caminho'] ?? ''));
            if ($url === '') {
                continue;
            }
            $fileId = isset($file['id']) && is_numeric($file['id']) ? (int) $file['id'] : 0;
            $payload = [
                ':prova_id' => $provaId,
                ':tipo' => $kind,
                ':nome' => $this->limitString(trim((string) ($file['name'] ?? $file['nome_original'] ?? $file['label'] ?? $kind)), 255),
                ':caminho' => $this->limitString($url, 500),
                ':mime' => $this->nullableString($file['mimeType'] ?? $file['mime_type'] ?? null, 120),
                ':tamanho' => isset($file['size']) ? (int) $file['size'] : ($file['tamanho'] ?? null),
                ':visibility_status' => $file['visibilityStatus'] ?? $file['visibility_status'] ?? 'public',
                ':metadata' => json_encode($file, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            if ($fileId > 0) {
                $update->execute($payload + [':id' => $fileId]);
                continue;
            }

            $findExisting->execute([':prova_id' => $provaId, ':caminho' => $url]);
            $existing = $findExisting->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $update->execute($payload + [':id' => (int) $existing['id']]);
                continue;
            }

            $findNextVersion->execute([':prova_id' => $provaId, ':tipo' => $kind]);
            $insert->execute($payload + [
                ':versao' => max(1, (int) $findNextVersion->fetchColumn()),
                ':uploaded_by_user_id' => $file['uploadedByUserId'] ?? $file['uploaded_by_user_id'] ?? null,
            ]);
        }
    }

    private function normalizeFileKind(mixed $value): string
    {
        $kind = strtolower(trim((string) $value));
        return in_array($kind, ['edital', 'prova', 'gabarito', 'outro'], true) ? $kind : 'outro';
    }

    private function syncCargos(int $provaId, array $payload, array $cargoFilterIds): void
    {
        $this->db->prepare('DELETE FROM prova_cargo_requisitos WHERE prova_id = :id')->execute([':id' => $provaId]);
        $this->db->prepare('DELETE FROM prova_cargo_vagas WHERE prova_id = :id')->execute([':id' => $provaId]);
        $this->db->prepare('DELETE FROM prova_cargo_detalhes WHERE prova_id = :id')->execute([':id' => $provaId]);

        $cargoNames = $this->normalizeTextList($payload['cargos'] ?? $payload['roles'] ?? []);
        if (!$cargoNames && isset($payload['cargo']) && is_array($payload['cargo'])) {
            $cargoNames = $this->normalizeTextList([$payload['cargo']['descricao'] ?? $payload['cargo']['nome'] ?? $payload['cargo']['name'] ?? '']);
        }

        $remuneracoes = $this->normalizeTextList($payload['remuneracoes'] ?? $payload['remunerations'] ?? []);
        $requisitos = $this->normalizeTextList($payload['requisitos'] ?? $payload['requirements'] ?? []);
        $vagas = $payload['vagas'] ?? $payload['vacancies'] ?? [];
        $vagas = is_array($vagas) ? array_values($vagas) : [];
        $insertCargo = $this->db->prepare('INSERT INTO prova_cargo_detalhes (prova_id, cargo_filter_id, nome, remuneracao, metadata_json)
            VALUES (:prova_id, :cargo_filter_id, :nome, :remuneracao, :metadata)');
        $insertReq = $this->db->prepare('INSERT INTO prova_cargo_requisitos (prova_id, cargo_detalhe_id, requisito, ordem)
            VALUES (:prova_id, :cargo_detalhe_id, :requisito, :ordem)');
        $insertVaga = $this->db->prepare('INSERT INTO prova_cargo_vagas (prova_id, cargo_detalhe_id, ampla, pcd, cotas, cadastro_reserva, descricao)
            VALUES (:prova_id, :cargo_detalhe_id, :ampla, :pcd, :cotas, :cadastro_reserva, :descricao)');

        foreach ($cargoNames as $index => $name) {
            $insertCargo->execute([
                ':prova_id' => $provaId,
                ':cargo_filter_id' => $cargoFilterIds[$index] ?? null,
                ':nome' => $this->limitString($name, 255),
                ':remuneracao' => $this->nullableString($remuneracoes[$index] ?? $remuneracoes[0] ?? null, 255),
                ':metadata' => json_encode(['source' => 'exam_bank_editor'], JSON_UNESCAPED_UNICODE),
            ]);
            $cargoDetailId = (int) $this->db->lastInsertId();
            $vaga = $vagas[$index] ?? (count($vagas) === 1 ? $vagas[0] : null);
            if ($vaga !== null) {
                $vagaData = is_array($vaga) ? $vaga : ['descricao' => (string) $vaga];
                $insertVaga->execute([
                    ':prova_id' => $provaId,
                    ':cargo_detalhe_id' => $cargoDetailId,
                    ':ampla' => $this->normalizeInt($vagaData['ampla'] ?? $vagaData['general'] ?? null) ?? 0,
                    ':pcd' => $this->normalizeInt($vagaData['pcd'] ?? null) ?? 0,
                    ':cotas' => $this->normalizeInt($vagaData['cotas'] ?? $vagaData['quotas'] ?? null) ?? 0,
                    ':cadastro_reserva' => $this->normalizeInt($vagaData['cadastroReserva'] ?? $vagaData['cadastro_reserva'] ?? $vagaData['reserve'] ?? null) ?? 0,
                    ':descricao' => $this->nullableString($vagaData['descricao'] ?? $vagaData['description'] ?? null, 255),
                ]);
            }
            foreach ($requisitos as $reqIndex => $requisito) {
                $insertReq->execute([
                    ':prova_id' => $provaId,
                    ':cargo_detalhe_id' => $cargoDetailId,
                    ':requisito' => $requisito,
                    ':ordem' => $reqIndex,
                ]);
            }
        }

        if (!$cargoNames && $requisitos) {
            foreach ($requisitos as $reqIndex => $requisito) {
                $insertReq->execute([
                    ':prova_id' => $provaId,
                    ':cargo_detalhe_id' => null,
                    ':requisito' => $requisito,
                    ':ordem' => $reqIndex,
                ]);
            }
        }
    }

    private function syncCadernos(int $provaId, array $payload): void
    {
        $this->db->prepare('DELETE FROM prova_cadernos WHERE prova_id = :id')->execute([':id' => $provaId]);
        $cadernos = $payload['cadernos'] ?? [];
        if (!$cadernos && (($payload['caderno'] ?? '') || ($payload['tipoCaderno'] ?? '') || ($payload['corCaderno'] ?? ''))) {
            $cadernos = [[
                'nome' => $payload['caderno'] ?? implode(' - ', array_filter([$payload['tipoCaderno'] ?? null, $payload['corCaderno'] ?? null])),
                'tipo' => $payload['tipoCaderno'] ?? $payload['bookletType'] ?? null,
                'cor' => $payload['corCaderno'] ?? $payload['bookletColor'] ?? null,
            ]];
        }

        if (!$cadernos && ($this->normalizeContentItems($payload))) {
            $cadernos = [[
                'nome' => 'Caderno geral',
                'tipo' => $payload['tipoCaderno'] ?? $payload['bookletType'] ?? null,
                'cor' => $payload['corCaderno'] ?? $payload['bookletColor'] ?? null,
            ]];
        }

        if (!is_array($cadernos)) {
            return;
        }

        $insert = $this->db->prepare('INSERT INTO prova_cadernos (prova_id, nome, tipo, cor, ordem, metadata_json)
            VALUES (:prova_id, :nome, :tipo, :cor, :ordem, :metadata)');
        foreach ($cadernos as $index => $caderno) {
            if (!is_array($caderno)) {
                continue;
            }
            $name = trim((string) ($caderno['nome'] ?? $caderno['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $insert->execute([
                ':prova_id' => $provaId,
                ':nome' => $this->limitString($name, 180),
                ':tipo' => $this->nullableString($caderno['tipo'] ?? $caderno['type'] ?? null, 80),
                ':cor' => $this->nullableString($caderno['cor'] ?? $caderno['color'] ?? null, 80),
                ':ordem' => $index,
                ':metadata' => json_encode($caderno, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
    }

    private function syncCadernoFilters(int $provaId, array $payload): void
    {
        $cadernos = $this->fetchCadernoRows($provaId);
        if (!$cadernos) {
            return;
        }

        $cadernoIds = array_map(fn ($row) => (int) $row['id'], $cadernos);
        $deletePlaceholders = implode(',', array_fill(0, count($cadernoIds), '?'));
        $delete = $this->db->prepare("DELETE FROM prova_caderno_filters WHERE caderno_id IN ({$deletePlaceholders})");
        $delete->execute($cadernoIds);

        $defaultCadernoId = (int) ($cadernos[0]['id'] ?? 0);
        $itemsByCaderno = [];

        $payloadCadernos = $payload['cadernos'] ?? [];
        if (is_array($payloadCadernos)) {
            foreach (array_values($payloadCadernos) as $index => $cadernoPayload) {
                if (!is_array($cadernoPayload) || empty($cadernos[$index])) {
                    continue;
                }
                $items = $this->normalizeContentItems($cadernoPayload);
                if ($items) {
                    $itemsByCaderno[(int) $cadernos[$index]['id']] = $items;
                }
            }
        }

        $rootItems = $this->normalizeContentItems($payload);
        if ($rootItems) {
            $itemsByCaderno[$defaultCadernoId] = array_merge($itemsByCaderno[$defaultCadernoId] ?? [], $rootItems);
        }

        if (!$itemsByCaderno) {
            return;
        }

        $insert = $this->db->prepare('INSERT IGNORE INTO prova_caderno_filters (caderno_id, filter_id, role, ordem)
            VALUES (:caderno_id, :filter_id, :role, :ordem)');
        foreach ($itemsByCaderno as $cadernoId => $items) {
            $seen = [];
            $order = 0;
            foreach ($items as $item) {
                $filter = $this->resolveContentFilter($item);
                if (!$filter) {
                    continue;
                }
                $filterId = (int) $filter['id'];
                if (isset($seen[$filterId])) {
                    continue;
                }
                $seen[$filterId] = true;
                $insert->execute([
                    ':caderno_id' => (int) $cadernoId,
                    ':filter_id' => $filterId,
                    ':role' => $filter['type'] ?? 'conteudo',
                    ':ordem' => $order++,
                ]);
            }
        }
    }

    private function fetchCadernoRows(int $provaId): array
    {
        $stmt = $this->db->prepare('SELECT id, nome FROM prova_cadernos WHERE prova_id = :id ORDER BY ordem, id');
        $stmt->execute([':id' => $provaId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function normalizeContentItems(array $payload): array
    {
        $value = $payload['conteudoProgramatico'] ?? $payload['programmaticContent'] ?? $payload['conteudo_programatico'] ?? [];
        if ($value === null || $value === '') {
            return [];
        }
        if (is_string($value)) {
            $value = preg_split('/\r?\n|;/', $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }
        $isAssoc = array_keys($value) !== range(0, count($value) - 1);
        return $isAssoc ? [$value] : $value;
    }

    private function resolveContentFilter($item): ?array
    {
        if (is_numeric($item)) {
            return $this->findAllowedContentFilterById((int) $item);
        }

        if (is_array($item)) {
            if (!empty($item['id']) && is_numeric($item['id'])) {
                return $this->findAllowedContentFilterById((int) $item['id']);
            }
            $type = (string) ($item['type'] ?? $item['tipo'] ?? '');
            $name = trim((string) ($item['nome'] ?? $item['name'] ?? $item['descricao'] ?? $item['label'] ?? ''));
            if ($name === '') {
                return null;
            }
            if (in_array($type, self::CONTENT_FILTER_TYPES, true)) {
                return $this->findFilterByName($type, $name);
            }
            return $this->findContentFilterByName($name);
        }

        if (is_string($item)) {
            return $this->findContentFilterByName(trim($item));
        }

        return null;
    }

    private function findAllowedContentFilterById(int $filterId): ?array
    {
        if ($filterId <= 0) {
            return null;
        }
        $stmt = $this->db->prepare('SELECT id, type, name, slug FROM filters WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $filterId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || !in_array((string) $row['type'], self::CONTENT_FILTER_TYPES, true)) {
            return null;
        }
        return $row;
    }

    private function findContentFilterByName(string $name): ?array
    {
        $name = trim($name);
        if ($name === '') {
            return null;
        }
        foreach (self::CONTENT_FILTER_TYPES as $type) {
            $filter = $this->findFilterByName($type, $name);
            if ($filter) {
                return $filter;
            }
        }
        return null;
    }

    private function collectFilterIdsByType(array $payload): array
    {
        $result = [];
        foreach (self::FILTER_KEY_MAP as $type => $keys) {
            $result[$type] = [];
            foreach ($keys as $key) {
                if (!array_key_exists($key, $payload)) {
                    continue;
                }
                $result[$type] = array_merge($result[$type], $this->extractFilterIds($payload[$key], $type));
            }
            $result[$type] = array_values(array_unique(array_filter(array_map('intval', $result[$type]))));
        }

        if (!empty($payload['ano']) || !empty($payload['year'])) {
            $yearFilter = $this->findFilterByName('ano', (string) ($payload['ano'] ?? $payload['year']));
            if ($yearFilter) {
                $result['ano'][] = (int) $yearFilter['id'];
            }
        }

        return $result;
    }

    private function extractFilterIds($value, string $type): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_numeric($value) && $type !== 'ano') {
            $filterId = (int) $value;
            $this->assertFilterType($filterId, $type);
            return [$filterId];
        }

        if (is_string($value)) {
            $ids = [];
            foreach (preg_split('/[\n;,]+/', $value) ?: [] as $name) {
                $filter = $this->findFilterByName($type, trim($name));
                if ($filter) {
                    $ids[] = (int) $filter['id'];
                }
            }
            return $ids;
        }

        if (!is_array($value)) {
            return [];
        }

        $isAssoc = array_keys($value) !== range(0, count($value) - 1);
        $items = $isAssoc ? [$value] : $value;
        $ids = [];
        foreach ($items as $item) {
            if (is_numeric($item) && $type !== 'ano') {
                $filterId = (int) $item;
                $this->assertFilterType($filterId, $type);
                $ids[] = $filterId;
                continue;
            }
            if (is_array($item)) {
                if (!empty($item['id']) && is_numeric($item['id'])) {
                    $filterId = (int) $item['id'];
                    $this->assertFilterType($filterId, $type);
                    $ids[] = $filterId;
                    continue;
                }
                $name = trim((string) ($item['nome'] ?? $item['name'] ?? $item['descricao'] ?? ''));
                $filter = $name !== '' ? $this->findFilterByName($type, $name) : null;
                if ($filter) {
                    $ids[] = (int) $filter['id'];
                }
            } elseif (is_string($item)) {
                $filter = $this->findFilterByName($type, trim($item));
                if ($filter) {
                    $ids[] = (int) $filter['id'];
                }
            }
        }
        return $ids;
    }

    private function assertFilterType(int $filterId, string $expectedType): void
    {
        if ($filterId <= 0) {
            return;
        }
        $stmt = $this->db->prepare('SELECT type, name FROM filters WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $filterId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new InvalidArgumentException("Taxonomia {$filterId} nao encontrada.");
        }
        if ((string) $row['type'] !== $expectedType) {
            throw new InvalidArgumentException("Taxonomia {$filterId} pertence a {$row['type']}, mas era esperado {$expectedType}.");
        }
    }
    private function findFilterByName(string $type, string $name): ?array
    {
        $name = trim($name);
        if ($name === '') {
            return null;
        }
        $slug = $this->slugify($name);
        $stmt = $this->db->prepare('SELECT id, type, name, slug FROM filters WHERE type = :type AND (slug = :slug OR name = :name) LIMIT 1');
        $stmt->execute([':type' => $type, ':slug' => $slug, ':name' => $name]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function uniqueSlug(string $slug, ?int $exceptId = null): string
    {
        $slug = $this->limitString($this->slugify($slug ?: 'prova'), 240);
        $base = $slug;
        $suffix = 2;
        while ($this->slugExists($slug, $exceptId)) {
            $suffixText = '-' . $suffix;
            $slug = $this->limitString($base, 255 - strlen($suffixText)) . $suffixText;
            $suffix++;
        }
        return $slug;
    }

    private function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $query = 'SELECT id FROM provas WHERE slug = :slug';
        $params = [':slug' => $slug];
        if ($exceptId !== null) {
            $query .= ' AND id != :id';
            $params[':id'] = $exceptId;
        }
        $query .= ' LIMIT 1';
        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function slugify(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $normalized = is_string($normalized) ? $normalized : $value;
        $normalized = preg_replace('/[^a-z0-9]+/i', '-', $normalized) ?? '';
        $normalized = trim($normalized, '-');
        return $normalized !== '' ? $normalized : 'prova';
    }

    private function nullableString($value, ?int $maxLength = null): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text !== '' && $maxLength !== null) {
            $text = $this->limitString($text, $maxLength);
        }
        return $text !== '' ? $text : null;
    }

    private function limitString(string $value, int $maxLength): string
    {
        $value = trim($value);
        if ($value === '' || mb_strlen($value, 'UTF-8') <= $maxLength) {
            return $value;
        }

        return rtrim(mb_substr($value, 0, $maxLength, 'UTF-8'));
    }

    private function nullableDate($value): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return null;
        }
        $timestamp = strtotime($text);
        return $timestamp ? date('Y-m-d H:i:s', $timestamp) : null;
    }

    private function normalizeInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        return is_numeric($value) ? (int) $value : null;
    }

    private function normalizeTextList($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        if (is_string($value)) {
            $value = preg_split('/\r?\n|;/', $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }
        return array_values(array_filter(array_map(function ($item) {
            if (is_array($item)) {
                return trim((string) ($item['nome'] ?? $item['name'] ?? $item['descricao'] ?? ''));
            }
            return trim((string) $item);
        }, $value)));
    }

    private function decodeJson($value): array
    {
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function buildMetadata(array $payload): array
    {
        $allowed = [
            'index',
            'nivel',
            'caderno',
            'tipoCaderno',
            'corCaderno',
            'bookletType',
            'bookletColor',
            'requisitos',
            'requirements',
            'remuneracoes',
            'remunerations',
            'conteudoProgramatico',
            'programmaticContent',
            'editalInsights',
            'extractionStatus',
            'publishedAt',
        ];
        $metadata = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $payload)) {
                $metadata[$key] = $payload[$key];
            }
        }
        return $metadata;
    }
}
