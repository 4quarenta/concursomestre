<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';
require_once __DIR__ . '/../../seo/sitemaps/StaticSitemapMutationInvalidator.php';

/**
 * Consolida taxonomias lidas pela extensao Gran no navegador.
 *
 * Credenciais nunca chegam a este service. A extensao entrega somente a pagina
 * JSON de uma rota conhecida, e a identidade externa permanece separada do ID
 * local da plataforma.
 */
final class AdminGranTaxonomySyncService
{
    private const PROVIDER = 'gran';
    private const PUBLIC_SUBJECT_CATALOG_URL = 'https://rota-api.grancursosonline.com.br/open/elastic/assunto';
    private const MAX_PUBLIC_CATALOG_BYTES = 4_000_000;
    private const MAX_PUBLIC_SUBJECT_IDS_PER_REQUEST = 250;
    private const MAX_HIERARCHY_RECOVERY_ROUNDS = 12;

    /** @var array<string, array{filterType:string,entityType:string,perPage:int}> */
    private const KINDS = [
        'assunto_tree' => ['filterType' => 'assunto', 'entityType' => 'assunto', 'perPage' => 1000],
        'assunto' => ['filterType' => 'assunto', 'entityType' => 'assunto', 'perPage' => 1000],
        'banca' => ['filterType' => 'banca', 'entityType' => 'banca', 'perPage' => 1000],
        'orgao' => ['filterType' => 'orgao', 'entityType' => 'orgao', 'perPage' => 1000],
        'cargo' => ['filterType' => 'cargo', 'entityType' => 'cargo', 'perPage' => 1000],
        'carreira' => ['filterType' => 'carreira', 'entityType' => 'carreira', 'perPage' => 1000],
        // Na Gran, area e o foco de estudo. O tipo local carreira e o foco.
        'area' => ['filterType' => 'carreira', 'entityType' => 'area', 'perPage' => 1000],
    ];

    private readonly PDO $db;

    /** @var null|callable(list<string>):array<string, mixed> */
    private $publicCatalogFetcher;

    public function __construct(PDO $db, ?callable $publicCatalogFetcher = null)
    {
        $this->db = $db;
        $this->publicCatalogFetcher = $publicCatalogFetcher;
    }

    /**
     * Retorna o estado canônico dos catálogos importados da Gran.
     *
     * O status é baseado na identidade externa persistida, e não apenas na
     * existência de filtros locais com o mesmo nome. Isso permite que a UI
     * diferencie um catálogo já sincronizado de uma taxonomia criada apenas
     * manualmente no painel.
     *
     * @return array<string, array{filterType:string,records:int,metadataRecords:int,pending:int,synchronized:bool,ready:bool}>
     */
    public function getStatus(): array
    {
        /** @var array<string, string> $entityTypes */
        $entityTypes = [];
        foreach (self::KINDS as $config) {
            $entityTypes[$config['entityType']] = $config['filterType'];
        }

        $status = [];
        foreach ($entityTypes as $entityType => $filterType) {
            $status[$entityType] = [
                'filterType' => $filterType,
                'records' => 0,
                'metadataRecords' => 0,
                'pending' => 0,
                'synchronized' => false,
                'ready' => false,
            ];
        }

        $placeholders = implode(', ', array_fill(0, count($entityTypes), '?'));
        $stmt = $this->db->prepare(
            "SELECT identity.source_entity_type,
                    COUNT(*) AS records,
                    SUM(CASE
                        WHEN identity.source_metadata_json IS NOT NULL
                         AND JSON_LENGTH(identity.source_metadata_json) > 1 THEN 1
                        ELSE 0
                    END) AS metadata_records,
                    SUM(CASE
                        WHEN identity.source_entity_type = 'assunto' AND filters.taxonomy_level = 'pending' THEN 1
                        WHEN identity.source_entity_type = 'cargo' AND filters.parent_id IS NULL THEN 1
                        ELSE 0
                    END) AS pending
             FROM filter_source_identities identity
             INNER JOIN filters ON filters.id = identity.filter_id
             WHERE identity.source_provider = ?
               AND identity.source_entity_type IN ({$placeholders})
             GROUP BY identity.source_entity_type"
        );
        $stmt->execute(array_merge([self::PROVIDER], array_keys($entityTypes)));

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $entityType = strtolower(trim((string) ($row['source_entity_type'] ?? '')));
            if (!isset($status[$entityType])) {
                continue;
            }

            $records = max(0, (int) ($row['records'] ?? 0));
            $pending = max(0, (int) ($row['pending'] ?? 0));
            $status[$entityType]['records'] = $records;
            $status[$entityType]['metadataRecords'] = max(0, (int) ($row['metadata_records'] ?? 0));
            $status[$entityType]['pending'] = $pending;
            $status[$entityType]['synchronized'] = $records > 0;
            $status[$entityType]['ready'] = $records > 0 && $pending === 0;
        }

        foreach ($this->getManifestRows() as $manifestKind => $manifest) {
            $entityType = self::KINDS[$manifestKind]['entityType'] ?? $manifestKind;
            if (!isset($status[$entityType])) continue;
            $changed = $this->manifestChanged($manifest);
            $status[$entityType]['remoteTotal'] = (int) ($manifest['remote_total'] ?? 0);
            $status[$entityType]['remoteIndexSignature'] = $manifest['remote_index_signature'] ?? null;
            $status[$entityType]['remoteUpdatedAt'] = $manifest['remote_updated_at'] ?? null;
            $status[$entityType]['checkedAt'] = $manifest['checked_at'] ?? null;
            $status[$entityType]['syncedAt'] = $manifest['synced_at'] ?? null;
            $status[$entityType]['updateAvailable'] = !empty($status[$entityType]['updateAvailable'])
                || $changed || $status[$entityType]['pending'] > 0;
            $status[$entityType]['manifests'][$manifestKind] = [
                'remoteTotal' => (int) ($manifest['remote_total'] ?? 0),
                'changed' => $changed,
                'checkedAt' => $manifest['checked_at'] ?? null,
                'syncedAt' => $manifest['synced_at'] ?? null,
            ];
        }

