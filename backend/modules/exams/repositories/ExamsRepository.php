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

        $this->db->exec("CREATE TABLE IF NOT EXISTS provas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            titulo_oficial VARCHAR(255) NULL,
            nome_curto VARCHAR(180) NULL,
            slug VARCHAR(255) NOT NULL,
            edital_numero VARCHAR(80) NULL,
            ano INT NULL,
            banca_id INT NULL,
            orgao_id INT NULL,
            cargo_id INT NULL,
            nivel_id INT NULL,
            tipo_prova_id INT NULL,
            carreira_id INT NULL,
            area_id INT NULL,
            inscricoes_inicio DATETIME NULL,
            inscricoes_fim DATETIME NULL,
            data_prova DATETIME NULL,
            resultado_data DATETIME NULL,
            vagas_total INT NULL,
            cadastro_reserva_total INT NULL,
            url_oficial VARCHAR(500) NULL,
            status_editorial VARCHAR(30) NOT NULL DEFAULT 'draft',
            visibility_status VARCHAR(30) NOT NULL DEFAULT 'public',
            scheduled_at DATETIME NULL,
            metadata_json JSON NULL,
            archived_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_slug_year (slug, ano),
            INDEX idx_provas_ano (ano),
            INDEX idx_provas_status (status_editorial)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->ensureColumn('provas', 'titulo_oficial', "titulo_oficial VARCHAR(255) NULL AFTER nome");
        $this->ensureColumn('provas', 'nome_curto', "nome_curto VARCHAR(180) NULL AFTER titulo_oficial");
        $this->ensureColumn('provas', 'edital_numero', "edital_numero VARCHAR(80) NULL AFTER slug");
        $this->ensureColumn('provas', 'carreira_id', "carreira_id INT NULL AFTER tipo_prova_id");
        $this->ensureColumn('provas', 'area_id', "area_id INT NULL AFTER carreira_id");
        $this->ensureColumn('provas', 'inscricoes_inicio', "inscricoes_inicio DATETIME NULL AFTER edital_numero");
        $this->ensureColumn('provas', 'inscricoes_fim', "inscricoes_fim DATETIME NULL AFTER inscricoes_inicio");
        $this->ensureColumn('provas', 'data_prova', "data_prova DATETIME NULL AFTER inscricoes_fim");
        $this->ensureColumn('provas', 'resultado_data', "resultado_data DATETIME NULL AFTER data_prova");
        $this->ensureColumn('provas', 'vagas_total', "vagas_total INT NULL AFTER resultado_data");
        $this->ensureColumn('provas', 'cadastro_reserva_total', "cadastro_reserva_total INT NULL AFTER vagas_total");
        $this->ensureColumn('provas', 'url_oficial', "url_oficial VARCHAR(500) NULL AFTER cadastro_reserva_total");
        $this->ensureColumn('provas', 'status_editorial', "status_editorial VARCHAR(30) NOT NULL DEFAULT 'draft' AFTER url_oficial");
        $this->ensureColumn('provas', 'visibility_status', "visibility_status VARCHAR(30) NOT NULL DEFAULT 'public' AFTER status_editorial");
        $this->ensureColumn('provas', 'scheduled_at', "scheduled_at DATETIME NULL AFTER visibility_status");
        $this->ensureColumn('provas', 'metadata_json', "metadata_json JSON NULL AFTER scheduled_at");
        $this->ensureColumn('provas', 'archived_at', "archived_at DATETIME NULL AFTER metadata_json");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_filters (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prova_id INT NOT NULL,
            filter_id INT NOT NULL,
            role VARCHAR(40) NULL,
            context_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_prova_filter_role (prova_id, filter_id, role),
            INDEX idx_prova_filters_prova (prova_id),
            INDEX idx_prova_filters_filter (filter_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_cargo_detalhes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prova_id INT NOT NULL,
            cargo_filter_id INT NULL,
            nome VARCHAR(255) NOT NULL,
            remuneracao VARCHAR(255) NULL,
            carga_horaria VARCHAR(120) NULL,
            escolaridade VARCHAR(180) NULL,
            metadata_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_prova_cargo_detalhes_prova (prova_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_cargo_requisitos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prova_id INT NOT NULL,
            cargo_detalhe_id BIGINT UNSIGNED NULL,
            requisito TEXT NOT NULL,
            ordem INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prova_cargo_requisitos_prova (prova_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_cargo_vagas (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prova_id INT NOT NULL,
            cargo_detalhe_id BIGINT UNSIGNED NULL,
            ampla INT NOT NULL DEFAULT 0,
            pcd INT NOT NULL DEFAULT 0,
            cotas INT NOT NULL DEFAULT 0,
            cadastro_reserva INT NOT NULL DEFAULT 0,
            descricao VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prova_cargo_vagas_prova (prova_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_cadernos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prova_id INT NOT NULL,
            nome VARCHAR(180) NOT NULL,
            tipo VARCHAR(80) NULL,
            cor VARCHAR(80) NULL,
            ordem INT NOT NULL DEFAULT 0,
            metadata_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_prova_caderno_nome (prova_id, nome),
            INDEX idx_prova_cadernos_prova (prova_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_caderno_cargos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            caderno_id BIGINT UNSIGNED NOT NULL,
            cargo_filter_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_caderno_cargo (caderno_id, cargo_filter_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_caderno_filters (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            caderno_id BIGINT UNSIGNED NOT NULL,
            filter_id INT NOT NULL,
            role VARCHAR(40) NULL,
            ordem INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_caderno_filter_role (caderno_id, filter_id, role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_arquivos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prova_id INT NOT NULL,
            tipo ENUM('edital', 'prova', 'gabarito', 'outro') NOT NULL,
            nome_original VARCHAR(255) NOT NULL,
            caminho VARCHAR(500) NOT NULL,
            mime_type VARCHAR(120) NULL,
            tamanho BIGINT UNSIGNED NULL,
            versao INT NOT NULL DEFAULT 1,
            visibility_status VARCHAR(30) NOT NULL DEFAULT 'public',
            uploaded_by_user_id VARCHAR(64) NULL,
            metadata_json JSON NULL,
            archived_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_prova_arquivos_prova (prova_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $this->ensureColumn('prova_arquivos', 'versao', "versao INT NOT NULL DEFAULT 1 AFTER tamanho");
        $this->ensureColumn('prova_arquivos', 'visibility_status', "visibility_status VARCHAR(30) NOT NULL DEFAULT 'public' AFTER versao");
        $this->ensureColumn('prova_arquivos', 'uploaded_by_user_id', "uploaded_by_user_id VARCHAR(64) NULL AFTER visibility_status");
        $this->ensureColumn('prova_arquivos', 'archived_at', "archived_at DATETIME NULL AFTER metadata_json");
        $this->ensureColumn('prova_arquivos', 'updated_at', "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");

        $this->db->exec("CREATE TABLE IF NOT EXISTS question_provas (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            question_id INT NOT NULL,
            prova_id INT NOT NULL,
            caderno_id BIGINT UNSIGNED NULL,
            numero_na_prova INT NULL,
            metadata_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_question_prova_caderno (question_id, prova_id, caderno_id),
            INDEX idx_question_provas_question (question_id),
            INDEX idx_question_provas_prova (prova_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->db->exec("CREATE TABLE IF NOT EXISTS prova_extracoes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prova_id INT NULL,
            arquivo_id BIGINT UNSIGNED NULL,
            origem ENUM('edital', 'prova', 'gabarito', 'manual') NOT NULL,
            status ENUM('pending', 'processing', 'review', 'done', 'failed') NOT NULL DEFAULT 'pending',
            parser_profile VARCHAR(80) NULL,
            extracted_json JSON NULL,
            review_json JSON NULL,
            error_message TEXT NULL,
            created_by VARCHAR(64) NULL,
            reviewed_by VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_prova_extracoes_prova (prova_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        try {
            $this->db->exec("INSERT IGNORE INTO question_provas (question_id, prova_id, numero_na_prova)
                SELECT
                    id,
                    prova_id,
                    CASE
                        WHEN source_question_number REGEXP '^[0-9]+$'
                        THEN CAST(source_question_number AS UNSIGNED)
                        ELSE NULL
                    END
                FROM questions
                WHERE prova_id IS NOT NULL AND prova_id > 0");
        } catch (Throwable $exception) {
            error_log('[exam_bank_question_provas_backfill] ' . $exception->getMessage());
        }
    }

    private function ensureColumn(string $table, string $column, string $definition): void
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM {$table} LIKE :column_name");
        $stmt->execute([':column_name' => $column]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            $this->db->exec("ALTER TABLE {$table} ADD COLUMN {$definition}");
        }
    }

    public function list(array $filters = []): array
    {
        $this->ensureSchema();
        $search = trim((string) ($filters['search'] ?? ''));
        $includeArchived = filter_var($filters['include_archived'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $params = [];
        $where = [];

        if (!$includeArchived) {
            $where[] = 'p.archived_at IS NULL';
        }

        if ($search !== '') {
            $where[] = '(p.nome LIKE :search OR p.titulo_oficial LIKE :search OR p.nome_curto LIKE :search OR p.slug LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $query = "SELECT p.*, COUNT(DISTINCT qp.question_id) AS question_count
            FROM provas p
            LEFT JOIN question_provas qp ON qp.prova_id = p.id";
        if ($where) {
            $query .= ' WHERE ' . implode(' AND ', $where);
        }
        $query .= ' GROUP BY p.id ORDER BY COALESCE(p.ano, 0) DESC, p.nome ASC';

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $this->hydrateMany($rows);
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

    public function save(array $payload, string $userId): array
    {
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
            'status_editorial' => $this->limitString((string) ($payload['publishStatus'] ?? $payload['statusEditorial'] ?? $payload['status_editorial'] ?? 'published'), 30),
            'visibility_status' => $this->limitString((string) ($payload['visibilityStatus'] ?? $payload['visibility_status'] ?? 'public'), 30),
            'scheduled_at' => $this->nullableDate($payload['scheduledAt'] ?? $payload['scheduled_at'] ?? null),
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
        $stmt = $this->db->prepare("SELECT pf.prova_id, pf.role, f.id, f.type, f.name, f.slug, f.parent_id, f.taxonomy_level, f.meta_materia
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
            'ano' => $row['ano'] !== null ? (int) $row['ano'] : 0,
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