        return $status;
    }

    /**
     * Persiste somente o manifesto remoto. Nenhuma taxonomia e alterada aqui.
     *
     * @param array<int,array<string,mixed>> $manifests
     * @return array<string,array<string,mixed>>
     */
    public function compareUpdateManifests(array $manifests): array
    {
        $this->assertManifestSchemaReady();
        $upsert = $this->db->prepare(
            'INSERT INTO gran_taxonomy_sync_manifests
             (taxonomy_kind, remote_total, remote_index_signature, remote_updated_at, remote_fingerprint, checked_at)
             VALUES (:kind, :total, :index_signature, :updated_at, :fingerprint, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE remote_total = VALUES(remote_total),
             remote_index_signature = VALUES(remote_index_signature), remote_updated_at = VALUES(remote_updated_at),
             remote_fingerprint = VALUES(remote_fingerprint), checked_at = UTC_TIMESTAMP()'
        );
        foreach ($manifests as $manifest) {
            if (!is_array($manifest)) continue;
            $kind = strtolower(trim((string) ($manifest['taxonomyKind'] ?? $manifest['kind'] ?? '')));
            if (!isset(self::KINDS[$kind])) {
                throw new InvalidArgumentException('Manifesto de taxonomia Gran invalido.');
            }
            $total = max(0, (int) ($manifest['total'] ?? 0));
            $indexSignature = substr(trim((string) ($manifest['indexSignature'] ?? '')), 0, 255) ?: null;
            $updatedAt = substr(trim((string) ($manifest['updatedAt'] ?? '')), 0, 80) ?: null;
            $fingerprint = strtolower(trim((string) ($manifest['fingerprint'] ?? '')));
            if (preg_match('/^[a-f0-9]{64}$/', $fingerprint) !== 1) {
                $fingerprint = hash('sha256', json_encode([$kind, $total, $indexSignature, $updatedAt]));
            }
            $upsert->execute([
                ':kind' => $kind,
                ':total' => $total,
                ':index_signature' => $indexSignature,
                ':updated_at' => $updatedAt,
                ':fingerprint' => $fingerprint,
            ]);
        }
        return $this->getStatus();
    }

    public function markManifestSynchronized(string $kind): array
    {
        $this->assertManifestSchemaReady();
        $kind = strtolower(trim($kind));
        if (!isset(self::KINDS[$kind])) throw new InvalidArgumentException('Taxonomia Gran invalida.');
        $stmt = $this->db->prepare(
            'UPDATE gran_taxonomy_sync_manifests SET synced_total = remote_total,
             synced_index_signature = remote_index_signature, synced_updated_at = remote_updated_at,
             synced_fingerprint = remote_fingerprint, synced_at = UTC_TIMESTAMP()
             WHERE taxonomy_kind = :kind'
        );
        $stmt->execute([':kind' => $kind]);
        return $this->getStatus();
    }

    /** @return array<string,array<string,mixed>> */
    private function getManifestRows(): array
    {
        $this->assertManifestSchemaReady();
        $rows = [];
        $stmt = $this->db->query('SELECT * FROM gran_taxonomy_sync_manifests');
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $rows[(string) $row['taxonomy_kind']] = $row;
        }
        return $rows;
    }

    private function manifestChanged(array $row): bool
    {
        $synced = trim((string) ($row['synced_fingerprint'] ?? ''));
        $remote = trim((string) ($row['remote_fingerprint'] ?? ''));
        return $synced === '' || $remote === '' || !hash_equals($synced, $remote);
    }

    private function assertManifestSchemaReady(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'manifestos das taxonomias Gran', [
            'gran_taxonomy_sync_manifests' => [
                'taxonomy_kind', 'remote_total', 'remote_fingerprint', 'synced_fingerprint',
                'checked_at', 'synced_at',
            ],
        ]);
    }

    /**
     * Retorna as raizes que ainda nao chegaram da arvore oficial da Gran.
     *
     * O nome do assunto pode ter sido sincronizado pelo catalogo plano, mas a
     * relacao materia -> topico -> assunto so e segura quando a cadeia de pais
     * tambem existe localmente. Toda raiz associada a um item pendente entra
     * na recuperacao, inclusive quando o pai direto tambem esta pendente.
     *
     * @return list<string>
     */
    public function getMissingSubjectRootExternalIds(int $limit = 5000): array
    {
        return $this->getMissingSubjectReferences(['source_root_external_id'], $limit);
    }

    /**
     * Retorna somente os pais e raizes realmente ausentes da arvore local.
     * Filhos pendentes cujo pai ja existe nao geram nova consulta externa.
     *
     * @return list<string>
     */
    public function getMissingSubjectHierarchyExternalIds(int $limit = 5000): array
    {
        return $this->getMissingSubjectReferences([
            'source_parent_external_id',
            'source_root_external_id',
        ], $limit);
    }

    /**
     * @param list<'source_parent_external_id'|'source_root_external_id'> $columns
     * @return list<string>
     */
    private function getMissingSubjectReferences(array $columns, int $limit): array
    {
        $allowedColumns = ['source_parent_external_id', 'source_root_external_id'];
        $columns = array_values(array_unique(array_filter(
            $columns,
            static fn (string $column): bool => in_array($column, $allowedColumns, true)
        )));
        if ($columns === []) {
            return [];
        }

        $limit = max(1, min(5000, $limit));
        $stmt = $this->db->query(
            'SELECT ' . implode(', ', $columns) . "
             FROM filters
             WHERE type = 'assunto'
               AND source_provider = 'gran'
               AND source_entity_type = 'assunto'
               AND taxonomy_level = 'pending'"
        );
        $candidates = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            foreach ($columns as $column) {
                $externalId = $this->readExternalId($row[$column] ?? null);
                if ($externalId !== null) {
                    $candidates[$externalId] = $externalId;
                }
            }
        }
        if ($candidates === []) {
            return [];
        }

        $existing = [];
        foreach (array_chunk(array_values($candidates), 500) as $chunk) {
            $placeholders = implode(', ', array_fill(0, count($chunk), '?'));
            $existingStmt = $this->db->prepare(
                "SELECT source_external_id
                 FROM filters
                 WHERE type = 'assunto'
                   AND source_provider = 'gran'
                   AND source_entity_type = 'assunto'
                   AND source_external_id IN ({$placeholders})"
            );
            $existingStmt->execute($chunk);
            foreach ($existingStmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $externalId) {
                $normalized = $this->readExternalId($externalId);
                if ($normalized !== null) {
                    $existing[$normalized] = true;
                }
            }

            $identityStmt = $this->db->prepare(
                "SELECT source_external_id
                 FROM filter_source_identities
                 WHERE filter_type = 'assunto'
                   AND source_provider = 'gran'
                   AND source_entity_type = 'assunto'
                   AND source_external_id IN ({$placeholders})"
            );
            $identityStmt->execute($chunk);
            foreach ($identityStmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $externalId) {
                $normalized = $this->readExternalId($externalId);
                if ($normalized !== null) {
                    $existing[$normalized] = true;
                }
            }
        }

        $missing = array_values(array_filter(
            $candidates,
            static fn (string $externalId): bool => !isset($existing[$externalId])
        ));
        usort($missing, static fn (string $left, string $right): int => strnatcmp($left, $right));
        return array_slice($missing, 0, $limit);
    }

    /**
     * @return array{kind:string,processed:int,created:int,updated:int,pending:int,pages:int,total:int}
     */
    public function syncChunk(string $kind, array $granResponse): array
    {
        StaticSitemapMutationInvalidator::invalidate('FILTER_IMPORT_MUTATION');
        $kind = strtolower(trim($kind));
        $config = self::KINDS[$kind] ?? null;
        if ($config === null) {
            throw new InvalidArgumentException('Tipo de taxonomia Gran invalido.');
        }

        $records = $kind === 'assunto_tree'
            ? $this->flattenSubjectTree($this->extractRows($granResponse))
            : $this->normalizeFlatRecords($this->extractRows($granResponse));
        $pagination = $this->readPagination($granResponse, $config['perPage']);
        if ($records === []) {
            return [
                'kind' => $kind,
                'processed' => 0,
                'created' => 0,
                'updated' => 0,
                'pending' => 0,
                'pages' => $pagination['pages'],
                'total' => $pagination['total'],
            ];
        }

        $created = 0;
        $updated = 0;
        $pending = 0;
        $this->db->beginTransaction();
        try {
            foreach ($records as $record) {
                $result = $this->upsert($config, $record);
                $created += $result['created'] ? 1 : 0;
                $updated += $result['created'] ? 0 : 1;
                $pending += $result['pending'] ? 1 : 0;
            }
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        return [
            'kind' => $kind,
            'processed' => count($records),
            'created' => $created,
            'updated' => $updated,
            'pending' => $pending,
            'pages' => $pagination['pages'],
            'total' => $pagination['total'],
        ];
    }

    /**
     * Consolida varias paginas em uma unica operacao HTTP administrativa.
     *
     * @param list<array<string, mixed>> $granResponses
     * @return array{kind:string,processed:int,created:int,updated:int,pending:int,pages:int,total:int}
     */
    public function syncBatch(string $kind, array $granResponses, bool $finalizeRelations = true): array
    {
        if ($granResponses === [] || count($granResponses) > 500) {
            throw new InvalidArgumentException('Lote de paginas de taxonomia invalido.');
        }

        $summary = [
            'kind' => strtolower(trim($kind)),
            'processed' => 0,
            'created' => 0,
            'updated' => 0,
            'pending' => 0,
            'pages' => 0,
            'total' => 0,
        ];
        foreach ($granResponses as $granResponse) {
            if (!is_array($granResponse)) {
                throw new InvalidArgumentException('Uma pagina do lote de taxonomias e invalida.');
            }
            $result = $this->syncChunk($kind, $granResponse);
            $summary['processed'] += $result['processed'];
            $summary['created'] += $result['created'];
            $summary['updated'] += $result['updated'];
            $summary['pending'] += $result['pending'];
            $summary['pages']++;
            $summary['total'] = max($summary['total'], $result['total']);
        }

        if ($finalizeRelations && in_array($summary['kind'], ['cargo', 'carreira', 'area', 'orgao'], true)) {
            $cargoRelations = $this->finalizeCargoRelations();
            if ($summary['kind'] === 'cargo') {
                $summary['pending'] = $cargoRelations['pending'];
            }
        }

        return $summary;
    }

    /** @return array{resolved:int,pending:int,total:int,careerLinks:int,organizationLinks:int,levelLinks:int} */
    public function finalizeCargoRelations(): array
    {
        $cursor = 0;
        $summary = [
            'resolved' => 0,
            'pending' => 0,
            'total' => 0,
            'careerLinks' => 0,
            'organizationLinks' => 0,
            'levelLinks' => 0,
        ];

        do {
            $chunk = $this->finalizeCargoRelationsChunk($cursor, 1000);
            $summary['resolved'] += $chunk['resolved'];
            $summary['careerLinks'] += $chunk['careerLinks'];
            $summary['organizationLinks'] += $chunk['organizationLinks'];
            $summary['levelLinks'] += $chunk['levelLinks'];
            $summary['pending'] = $chunk['pending'];
            $summary['total'] = $chunk['total'];
            $nextCursor = $chunk['nextCursor'];
            if ($chunk['hasMore'] && ($nextCursor === null || $nextCursor <= $cursor)) {
                throw new RuntimeException('A reconciliacao de cargos nao avancou para o proximo lote.');
            }
            $cursor = $nextCursor ?? $cursor;
        } while ($chunk['hasMore']);

        return $summary;
    }

    /**
     * Reconcilia um intervalo pequeno e reentrante de cargos. O cursor evita
     * manter uma requisicao HTTP aberta durante todo o catalogo, o que excede
     * o limite do proxy mesmo quando PHP e Nginx aceitam timeouts maiores.
     *
     * @return array{
     *   processed:int,resolved:int,pending:int,total:int,careerLinks:int,
     *   organizationLinks:int,levelLinks:int,nextCursor:?int,hasMore:bool
     * }
     */
    public function finalizeCargoRelationsChunk(
        int $afterFilterId = 0,
        int $limit = 1000,
        bool $pendingOnly = false
    ): array
    {
        $afterFilterId = max(0, $afterFilterId);
        $limit = max(1, min(2000, $limit));
        $candidateLimit = $limit + 1;
        $pendingCondition = $pendingOnly ? ' AND cargo.parent_id IS NULL' : '';
        $candidateRows = $this->db->query(
            "SELECT cargo_identity.filter_id
             FROM filter_source_identities cargo_identity
             INNER JOIN filters cargo
                ON cargo.id = cargo_identity.filter_id
               AND cargo.type = 'cargo'
             WHERE cargo_identity.filter_type = 'cargo'
               AND cargo_identity.source_provider = 'gran'
               AND cargo_identity.source_entity_type = 'cargo'
               AND cargo_identity.filter_id > {$afterFilterId}
               {$pendingCondition}
             ORDER BY cargo_identity.filter_id ASC
             LIMIT {$candidateLimit}"
        )->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $hasMore = count($candidateRows) > $limit;
        $cargoFilterIds = array_values(array_map(
            'intval',
            array_slice($candidateRows, 0, $limit)
        ));
        $counts = $this->readCargoRelationCounts();
        if ($cargoFilterIds === []) {
            return [
                'processed' => 0,
                'resolved' => 0,
                'pending' => $counts['pending'],
                'total' => $counts['total'],
                'careerLinks' => 0,
                'organizationLinks' => 0,
                'levelLinks' => 0,
                'nextCursor' => null,
                'hasMore' => false,
            ];
        }

        $idList = implode(',', $cargoFilterIds);
        $this->ensureCargoLevelFilters($cargoFilterIds);

        // MySQL cannot reopen the same TEMPORARY table under another alias in
        // test fixtures. Materialize only the target catalogs required by the
        // current chunk instead of copying every cargo identity on each pass.
        $this->db->exec('DROP TEMPORARY TABLE IF EXISTS tmp_gran_cargo_primary_career');
        $this->db->exec('DROP TEMPORARY TABLE IF EXISTS tmp_gran_filter_identity_map');
        try {
            $this->db->exec(
                "CREATE TEMPORARY TABLE tmp_gran_filter_identity_map
                 ENGINE=InnoDB
                 AS
                 SELECT filter_id, filter_type, source_entity_type, source_external_id
                 FROM filter_source_identities
                 WHERE source_provider = 'gran'
                   AND source_entity_type IN ('carreira', 'orgao')"
            );
            $this->db->exec(
                'CREATE INDEX idx_tmp_gran_identity_lookup
                 ON tmp_gran_filter_identity_map (
                    filter_type, source_entity_type, source_external_id
                 )'
            );

            // A Gran ordena as carreiras por relevancia, mas o primeiro ID
            // pode nao existir no catalogo sincronizado. Materialize a primeira
            // carreira realmente disponivel sem perder a ordem da origem.
            $this->db->exec(
                "CREATE TEMPORARY TABLE tmp_gran_cargo_primary_career
                 ENGINE=InnoDB
                 AS
                 SELECT ranked.cargo_filter_id,
                        ranked.root_filter_id,
                        ranked.root_external_id
                 FROM (
                    SELECT cargo_identity.filter_id AS cargo_filter_id,
                           root_identity.filter_id AS root_filter_id,
                           root_identity.source_external_id AS root_external_id,
                           ROW_NUMBER() OVER (
                              PARTITION BY cargo_identity.filter_id
                              ORDER BY career_reference.ordinal ASC
                           ) AS career_rank
                    FROM filter_source_identities cargo_identity
                    INNER JOIN JSON_TABLE(
                       COALESCE(cargo_identity.source_metadata_json, JSON_OBJECT()),
                       '$.careerExternalIds[*]' COLUMNS (
                          ordinal FOR ORDINALITY,
                          external_id VARCHAR(120) PATH '$'
                       )
                    ) career_reference ON TRUE
                    INNER JOIN tmp_gran_filter_identity_map root_identity
                       ON root_identity.filter_type = 'carreira'
                      AND root_identity.source_entity_type = 'carreira'
                      AND CAST(root_identity.source_external_id AS BINARY) =
                          CAST(career_reference.external_id AS BINARY)
                    WHERE cargo_identity.filter_type = 'cargo'
                      AND cargo_identity.source_provider = 'gran'
                      AND cargo_identity.source_entity_type = 'cargo'
                      AND cargo_identity.filter_id IN ({$idList})
                 ) ranked
                 WHERE ranked.career_rank = 1"
            );
            $this->db->exec(
                'CREATE UNIQUE INDEX idx_tmp_gran_cargo_primary
                 ON tmp_gran_cargo_primary_career (cargo_filter_id)'
            );
            // Alguns cargos da propria Gran nao possuem a chave carreiras.
            // Nesses casos, use a carreira oficial "Outras" (ID externo 28)
            // em vez de manter uma falsa pendencia ou inferir outra carreira.
            $this->db->exec(
                "INSERT IGNORE INTO tmp_gran_cargo_primary_career (
                    cargo_filter_id, root_filter_id, root_external_id
                 )
                 SELECT cargo_identity.filter_id,
                        fallback_identity.filter_id,
                        fallback_identity.source_external_id
                 FROM filter_source_identities cargo_identity
                 INNER JOIN tmp_gran_filter_identity_map fallback_identity
                    ON fallback_identity.filter_type = 'carreira'
                   AND fallback_identity.source_entity_type = 'carreira'
                   AND fallback_identity.source_external_id = '28'
                 WHERE cargo_identity.filter_type = 'cargo'
                   AND cargo_identity.source_provider = 'gran'
                   AND cargo_identity.source_entity_type = 'cargo'
                   AND cargo_identity.filter_id IN ({$idList})
                   AND JSON_LENGTH(
                      COALESCE(
                         JSON_EXTRACT(cargo_identity.source_metadata_json, '$.careerExternalIds'),
                         JSON_ARRAY()
                      )
                   ) = 0"
            );

            $this->db->exec(
                "DELETE FROM filter_relationships
                 WHERE source_provider = 'gran'
                   AND relation_type IN ('cargo_career', 'cargo_organization', 'cargo_level')
                   AND source_filter_id IN ({$idList})"
            );

            $careerLinks = $this->db->exec(
                "INSERT IGNORE INTO filter_relationships (
                    source_filter_id, target_filter_id, relation_type, source_provider
                 )
                 SELECT DISTINCT cargo_identity.filter_id, root_identity.filter_id, 'cargo_career', 'gran'
                 FROM filter_source_identities cargo_identity
                 INNER JOIN JSON_TABLE(
                    COALESCE(cargo_identity.source_metadata_json, JSON_OBJECT()),
                    '$.careerExternalIds[*]' COLUMNS (external_id VARCHAR(120) PATH '$')
                 ) career_reference ON TRUE
                 INNER JOIN tmp_gran_filter_identity_map root_identity
                    ON root_identity.filter_type = 'carreira'
                   AND root_identity.source_entity_type = 'carreira'
                   AND CAST(root_identity.source_external_id AS BINARY) =
                       CAST(career_reference.external_id AS BINARY)
                 WHERE cargo_identity.filter_type = 'cargo'
                   AND cargo_identity.source_provider = 'gran'
                   AND cargo_identity.source_entity_type = 'cargo'
                   AND cargo_identity.filter_id IN ({$idList})"
            );
            $careerLinks += $this->db->exec(
                "INSERT IGNORE INTO filter_relationships (
                    source_filter_id, target_filter_id, relation_type, source_provider
                 )
                 SELECT primary_career.cargo_filter_id,
                        primary_career.root_filter_id,
                        'cargo_career',
                        'gran'
                 FROM tmp_gran_cargo_primary_career primary_career
                 INNER JOIN filter_source_identities cargo_identity
                    ON cargo_identity.filter_id = primary_career.cargo_filter_id
                   AND cargo_identity.filter_type = 'cargo'
                   AND cargo_identity.source_provider = 'gran'
                   AND cargo_identity.source_entity_type = 'cargo'
                 WHERE JSON_LENGTH(
                    COALESCE(
                       JSON_EXTRACT(cargo_identity.source_metadata_json, '$.careerExternalIds'),
                       JSON_ARRAY()
                    )
                 ) = 0"
            );

            $organizationLinks = $this->db->exec(
                "INSERT IGNORE INTO filter_relationships (
                    source_filter_id, target_filter_id, relation_type, source_provider
                 )
                 SELECT DISTINCT cargo_identity.filter_id, organization_identity.filter_id,
                        'cargo_organization', 'gran'
                 FROM filter_source_identities cargo_identity
                 INNER JOIN JSON_TABLE(
                    COALESCE(cargo_identity.source_metadata_json, JSON_OBJECT()),
                    '$.organizationExternalIds[*]' COLUMNS (external_id VARCHAR(120) PATH '$')
                 ) organization_reference ON TRUE
                 INNER JOIN tmp_gran_filter_identity_map organization_identity
                    ON organization_identity.filter_type = 'orgao'
                   AND organization_identity.source_entity_type = 'orgao'
                   AND CAST(organization_identity.source_external_id AS BINARY) =
                       CAST(organization_reference.external_id AS BINARY)
                 WHERE cargo_identity.filter_type = 'cargo'
                   AND cargo_identity.source_provider = 'gran'
                   AND cargo_identity.source_entity_type = 'cargo'
                   AND cargo_identity.filter_id IN ({$idList})"
            );

            $levelLinks = $this->db->exec(
                "INSERT IGNORE INTO filter_relationships (
                    source_filter_id, target_filter_id, relation_type, source_provider
                 )
                 SELECT DISTINCT cargo_identity.filter_id, level_filter.id, 'cargo_level', 'gran'
                 FROM filter_source_identities cargo_identity
                 INNER JOIN JSON_TABLE(
                    COALESCE(cargo_identity.source_metadata_json, JSON_OBJECT()),
                    '$.levels[*]' COLUMNS (label VARCHAR(255) PATH '$')
                 ) level_reference ON TRUE
                 INNER JOIN filters level_filter
                    ON level_filter.type = 'nivel'
                   AND CAST(level_filter.name AS BINARY) = CAST(level_reference.label AS BINARY)
                 WHERE cargo_identity.filter_type = 'cargo'
                   AND cargo_identity.source_provider = 'gran'
                   AND cargo_identity.source_entity_type = 'cargo'
                   AND cargo_identity.filter_id IN ({$idList})"
            );

            $resolved = $this->db->exec(
                "UPDATE filters cargo
                 INNER JOIN tmp_gran_cargo_primary_career primary_career
                    ON primary_career.cargo_filter_id = cargo.id
                 SET cargo.parent_id = primary_career.root_filter_id,
                     cargo.source_parent_external_id = primary_career.root_external_id,
                     cargo.source_root_external_id = primary_career.root_external_id
                 WHERE cargo.type = 'cargo'
                   AND cargo.id IN ({$idList})
                   AND (
                      cargo.parent_id IS NULL
                      OR cargo.parent_id <> primary_career.root_filter_id
                   )"
            );
        } finally {
            $this->db->exec('DROP TEMPORARY TABLE IF EXISTS tmp_gran_cargo_primary_career');
            $this->db->exec('DROP TEMPORARY TABLE IF EXISTS tmp_gran_filter_identity_map');
        }

        $counts = $this->readCargoRelationCounts();
        return [
            'processed' => count($cargoFilterIds),
            'resolved' => max(0, (int) $resolved),
            'pending' => $counts['pending'],
            'total' => $counts['total'],
            'careerLinks' => max(0, (int) $careerLinks),
            'organizationLinks' => max(0, (int) $organizationLinks),
            'levelLinks' => max(0, (int) $levelLinks),
            'nextCursor' => max($cargoFilterIds),
            'hasMore' => $hasMore,
        ];
    }

    /** @return array{pending:int,total:int} */
    private function readCargoRelationCounts(): array
    {
        $counts = $this->db->query(
            "SELECT COUNT(DISTINCT cargo.id) AS total,
                    COUNT(DISTINCT CASE WHEN cargo.parent_id IS NULL THEN cargo.id END) AS pending
             FROM filters cargo
             INNER JOIN filter_source_identities cargo_identity
                ON cargo_identity.filter_id = cargo.id
               AND cargo_identity.filter_type = 'cargo'
               AND cargo_identity.source_provider = 'gran'
               AND cargo_identity.source_entity_type = 'cargo'
             WHERE cargo.type = 'cargo'"
        )->fetch(PDO::FETCH_ASSOC);

        return [
            'pending' => max(0, (int) ($counts['pending'] ?? 0)),
            'total' => max(0, (int) ($counts['total'] ?? 0)),
        ];
    }

    /** @param list<int> $cargoFilterIds */
    private function ensureCargoLevelFilters(array $cargoFilterIds = []): void
    {
        $cargoScope = $cargoFilterIds === []
            ? ''
            : ' AND cargo_identity.filter_id IN (' . implode(',', array_map('intval', $cargoFilterIds)) . ')';
        $rows = $this->db->query(
            "SELECT DISTINCT TRIM(level_reference.label) AS label
             FROM filter_source_identities cargo_identity
             INNER JOIN JSON_TABLE(
                COALESCE(cargo_identity.source_metadata_json, JSON_OBJECT()),
                '$.levels[*]' COLUMNS (label VARCHAR(255) PATH '$')
             ) level_reference ON TRUE
             WHERE cargo_identity.filter_type = 'cargo'
               AND cargo_identity.source_provider = 'gran'
               AND cargo_identity.source_entity_type = 'cargo'
               AND TRIM(level_reference.label) <> ''{$cargoScope}"
        )->fetchAll(PDO::FETCH_COLUMN) ?: [];
        if ($rows === []) {
            return;
        }

        $insert = $this->db->prepare(
            "INSERT INTO filters (type, name, slug, taxonomy_level, meta_carreira, meta_materia)
             VALUES ('nivel', :name, :slug, NULL, 0, 0)"
        );
        foreach ($rows as $value) {
            $name = mb_substr(trim((string) $value), 0, 255, 'UTF-8');
            if ($name === '' || $this->findCanonicalMatch('nivel', $name, false) !== null) {
                continue;
            }
            $insert->execute([
                ':name' => $name,
                ':slug' => $this->reserveSlug('nivel', 'nivel', $this->slugify($name), $name),
            ]);
        }
    }

    /**
     * Materializa somente as materias-raiz referenciadas por assuntos pendentes.
     *
     * A rota de arvore da Gran devolve os descendentes da raiz selecionada,
     * mas nao devolve o proprio registro da materia. O catalogo plano contem
     * o ID e o nome dessa materia. Cruzamos os dois conjuntos no servidor para
     * evitar criar materias por inferencia e para nao reprocessar os demais
     * assuntos do catalogo.
     *
     * @param list<array<string, mixed>> $granResponses
     * @param list<string> $requestedRootExternalIds
     * @return array{
     *   requested:int,
     *   found:int,
     *   created:int,
     *   updated:int,
     *   unresolved:int,
     *   unresolvedRootExternalIds:list<string>
     * }
     */
    public function syncMissingSubjectRoots(array $granResponses, array $requestedRootExternalIds): array
    {
        StaticSitemapMutationInvalidator::invalidate('FILTER_IMPORT_MUTATION');
        if ($granResponses === [] || count($granResponses) > 500) {
            throw new InvalidArgumentException('Lote do catalogo de assuntos invalido.');
        }

        $missingRoots = array_fill_keys($this->getMissingSubjectRootExternalIds(), true);
        $targets = [];
        foreach ($requestedRootExternalIds as $value) {
            $externalId = $this->readExternalId($value);
            if ($externalId !== null && isset($missingRoots[$externalId])) {
                $targets[$externalId] = true;
            }
        }
        if ($targets === []) {
            return [
                'requested' => 0,
                'found' => 0,
                'created' => 0,
                'updated' => 0,
                'unresolved' => 0,
                'unresolvedRootExternalIds' => [],
            ];
        }

        $recordsByExternalId = [];
        foreach ($granResponses as $granResponse) {
            if (!is_array($granResponse)) {
                throw new InvalidArgumentException('Uma pagina do catalogo de assuntos e invalida.');
            }
            foreach ($this->flattenSubjectTree($this->extractRows($granResponse)) as $record) {
                $externalId = $this->readExternalId($record['id'] ?? null);
                if ($externalId !== null && isset($targets[$externalId])) {
                    $recordsByExternalId[$externalId] = $record;
                }
            }
        }

        $config = self::KINDS['assunto'];
        $created = 0;
        $updated = 0;
        $this->db->beginTransaction();
        try {
            foreach ($recordsByExternalId as $externalId => $record) {
                $record['parentExternalId'] = null;
                $record['rootExternalId'] = $externalId;
                $record['materia'] = true;
                $result = $this->upsert($config, $record);
                $created += $result['created'] ? 1 : 0;
                $updated += $result['created'] ? 0 : 1;
            }
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        $unresolvedRootExternalIds = array_values(array_diff(
            array_keys($targets),
            array_keys($recordsByExternalId)
        ));
        sort($unresolvedRootExternalIds, SORT_NATURAL);

        return [
            'requested' => count($targets),
            'found' => count($recordsByExternalId),
            'created' => $created,
            'updated' => $updated,
            'unresolved' => count($unresolvedRootExternalIds),
            'unresolvedRootExternalIds' => $unresolvedRootExternalIds,
        ];
    }

    /**
     * Materializa somente os pais/raizes solicitados que continuam ausentes.
     * O payload vem da rota publica fixa consultada pelo navegador e e
     * cruzado com os IDs calculados pelo banco antes de qualquer escrita.
     *
     * @param list<array<string, mixed>> $granResponses
     * @param list<string> $requestedExternalIds
     * @return array{requested:int,found:int,created:int,updated:int,unresolved:int,unresolvedExternalIds:list<string>}
     */
    public function syncMissingSubjectHierarchyNodes(array $granResponses, array $requestedExternalIds): array
    {
        StaticSitemapMutationInvalidator::invalidate('FILTER_IMPORT_MUTATION');
        if ($granResponses === [] || count($granResponses) > 500) {
            throw new InvalidArgumentException('Lote da hierarquia pendente invalido.');
        }

        $missing = array_fill_keys($this->getMissingSubjectHierarchyExternalIds(), true);
        $targets = [];
        foreach ($requestedExternalIds as $value) {
            $externalId = $this->readExternalId($value);
            if ($externalId !== null && isset($missing[$externalId])) {
                $targets[$externalId] = true;
            }
        }
        if ($targets === []) {
            return [
                'requested' => 0,
                'found' => 0,
                'created' => 0,
                'updated' => 0,
                'unresolved' => 0,
                'unresolvedExternalIds' => [],
            ];
        }

        $records = [];
        foreach ($granResponses as $granResponse) {
            if (!is_array($granResponse)) {
                throw new InvalidArgumentException('Uma resposta da hierarquia pendente e invalida.');
            }
            foreach ($this->flattenSubjectTree($this->extractRows($granResponse)) as $record) {
                $externalId = $this->readExternalId($record['id'] ?? null);
                if ($externalId !== null && isset($targets[$externalId])) {
                    $records[$externalId] = $record;
                }
            }
        }

        $created = 0;
        $updated = 0;
        $this->db->beginTransaction();
        try {
            foreach ($records as $record) {
                $result = $this->upsert(self::KINDS['assunto_tree'], $record);
                $created += $result['created'] ? 1 : 0;
                $updated += $result['created'] ? 0 : 1;
            }
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        $unresolvedExternalIds = array_values(array_diff(array_keys($targets), array_keys($records)));
        usort($unresolvedExternalIds, static fn (string $left, string $right): int => strnatcmp($left, $right));
        return [
            'requested' => count($targets),
            'found' => count($records),
            'created' => $created,
            'updated' => $updated,
            'unresolved' => count($unresolvedExternalIds),
            'unresolvedExternalIds' => $unresolvedExternalIds,
        ];
    }

    /**
     * Resolve as materias-raiz ausentes com uma unica consulta ao catalogo
     * publico da Gran. A URL e fixa e nenhum token ou URL do cliente chega ao
     * servidor.
     *
     * @return array{
     *   requested:int,
     *   found:int,
     *   created:int,
     *   updated:int,
     *   unresolved:int,
     *   unresolvedRootExternalIds:list<string>
     * }
     */
    public function recoverMissingSubjectRootsFromPublicCatalog(): array
    {
        $missingRoots = $this->getMissingSubjectRootExternalIds();
        if ($missingRoots === []) {
            return [
                'requested' => 0,
                'found' => 0,
                'created' => 0,
                'updated' => 0,
                'unresolved' => 0,
                'unresolvedRootExternalIds' => [],
            ];
        }

        return $this->syncMissingSubjectRoots(
            [$this->fetchPublicSubjectCatalog($missingRoots)],
            $missingRoots
        );
    }

    /**
     * Recupera pais e raizes ausentes em lotes exatos pelo endpoint publico.
     * Novos ancestrais descobertos sao buscados na rodada seguinte. A operacao
     * para quando a cadeia fecha, quando a Gran nao retorna progresso ou ao
     * atingir o limite defensivo de profundidade.
     *
     * @return array{
     *   requested:int,
     *   found:int,
     *   created:int,
     *   updated:int,
     *   rounds:int,
     *   upstreamRequests:int,
     *   unresolved:int,
     *   unresolvedExternalIds:list<string>
     * }
     */
    public function recoverPendingSubjectHierarchyFromPublicCatalog(): array
    {
        $attempted = [];
        $requested = 0;
        $found = 0;
        $created = 0;
        $updated = 0;
        $rounds = 0;
        $upstreamRequests = 0;

        for ($round = 1; $round <= self::MAX_HIERARCHY_RECOVERY_ROUNDS; $round++) {
            $missing = array_values(array_filter(
                $this->getMissingSubjectHierarchyExternalIds(),
                static fn (string $externalId): bool => !isset($attempted[$externalId])
            ));
            if ($missing === []) {
                break;
            }

            $rounds++;
            $roundFound = 0;
            foreach (array_chunk($missing, self::MAX_PUBLIC_SUBJECT_IDS_PER_REQUEST) as $chunk) {
                foreach ($chunk as $externalId) {
                    $attempted[$externalId] = true;
                }
                $requested += count($chunk);
                $payload = $this->fetchPublicSubjectCatalog($chunk);
                $upstreamRequests++;
                $targets = array_fill_keys($chunk, true);
                $records = [];
                foreach ($this->normalizeFlatRecords($this->extractRows($payload)) as $record) {
                    $externalId = $this->readExternalId($record['id'] ?? null);
                    if ($externalId !== null && isset($targets[$externalId])) {
                        $records[$externalId] = $record;
                    }
                }
                if ($records === []) {
                    continue;
                }

                $this->db->beginTransaction();
                try {
                    foreach ($records as $record) {
                        $result = $this->upsert(self::KINDS['assunto_tree'], $record);
                        $created += $result['created'] ? 1 : 0;
                        $updated += $result['created'] ? 0 : 1;
                        $found++;
                        $roundFound++;
                    }
                    $this->db->commit();
                } catch (Throwable $exception) {
                    if ($this->db->inTransaction()) {
                        $this->db->rollBack();
                    }
                    throw $exception;
                }
            }

            if ($roundFound === 0) {
                break;
            }
        }

        $unresolved = $this->getMissingSubjectHierarchyExternalIds();
        return [
            'requested' => $requested,
            'found' => $found,
            'created' => $created,
            'updated' => $updated,
            'rounds' => $rounds,
            'upstreamRequests' => $upstreamRequests,
            'unresolved' => count($unresolved),
            'unresolvedExternalIds' => $unresolved,
        ];
    }

    /** @return array{resolved:int,pending:int,total:int} */
    public function finalizeSync(): array
    {
        StaticSitemapMutationInvalidator::invalidate('FILTER_HIERARCHY_MUTATION');
        $rows = $this->db->query(
            "SELECT id, source_external_id, source_parent_external_id, source_root_external_id,
                    taxonomy_level, meta_materia
             FROM filters
             WHERE type = 'assunto'
               AND source_provider = 'gran'
               AND source_entity_type = 'assunto'
             ORDER BY id"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $byExternalId = [];
        foreach ($rows as $row) {
            $externalId = trim((string) ($row['source_external_id'] ?? ''));
            if ($externalId !== '') {
                $byExternalId[$externalId] = $row;
            }
        }
        $identityRows = $this->db->query(
            "SELECT f.id, f.source_external_id, f.source_parent_external_id, f.source_root_external_id,
                    f.taxonomy_level, f.meta_materia,
                    identity.source_external_id AS identity_external_id,
                    identity.source_parent_external_id AS identity_parent_external_id,
                    identity.source_root_external_id AS identity_root_external_id
             FROM filter_source_identities identity
             INNER JOIN filters f ON f.id = identity.filter_id
             WHERE identity.filter_type = 'assunto'
               AND identity.source_provider = 'gran'
               AND identity.source_entity_type = 'assunto'"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($identityRows as $identityRow) {
            $externalId = trim((string) ($identityRow['identity_external_id'] ?? ''));
            if ($externalId === '') {
                continue;
            }
            $identityRow['source_external_id'] = $externalId;
            $identityRow['source_parent_external_id'] = $identityRow['identity_parent_external_id'] ?? null;
            $identityRow['source_root_external_id'] = $identityRow['identity_root_external_id'] ?? null;
            $byExternalId[$externalId] = $identityRow;
        }

        $update = $this->db->prepare(
            'UPDATE filters
             SET parent_id = :parent_id,
                 meta_materia = :meta_materia,
                 taxonomy_level = :taxonomy_level
             WHERE id = :id'
        );
        /** @var array<string, array{parentId:?int,level:string,isRoot:bool}|null> $resolvedHierarchy */
        $resolvedHierarchy = [];
        /** @var array<string, true> $visiting */
        $visiting = [];
        $resolveHierarchy = function (string $externalId) use (&$resolveHierarchy, &$resolvedHierarchy, &$visiting, $byExternalId): ?array {
            if (array_key_exists($externalId, $resolvedHierarchy)) {
                return $resolvedHierarchy[$externalId];
            }
            if (isset($visiting[$externalId])) {
                $resolvedHierarchy[$externalId] = null;
                return null;
            }
            $row = $byExternalId[$externalId] ?? null;
            if ($row === null) {
                return null;
            }

            $visiting[$externalId] = true;
            $parentExternalId = trim((string) ($row['source_parent_external_id'] ?? ''));
            $rootExternalId = trim((string) ($row['source_root_external_id'] ?? ''));
            $isRoot = $parentExternalId === ''
                && ($rootExternalId === '' || $rootExternalId === $externalId);

            if ($isRoot) {
                unset($visiting[$externalId]);
                return $resolvedHierarchy[$externalId] = [
                    'parentId' => null,
                    'level' => 'materia',
                    'isRoot' => true,
                ];
            }
            if ($parentExternalId === '') {
                unset($visiting[$externalId]);
                $resolvedHierarchy[$externalId] = null;
                return null;
            }

            $parentHierarchy = $resolveHierarchy($parentExternalId);
            unset($visiting[$externalId]);
            if ($parentHierarchy === null || !isset($byExternalId[$parentExternalId])) {
                $resolvedHierarchy[$externalId] = null;
                return null;
            }

            $resolvedHierarchy[$externalId] = [
                'parentId' => (int) $byExternalId[$parentExternalId]['id'],
                'level' => match ($parentHierarchy['level']) {
                    'materia' => 'topico',
                    'topico' => 'subtopico',
                    default => 'assunto',
                },
                'isRoot' => false,
            ];
            return $resolvedHierarchy[$externalId];
        };

        $resolved = 0;
        $pending = 0;
        $this->db->beginTransaction();
        try {
            foreach ($rows as $row) {
                $externalId = trim((string) ($row['source_external_id'] ?? ''));
                $hierarchy = $externalId !== '' ? $resolveHierarchy($externalId) : null;
                if ($hierarchy === null) {
                    $update->execute([
                        ':parent_id' => null,
                        ':meta_materia' => 0,
                        ':taxonomy_level' => 'pending',
                        ':id' => (int) $row['id'],
                    ]);
                    $pending++;
                    continue;
                }
                $update->execute([
                    ':parent_id' => $hierarchy['parentId'],
                    ':meta_materia' => $hierarchy['isRoot'] ? 1 : 0,
                    ':taxonomy_level' => $hierarchy['level'],
                    ':id' => (int) $row['id'],
                ]);
                $resolved++;
            }
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        return ['resolved' => $resolved, 'pending' => $pending, 'total' => count($rows)];
    }

    /** @return array<string, mixed> */
    private function fetchPublicSubjectCatalog(array $externalIds): array
    {
        $externalIds = array_values(array_unique(array_filter(array_map(
            fn ($value): ?string => $this->readExternalId($value),
            $externalIds
        ))));
        if ($externalIds === [] || count($externalIds) > self::MAX_PUBLIC_SUBJECT_IDS_PER_REQUEST) {
            throw new InvalidArgumentException('O lote de IDs da hierarquia pendente e invalido.');
        }

        if ($this->publicCatalogFetcher !== null) {
            $payload = ($this->publicCatalogFetcher)($externalIds);
            if (!is_array($payload)) {
                throw new RuntimeException('O catalogo publico de materias retornou um payload invalido.');
            }
            return $payload;
        }

        if (!function_exists('curl_init')) {
            throw new RuntimeException('A extensao cURL nao esta disponivel para recuperar as materias pendentes.');
        }

        $body = '';
        $tooLarge = false;
        $query = 'perPage=' . count($externalIds) . '&page=1';
        foreach ($externalIds as $externalId) {
            $query .= '&id%5B%5D=' . rawurlencode($externalId);
        }
        $handle = curl_init(self::PUBLIC_SUBJECT_CATALOG_URL . '?' . $query);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Origin: https://questoes.grancursosonline.com.br',
                'Referer: https://questoes.grancursosonline.com.br/',
                'User-Agent: ConcursoMestre-Taxonomy-Recovery/1.0',
            ],
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body, &$tooLarge): int {
                if (strlen($body) + strlen($chunk) > self::MAX_PUBLIC_CATALOG_BYTES) {
                    $tooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);

        $ok = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($tooLarge) {
            throw new RuntimeException('O catalogo publico de materias excedeu o limite seguro.');
        }
        if ($ok === false || $error !== '' || $status !== 200) {
            throw new RuntimeException('Nao foi possivel consultar o catalogo publico de materias da Gran.');
        }

        $payload = json_decode($body, true);
        if (!is_array($payload)) {
            throw new RuntimeException('O catalogo publico de materias retornou JSON invalido.');
        }
        return $payload;
    }

    private function upsert(array $config, array $record): array
    {
        $externalId = $this->readExternalId($record['id'] ?? null);
        $name = $this->readName($record);
        if ($externalId === null || $name === '') {
            return ['created' => false, 'pending' => true];
        }

        $isCargo = $config['filterType'] === 'cargo';
        $cargoCareerIds = $isCargo ? $this->readExternalIdList($record['carreiras'] ?? $record['carreira'] ?? []) : [];
        $cargoPrimaryCareerId = $cargoCareerIds[0] ?? null;
        $sourceParentId = $cargoPrimaryCareerId
            ?? $this->readExternalId($record['parentExternalId'] ?? $record['pai'] ?? null);
        $sourceRootId = $cargoPrimaryCareerId
            ?? $this->readExternalId($record['rootExternalId'] ?? $record['assunto_raiz'] ?? null);
        $isSubject = $config['filterType'] === 'assunto';
        $isRoot = $isSubject
            && ($this->isTruthy($record['materia'] ?? false)
                || ($sourceParentId === null && $sourceRootId !== null && $sourceRootId === $externalId));
        $hasSubjectHierarchy = !$isSubject
            || $isRoot
            || $sourceParentId !== null
            || $sourceRootId !== null;
        $parent = null;
        if ($sourceParentId !== null && $isSubject) {
            $parent = $this->findBySourceIdentity('assunto', 'assunto', $sourceParentId);
        } elseif ($sourceParentId !== null && $isCargo) {
            $parent = $this->findBySourceIdentity('carreira', 'carreira', $sourceParentId);
        }
        $acronym = $config['filterType'] === 'banca' || $config['filterType'] === 'orgao'
            ? $this->readAcronym($record)
            : null;
        $description = in_array($config['filterType'], ['banca', 'orgao', 'cargo', 'carreira'], true)
            ? $this->readDescription($record, $name)
            : null;
        $website = $config['filterType'] === 'banca'
            ? $this->readUrlCandidate($record, ['website', 'site', 'site_url', 'url_site', 'homepage', 'pagina_oficial'])
            : null;
        $assetUrl = in_array($config['filterType'], ['banca', 'orgao'], true)
            ? $this->readUrlCandidate($record, [
                'asset_url', 'logo_url', 'logoUrl', 'logo', 'imagem_url', 'image_url',
                'imagem', 'image', 'icone_url', 'icon_url', 'icone', 'icon',
            ])
            : null;
        $iconKey = $this->readIconKey($record);
        $sourceMetadata = $this->readSourceMetadata($config, $record);
        $existingBySourceIdentity = $this->findBySourceIdentity(
            $config['filterType'],
            $config['entityType'],
            $externalId
        );
        $existing = $existingBySourceIdentity;
        if ($existing === null && $isSubject) {
            // A listagem plana de assuntos nao possui pai/raiz. Ela serve
            // como catalogo complementar, mas jamais pode criar uma materia
            // ou subtopico sem a arvore oficial que define a relacao.
            if (!$hasSubjectHierarchy) {
                return ['created' => false, 'pending' => true];
            }
            $existing = $isRoot
                ? $this->findCanonicalMatch($config['filterType'], $name, true)
                : ($parent !== null
                    ? $this->findCanonicalMatchByParent($config['filterType'], $name, (int) $parent['id'])
                    : null);
        } elseif ($existing === null) {
            $existing = $this->findCanonicalMatch($config['filterType'], $name, false);
        }
        if (!$isSubject && $acronym !== null) {
            $existingByAcronym = $this->findCanonicalMatchByAcronym($config['filterType'], $acronym);
            if ($existingByAcronym !== null && $existingBySourceIdentity === null) {
                // A mesma banca/órgão pode chegar com nome editorial diferente
                // da Gran. A sigla é única por tipo e identifica o cadastro
                // canônico já existente antes de qualquer INSERT.
                $existing = $existingByAcronym;
            } elseif (
                $existingByAcronym !== null
                && $existing !== null
                && (int) $existingByAcronym['id'] !== (int) $existing['id']
            ) {
                // Um vínculo externo já existente não pode tomar a sigla de
                // outra taxonomia canônica. Mantemos a sigla atual no UPDATE.
                $acronym = null;
            }
        }
        if ($existing !== null) {
            $name = $this->preferCanonicalName(
                $name,
                (string) ($existing['name'] ?? ''),
                $acronym,
                (string) ($existing['acronym'] ?? '')
            );
        }
        $level = $config['filterType'] !== 'assunto'
            ? null
            : ($isRoot ? 'materia' : ($parent === null ? 'pending' : $this->childLevel((string) ($parent['taxonomy_level'] ?? ''))));
        $parentId = $isRoot ? null : ($parent !== null ? (int) $parent['id'] : null);
        $cargoHierarchyPending = $isCargo && ($cargoPrimaryCareerId === null || $parent === null);
        $keywords = $this->readKeywords($record, $name, $acronym);
        $slug = $existing !== null
            ? (string) $existing['slug']
            : $this->reserveSlug($config['filterType'], $config['entityType'], $externalId, $name);
        $payload = [
            ':type' => $config['filterType'],
            ':name' => $name,
            ':slug' => $slug,
            ':acronym' => $acronym,
            ':parent_id' => $parentId,
            ':description' => $description,
            ':website' => $website,
            ':asset_url' => $assetUrl,
            ':icon_key' => $iconKey,
            ':keywords_json' => $keywords === [] ? null : json_encode($keywords, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':meta_materia' => $isRoot ? 1 : 0,
            ':taxonomy_level' => $level,
            ':meta_carreira' => $config['filterType'] === 'carreira' ? 1 : 0,
            ':meta_uf' => $this->readUf($record),
            ':meta_esfera' => $this->readScalarText($record['esfera'] ?? null, 50),
            ':meta_oab' => $this->isTruthy($record['oab'] ?? false) ? 1 : 0,
            ':source_provider' => self::PROVIDER,
            ':source_entity_type' => $config['entityType'],
            ':source_external_id' => $externalId,
            ':source_parent_external_id' => $sourceParentId,
            ':source_root_external_id' => $sourceRootId,
        ];

        if ($existing !== null) {
            $primaryExternalId = $this->readExternalId($existing['source_external_id'] ?? null);
            $preservePrimarySourceIdentity = $primaryExternalId !== null && $primaryExternalId !== $externalId;
            // Uma pagina plana pode chegar antes do pai. Nesse caso nao
            // apagamos uma relacao ja consolidada em uma sincronizacao anterior.
            // Estes bindings pertencem exclusivamente ao UPDATE: PDO nativo
            // rejeita parametros adicionais em um INSERT.
            $updatePayload = [
                ':name' => $payload[':name'],
                ':acronym' => $payload[':acronym'],
                ':parent_id' => $payload[':parent_id'],
                ':description' => $payload[':description'],
                ':website' => $payload[':website'],
                ':asset_url' => $payload[':asset_url'],
                ':icon_key' => $payload[':icon_key'],
                ':keywords_json' => $payload[':keywords_json'],
                ':meta_materia' => $payload[':meta_materia'],
                ':taxonomy_level' => $payload[':taxonomy_level'],
                ':meta_carreira' => $payload[':meta_carreira'],
                ':meta_uf' => $payload[':meta_uf'],
                ':meta_esfera' => $payload[':meta_esfera'],
                ':meta_oab' => $payload[':meta_oab'],
                ':source_provider' => $payload[':source_provider'],
                ':source_entity_type' => $payload[':source_entity_type'],
                ':source_external_id' => $payload[':source_external_id'],
                ':preserve_primary_source_provider' => $preservePrimarySourceIdentity ? 1 : 0,
                ':preserve_primary_source_entity_type' => $preservePrimarySourceIdentity ? 1 : 0,
                ':preserve_primary_source_external_id' => $preservePrimarySourceIdentity ? 1 : 0,
                ':source_parent_external_id' => $payload[':source_parent_external_id'],
                ':source_root_external_id' => $payload[':source_root_external_id'],
                ':preserve_parent_condition' => (
                    $isSubject
                    && (!$hasSubjectHierarchy || ($sourceParentId !== null && $parent === null))
                ) || (
                    $isCargo
                    && ($cargoPrimaryCareerId === null || $parent === null)
                ) ? 1 : 0,
                ':preserve_level_for_materia' => $level === 'pending' ? 1 : 0,
                ':preserve_level_for_taxonomy' => $level === 'pending' ? 1 : 0,
                ':preserve_source_parent_hierarchy' => $preservePrimarySourceIdentity
                    || ($isSubject && !$hasSubjectHierarchy)
                    || ($isCargo && $cargoPrimaryCareerId === null) ? 1 : 0,
                ':preserve_source_root_hierarchy' => $preservePrimarySourceIdentity
                    || ($isSubject && !$hasSubjectHierarchy)
                    || ($isCargo && $cargoPrimaryCareerId === null) ? 1 : 0,
                ':id' => (int) $existing['id'],
            ];
            $stmt = $this->db->prepare(
                'UPDATE filters
                 SET name = :name, acronym = COALESCE(:acronym, acronym),
                     parent_id = CASE WHEN :preserve_parent_condition = 1 THEN parent_id ELSE :parent_id END,
                     description = COALESCE(:description, description),
                     website = COALESCE(:website, website),
                     asset_url = COALESCE(:asset_url, asset_url),
                     icon_key = COALESCE(:icon_key, icon_key),
                     keywords_json = COALESCE(:keywords_json, keywords_json),
                     meta_materia = CASE WHEN :preserve_level_for_materia = 1 THEN meta_materia ELSE :meta_materia END,
                     taxonomy_level = CASE WHEN :preserve_level_for_taxonomy = 1 THEN taxonomy_level ELSE :taxonomy_level END,
                     meta_carreira = :meta_carreira,
                     meta_uf = COALESCE(:meta_uf, meta_uf),
                     meta_esfera = COALESCE(:meta_esfera, meta_esfera),
                     meta_oab = :meta_oab,
                     source_provider = CASE WHEN :preserve_primary_source_provider = 1
                         THEN source_provider ELSE :source_provider END,
                     source_entity_type = CASE WHEN :preserve_primary_source_entity_type = 1
                         THEN source_entity_type ELSE :source_entity_type END,
                     source_external_id = CASE WHEN :preserve_primary_source_external_id = 1
                         THEN source_external_id ELSE :source_external_id END,
                      source_parent_external_id = CASE WHEN :preserve_source_parent_hierarchy = 1
                          THEN source_parent_external_id ELSE :source_parent_external_id END,
                      source_root_external_id = CASE WHEN :preserve_source_root_hierarchy = 1
                          THEN source_root_external_id ELSE :source_root_external_id END
                 WHERE id = :id'
            );
            $stmt->execute($updatePayload);
            $this->upsertSourceIdentity(
                (int) $existing['id'],
                $config['filterType'],
                $config['entityType'],
                $externalId,
                $sourceParentId,
                $sourceRootId,
                $sourceMetadata
            );
            $this->upsertAliases((int) $existing['id'], $this->readAliases($record, $acronym));
            return [
                'created' => false,
                'pending' => ($level === 'pending' && $hasSubjectHierarchy) || $cargoHierarchyPending,
            ];
        }

        $stmt = $this->db->prepare(
            'INSERT INTO filters (
                type, name, slug, acronym, parent_id, description, website, asset_url, icon_key,
                keywords_json, meta_materia, taxonomy_level,
                meta_carreira, meta_uf, meta_esfera, meta_oab,
                source_provider, source_entity_type, source_external_id,
                source_parent_external_id, source_root_external_id
             ) VALUES (
                :type, :name, :slug, :acronym, :parent_id, :description, :website, :asset_url, :icon_key,
                :keywords_json, :meta_materia, :taxonomy_level,
                :meta_carreira, :meta_uf, :meta_esfera, :meta_oab,
                :source_provider, :source_entity_type, :source_external_id,
                :source_parent_external_id, :source_root_external_id
             )'
        );
        $stmt->execute($payload);
        $createdFilterId = (int) $this->db->lastInsertId();
        $this->upsertSourceIdentity(
            $createdFilterId,
            $config['filterType'],
            $config['entityType'],
            $externalId,
            $sourceParentId,
            $sourceRootId,
            $sourceMetadata
        );
        $this->upsertAliases($createdFilterId, $this->readAliases($record, $acronym));
        return [
            'created' => true,
            'pending' => ($level === 'pending' && $hasSubjectHierarchy) || $cargoHierarchyPending,
        ];
    }

    private function findBySourceIdentity(string $type, string $entityType, string $externalId): ?array
    {
        $identityStmt = $this->db->prepare(
            'SELECT filters.id, filters.name, filters.slug, filters.acronym, filters.taxonomy_level,
                    filters.source_provider, filters.source_entity_type, filters.source_external_id
             FROM filter_source_identities identity
             INNER JOIN filters ON filters.id = identity.filter_id
             WHERE identity.filter_type = :type
               AND identity.source_provider = :provider
               AND identity.source_entity_type = :entity_type
               AND identity.source_external_id = :external_id
             LIMIT 1'
        );
        $identityStmt->execute([
            ':type' => $type,
            ':provider' => self::PROVIDER,
            ':entity_type' => $entityType,
            ':external_id' => $externalId,
        ]);
        $identityRow = $identityStmt->fetch(PDO::FETCH_ASSOC);
        if (is_array($identityRow)) {
            return $identityRow;
        }

        $stmt = $this->db->prepare(
            'SELECT id, name, slug, acronym, taxonomy_level, source_provider, source_entity_type, source_external_id FROM filters
             WHERE type = :type AND source_provider = :provider
               AND source_entity_type = :entity_type AND source_external_id = :external_id
             LIMIT 1'
        );
        $stmt->execute([
            ':type' => $type,
            ':provider' => self::PROVIDER,
            ':entity_type' => $entityType,
            ':external_id' => $externalId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function findCanonicalMatch(string $type, string $name, bool $rootOnly): ?array
    {
        $sql = 'SELECT id, name, slug, acronym, taxonomy_level, source_provider, source_entity_type, source_external_id
                FROM filters WHERE type = :type AND name = :name';
        if ($rootOnly) {
            $sql .= ' AND parent_id IS NULL';
        }
        $sql .= ' ORDER BY id LIMIT 1';
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':type' => $type, ':name' => $name]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function findCanonicalMatchByAcronym(string $type, string $acronym): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, slug, acronym, taxonomy_level, source_provider, source_entity_type, source_external_id FROM filters
             WHERE type = :type AND acronym = :acronym
             ORDER BY id LIMIT 1'
        );
        $stmt->execute([':type' => $type, ':acronym' => $acronym]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function findCanonicalMatchByParent(string $type, string $name, int $parentId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, slug, acronym, taxonomy_level, source_provider, source_entity_type, source_external_id FROM filters
             WHERE type = :type AND name = :name AND parent_id = :parent_id
             ORDER BY id LIMIT 1'
        );
        $stmt->execute([
            ':type' => $type,
            ':name' => $name,
            ':parent_id' => $parentId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function upsertSourceIdentity(
        int $filterId,
        string $filterType,
        string $entityType,
        string $externalId,
        ?string $parentExternalId,
        ?string $rootExternalId,
        array $sourceMetadata
    ): void {
        $metadataJson = $sourceMetadata === []
            ? null
            : json_encode($sourceMetadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $stmt = $this->db->prepare(
            'INSERT INTO filter_source_identities (
                filter_id, filter_type, source_provider, source_entity_type,
                source_external_id, source_parent_external_id, source_root_external_id,
                source_metadata_json
             ) VALUES (
                :filter_id, :filter_type, :source_provider, :source_entity_type,
                :source_external_id, :source_parent_external_id, :source_root_external_id,
                :source_metadata_json
             )
             ON DUPLICATE KEY UPDATE
                filter_id = VALUES(filter_id),
                source_parent_external_id = VALUES(source_parent_external_id),
                source_root_external_id = VALUES(source_root_external_id),
                source_metadata_json = CASE
                    WHEN VALUES(source_metadata_json) IS NULL THEN source_metadata_json
                    ELSE JSON_MERGE_PATCH(
                        COALESCE(source_metadata_json, JSON_OBJECT()),
                        VALUES(source_metadata_json)
                    )
                END,
                updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            ':filter_id' => $filterId,
            ':filter_type' => $filterType,
            ':source_provider' => self::PROVIDER,
            ':source_entity_type' => $entityType,
            ':source_external_id' => $externalId,
            ':source_parent_external_id' => $parentExternalId,
            ':source_root_external_id' => $rootExternalId,
            ':source_metadata_json' => $metadataJson,
        ]);
    }

    /** @param list<string> $aliases */
    private function upsertAliases(int $filterId, array $aliases): void
    {
        if ($aliases === []) {
            return;
        }
        $stmt = $this->db->prepare(
            'INSERT IGNORE INTO filter_aliases (filter_id, alias, normalized_alias)
             VALUES (:filter_id, :alias, :normalized_alias)'
        );
        foreach ($aliases as $alias) {
            $normalized = $this->normalizeIdentityText($alias);
            if ($normalized === '') {
                continue;
            }
            $stmt->execute([
                ':filter_id' => $filterId,
                ':alias' => $alias,
                ':normalized_alias' => $normalized,
            ]);
        }
    }

    private function reserveSlug(string $type, string $entityType, string $externalId, string $name): string
    {
        $base = $this->slugify($name);
        $base = trim(substr($base, 0, 245), '-');
        $slug = $base !== '' ? $base : $entityType . '-' . $externalId;
        $suffix = 1;
        while (true) {
            $stmt = $this->db->prepare('SELECT id FROM filters WHERE type = :type AND slug = :slug LIMIT 1');
            $stmt->execute([':type' => $type, ':slug' => $slug]);
            if ($stmt->fetchColumn() === false) {
                return $slug;
            }
            $suffix++;
            $slug = substr($base, 0, 240) . '-' . $suffix;
        }
    }

    private function flattenSubjectTree(array $roots): array
    {
        $flattened = [];
        $walk = function (array $nodes, ?string $parentId, ?string $rootId) use (&$walk, &$flattened): void {
            foreach ($nodes as $node) {
                if (!is_array($node)) {
                    continue;
                }
                $id = $this->readExternalId($node['id'] ?? null);
                if ($id === null || $this->readName($node) === '') {
                    continue;
                }
                $node['parentExternalId'] = $this->readExternalId($node['pai'] ?? null) ?? $parentId;
                $node['rootExternalId'] = $this->readExternalId($node['assunto_raiz'] ?? null) ?? $rootId ?? $id;
                $node['materia'] = $this->isTruthy($node['materia'] ?? false) || $node['parentExternalId'] === null;
                $flattened[] = $node;
                $children = $node['filhos'] ?? $node['children'] ?? [];
                if (is_array($children)) {
                    $walk(array_values(array_filter($children, 'is_array')), $id, $node['rootExternalId']);
                }
            }
        };
        $walk($roots, null, null);
        return $flattened;
    }

    private function normalizeFlatRecords(array $rows): array
    {
        $normalized = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            // Endpoints Elastic podem devolver cada item em _source. A
            // identidade externa continua sendo a do hit, nao a do filtro
            // local que sera criado depois.
            if (is_array($row['_source'] ?? null)) {
                $source = $row['_source'];
                if (!array_key_exists('id', $source) && array_key_exists('_id', $row)) {
                    $source['id'] = $row['_id'];
                }
                $row = $source;
            }
            $normalized[] = $row;
        }
        return $normalized;
    }

    private function extractRows(array $payload): array
    {
        foreach ([
            $payload['data']['rows'] ?? null,
            $payload['data']['items'] ?? null,
            $payload['data']['hits'] ?? null,
            $payload['data']['materias'] ?? null,
            $payload['data']['arvore'] ?? null,
            $payload['data']['results'] ?? null,
            $payload['data']['hits']['hits'] ?? null,
            $payload['data'] ?? null,
            $payload['rows'] ?? null,
            $payload['items'] ?? null,
            $payload['materias'] ?? null,
            $payload['arvore'] ?? null,
            $payload['results'] ?? null,
            $payload['hits']['hits'] ?? null,
        ] as $candidate) {
            if (is_array($candidate) && array_is_list($candidate)) {
                return $candidate;
            }
        }
        return [];
    }

    private function readName(array $record): string
    {
        foreach ([
            'nome', 'nome_completo', 'nomeCompleto', 'razao_social', 'razaoSocial',
            'full_name', 'fullName', 'name', 'titulo', 'title', 'descricao',
            'description', 'sigla',
        ] as $key) {
            if (!isset($record[$key]) || !is_scalar($record[$key])) {
                continue;
            }
            $value = trim((string) $record[$key]);
            if ($value !== '') {
                return mb_substr($value, 0, 255, 'UTF-8');
            }
        }
        return '';
    }

    private function readAcronym(array $record): ?string
    {
        foreach (['sigla', 'acronym', 'acronimo', 'abreviacao', 'abbreviation'] as $key) {
            if (!isset($record[$key]) || !is_scalar($record[$key])) {
                continue;
            }
            $value = trim((string) $record[$key]);
            if ($value !== '') {
                return mb_substr(mb_strtoupper($value, 'UTF-8'), 0, 40, 'UTF-8');
            }
        }
        return null;
    }

    private function readDescription(array $record, string $name): ?string
    {
        foreach (['descricao', 'description', 'sobre', 'resumo', 'summary'] as $key) {
            if (!isset($record[$key]) || !is_scalar($record[$key])) {
                continue;
            }
            $value = trim((string) $record[$key]);
            if ($value === '' || $this->normalizeIdentityText($value) === $this->normalizeIdentityText($name)) {
                continue;
            }
            return mb_substr($value, 0, 10000, 'UTF-8');
        }
        return null;
    }

    /**
     * @param array<string, mixed> $record
     * @param list<string> $keys
     */
    private function readUrlCandidate(array $record, array $keys): ?string
    {
        foreach ($keys as $key) {
            $candidate = $record[$key] ?? null;
            if (is_array($candidate)) {
                foreach (['url', 'href', 'src', 'value'] as $nestedKey) {
                    if (isset($candidate[$nestedKey]) && is_scalar($candidate[$nestedKey])) {
                        $candidate = $candidate[$nestedKey];
                        break;
                    }
                }
            }
            if (!is_scalar($candidate)) {
                continue;
            }
            $value = trim((string) $candidate);
            if ($value === '' || strlen($value) > 1000 || filter_var($value, FILTER_VALIDATE_URL) === false) {
                continue;
            }
            $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
            if (in_array($scheme, ['http', 'https'], true)) {
                return $value;
            }
        }
        return null;
    }

    private function readIconKey(array $record): ?string
    {
        $candidate = $record['icon_key'] ?? $record['iconKey'] ?? null;
        if (!is_scalar($candidate)) {
            return null;
        }
        $value = trim((string) $candidate);
        if ($value === '' || strlen($value) > 120 || preg_match('/^[a-z0-9_-]+$/i', $value) !== 1) {
            return null;
        }
        return $value;
    }

    private function preferCanonicalName(
        string $incomingName,
        string $existingName,
        ?string $incomingAcronym,
        string $existingAcronym
    ): string {
        $existingName = trim($existingName);
        if ($existingName === '') {
            return $incomingName;
        }
        $normalizedIncoming = $this->normalizeIdentityText($incomingName);
        $normalizedExisting = $this->normalizeIdentityText($existingName);
        $normalizedAcronyms = array_filter(array_map(
            fn (string $value): string => $this->normalizeIdentityText($value),
            [(string) $incomingAcronym, $existingAcronym]
        ));
        if (
            in_array($normalizedIncoming, $normalizedAcronyms, true)
            && !in_array($normalizedExisting, $normalizedAcronyms, true)
        ) {
            return $existingName;
        }
        return $incomingName;
    }

    /** @return list<string> */
    private function readKeywords(array $record, string $name, ?string $acronym): array
    {
        $keywords = [];
        foreach ([
            'palavrasChave', 'palavras_chave', 'keywords', 'aliases', 'alias',
            'apelidos', 'termos_busca', 'search_terms',
        ] as $key) {
            $keywords = array_merge($keywords, $this->normalizeKeywords($record[$key] ?? []));
        }
        if ($acronym !== null) {
            $keywords[] = $acronym;
        }
        if ($name !== '') {
            $keywords[] = $name;
        }
        return $this->normalizeKeywords($keywords);
    }

    /** @return list<string> */
    private function readAliases(array $record, ?string $acronym): array
    {
        $aliases = [];
        foreach (['aliases', 'alias', 'apelidos', 'nomes_alternativos'] as $key) {
            $aliases = array_merge($aliases, $this->normalizeKeywords($record[$key] ?? []));
        }
        if ($acronym !== null) {
            $aliases[] = $acronym;
        }
        return $this->normalizeKeywords($aliases);
    }

    /** @return array<string, mixed> */
    private function readSourceMetadata(array $config, array $record): array
    {
        $metadata = [
            'entityType' => $config['entityType'],
        ];
        foreach ([
            'slug' => 'sourceSlug',
            'index' => 'sourceIndex',
            'timestamp' => 'sourceUpdatedAt',
            'nome_clean' => 'sourceNameClean',
            'sigla' => 'sourceAcronym',
            'uf' => 'sourceUf',
            'esfera' => 'sourceSphere',
            'nivel' => 'sourceTaxonomyLevel',
            'indice' => 'sourceTaxonomyIndex',
        ] as $sourceKey => $targetKey) {
            $value = $this->readScalarText($record[$sourceKey] ?? null, 255);
            if ($value !== null) {
                $metadata[$targetKey] = $value;
            }
        }
        foreach ([
            'qtdQuestoes' => 'questionCount',
            'qtdQuestoesNaoAcumulado' => 'directQuestionCount',
            'qtdProvas' => 'examCount',
            'qtdConcursos' => 'contestCount',
            'qtdComentarios' => 'commentCount',
            'maisBuscadoPosicao' => 'popularityPosition',
        ] as $sourceKey => $targetKey) {
            if (isset($record[$sourceKey]) && is_numeric($record[$sourceKey])) {
                $metadata[$targetKey] = max(0, (int) $record[$sourceKey]);
            }
        }
        foreach (['maisBuscado' => 'popular', 'inedita' => 'unpublished', 'oab' => 'oab'] as $sourceKey => $targetKey) {
            if (array_key_exists($sourceKey, $record) && $record[$sourceKey] !== null) {
                $metadata[$targetKey] = $this->isTruthy($record[$sourceKey]);
            }
        }

        $careerExternalIds = $this->readExternalIdList($record['carreiras'] ?? $record['carreira'] ?? []);
        $organizationExternalIds = $this->readExternalIdList($record['orgaos'] ?? $record['orgao'] ?? []);
        $examTypeExternalIds = $this->readExternalIdList($record['tiposProva'] ?? $record['tipos_prova'] ?? []);
        $childExternalIds = $this->readExternalIdList($record['filhos'] ?? []);
        $levels = $this->readStringList($record['niveis'] ?? $record['nivel'] ?? []);
        if ($careerExternalIds !== []) {
            $metadata['careerExternalIds'] = $careerExternalIds;
        }
        $careerReferences = [];
        foreach (is_array($record['carreiras'] ?? null) ? $record['carreiras'] : [] as $career) {
            if (!is_array($career)) {
                continue;
            }
            $careerId = $this->readExternalId($career['id'] ?? null);
            $careerName = $this->readScalarText($career['nome'] ?? $career['name'] ?? null, 255);
            if ($careerId !== null) {
                $careerReferences[] = array_filter([
                    'externalId' => $careerId,
                    'name' => $careerName,
                ], static fn (mixed $value): bool => $value !== null);
            }
        }
        if ($careerReferences !== []) {
            $metadata['careerReferences'] = array_slice($careerReferences, 0, 5000);
        }
        if ($organizationExternalIds !== []) {
            $metadata['organizationExternalIds'] = $organizationExternalIds;
        }
        if ($examTypeExternalIds !== []) {
            $metadata['examTypeExternalIds'] = $examTypeExternalIds;
        }
        if ($childExternalIds !== []) {
            $metadata['childExternalIds'] = $childExternalIds;
        }
        if ($levels !== []) {
            $metadata['levels'] = $levels;
        }
        $sourceKeywords = $this->normalizeKeywords($record['palavrasChave'] ?? $record['palavras_chave'] ?? []);
        if ($sourceKeywords !== []) {
            $metadata['sourceKeywords'] = $sourceKeywords;
        }

        $state = is_array($record['estado'] ?? null) ? $record['estado'] : [];
        $stateMetadata = array_filter([
            'slug' => $this->readScalarText($state['slug'] ?? null, 120),
            'region' => $this->readScalarText($state['regiao'] ?? null, 120),
            'uf' => $this->readScalarText($state['sigla'] ?? null, 2),
        ], static fn (mixed $value): bool => $value !== null);
        if ($stateMetadata !== []) {
            $metadata['state'] = $stateMetadata;
        }

        if (is_array($record['qtdProvasPorTipo'] ?? null)) {
            $countsByExamType = [];
            foreach ($record['qtdProvasPorTipo'] as $type => $count) {
                if ((is_string($type) || is_int($type)) && is_numeric($count)) {
                    $countsByExamType[(string) $type] = max(0, (int) $count);
                }
            }
            if ($countsByExamType !== []) {
                $metadata['examCountsByType'] = $countsByExamType;
            }
        }

        return $metadata;
    }

    /** @return list<string> */
    private function readExternalIdList(mixed $value): array
    {
        $values = is_array($value) && array_is_list($value) ? $value : [$value];
        $result = [];
        foreach ($values as $item) {
            $externalId = is_array($item)
                ? $this->readExternalId($item['id'] ?? $item['_id'] ?? null)
                : $this->readExternalId($item);
            if ($externalId !== null) {
                $result[$externalId] = $externalId;
            }
        }
        return array_slice(array_values($result), 0, 5000);
    }

    /** @return list<string> */
    private function readStringList(mixed $value): array
    {
        $values = is_array($value) && array_is_list($value) ? $value : [$value];
        $result = [];
        foreach ($values as $item) {
            if (!is_scalar($item)) {
                continue;
            }
            $normalized = $this->readScalarText($item, 255);
            if ($normalized !== null) {
                $result[mb_strtolower($normalized, 'UTF-8')] = $normalized;
            }
        }
        return array_values($result);
    }

    private function readUf(array $record): ?string
    {
        $state = is_array($record['estado'] ?? null) ? $record['estado'] : [];
        $uf = $this->readScalarText($record['uf'] ?? $state['sigla'] ?? null, 2);
        return $uf !== null ? mb_strtoupper($uf, 'UTF-8') : null;
    }

    private function readScalarText(mixed $value, int $maxLength): ?string
    {
        if (!is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);
        return $value !== '' ? mb_substr($value, 0, $maxLength, 'UTF-8') : null;
    }

    private function readExternalId(mixed $value): ?string
    {
        if (!is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);
        return $value !== '' && strlen($value) <= 120 ? $value : null;
    }

    private function normalizeKeywords(mixed $value): array
    {
        if (is_scalar($value)) {
            $value = preg_split('/[,;\r\n|]+/u', (string) $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }
        $result = [];
        foreach ($value as $keyword) {
            if (!is_scalar($keyword)) {
                continue;
            }
            $keyword = trim((string) $keyword);
            if ($keyword !== '' && mb_strlen($keyword, 'UTF-8') <= 255) {
                $result[mb_strtolower($keyword, 'UTF-8')] = $keyword;
            }
        }
        return array_values($result);
    }

    private function normalizeIdentityText(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($ascii)) {
            $value = $ascii;
        }
        return preg_replace('/[^a-z0-9]+/', '', $value) ?? '';
    }

    private function childLevel(string $parentLevel): string
    {
        return match (strtolower(trim($parentLevel))) {
            'materia' => 'topico',
            'topico' => 'subtopico',
            default => 'assunto',
        };
    }

    private function isTruthy(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'sim', 'yes'], true);
    }

    private function slugify(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $ascii !== false ? $ascii : $value;
        return trim((string) preg_replace('/[^a-z0-9]+/', '-', $value), '-');
    }

    private function readPositiveInt(mixed $value): int
    {
        return is_numeric($value) && (int) $value > 0 ? (int) $value : 0;
    }

    /** @return array{pages:int,total:int} */
    private function readPagination(array $payload, int $perPage): array
    {
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $meta = is_array($data['meta'] ?? null)
            ? $data['meta']
            : (is_array($payload['meta'] ?? null) ? $payload['meta'] : []);
        $pages = 0;
        foreach ([
            $data['pages'] ?? null,
            $data['totalPaginas'] ?? null,
            $data['total_pages'] ?? null,
            $meta['pages'] ?? null,
            $meta['totalPages'] ?? null,
            $meta['total_pages'] ?? null,
            $payload['pages'] ?? null,
            $payload['totalPaginas'] ?? null,
        ] as $candidate) {
            $pages = $this->readPositiveInt($candidate);
            if ($pages > 0) {
                break;
            }
        }
        $total = 0;
        foreach ([
            $data['total'] ?? null,
            $data['totalItems'] ?? null,
            $data['total_itens'] ?? null,
            $meta['total'] ?? null,
            $meta['totalItems'] ?? null,
            $meta['total_items'] ?? null,
            $payload['total'] ?? null,
        ] as $candidate) {
            $total = $this->readPositiveInt($candidate);
            if ($total > 0) {
                break;
            }
        }
        if ($pages === 0 && $total > 0) {
            $pages = (int) ceil($total / max(1, $perPage));
        }

        return ['pages' => $pages, 'total' => $total];
    }
}
