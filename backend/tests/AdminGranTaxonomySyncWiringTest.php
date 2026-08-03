<?php

declare(strict_types=1);

function granTaxonomySyncAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$root = dirname($backend);
$migration = (string) file_get_contents($backend . '/database/migrations/20260726_010000_gran_taxonomy_identity.php');
$rollback = (string) file_get_contents($backend . '/database/rollbacks/20260726_010000_gran_taxonomy_identity.sql');
$metadataMigration = (string) file_get_contents($backend . '/database/migrations/20260801_010000_filter_source_metadata_relations.php');
$metadataRollback = (string) file_get_contents($backend . '/database/rollbacks/20260801_010000_filter_source_metadata_relations.sql');
$syncService = (string) file_get_contents($backend . '/modules/admin/services/AdminGranTaxonomySyncService.php');
$crawlerService = (string) file_get_contents($backend . '/modules/admin/services/AdminGranCrawlerService.php');
$questionsService = (string) file_get_contents($backend . '/modules/questions/services/QuestionsService.php');
$repository = (string) file_get_contents($backend . '/modules/questions/repositories/QuestionsRepository.php');
$route = (string) file_get_contents($backend . '/modules/admin/gran_crawler_routes.php');
$bridge = (string) file_get_contents($root . '/src/app/admin/components/import/granExtensionBridge.ts');
$section = (string) file_get_contents($root . '/src/app/admin/components/import/AdminGranCrawlerSection.tsx');
$extensionWorker = (string) file_get_contents($root . '/browser-extension/gran-collector/service-worker.js');

foreach ([
    'source_provider',
    'source_entity_type',
    'source_external_id',
    'source_parent_external_id',
    'source_root_external_id',
    'uq_filters_source_identity',
    'idx_filters_source_parent',
] as $needle) {
    granTaxonomySyncAssert(
        str_contains($migration, $needle),
        'Migration de identidade externa incompleta: ' . $needle
    );
}
granTaxonomySyncAssert(
    str_contains($rollback, 'DROP COLUMN source_provider')
    && str_contains($rollback, 'DROP INDEX uq_filters_source_identity'),
    'Rollback da taxonomia Gran deve remover os campos e indices criados.'
);
granTaxonomySyncAssert(
    str_contains($metadataMigration, 'source_metadata_json')
        && str_contains($metadataMigration, 'filter_relationships')
        && str_contains($metadataMigration, 'uq_filter_relationship')
        && str_contains($metadataRollback, 'DROP TABLE IF EXISTS filter_relationships')
        && str_contains($metadataRollback, 'DROP COLUMN source_metadata_json'),
    'Metadados externos e relacoes multiplas precisam de migration aditiva e rollback.'
);
granTaxonomySyncAssert(
    str_contains($syncService, 'finalizeCargoRelations')
        && str_contains($syncService, "'cargo_career'")
        && str_contains($syncService, "'cargo_organization'")
        && str_contains($syncService, "'cargo_level'")
        && str_contains($syncService, 'careerExternalIds')
        && str_contains($syncService, 'organizationExternalIds')
        && str_contains($syncService, 'source_metadata_json')
        && str_contains($syncService, 'JSON_MERGE_PATCH'),
    'Cargos devem manter raiz primaria, relacoes multiplas e metadados da origem.'
);
foreach (["'assunto_tree'", "'assunto'", "'banca'", "'orgao'", "'cargo'", "'carreira'", "'area'"] as $kind) {
    granTaxonomySyncAssert(str_contains($syncService, $kind), 'Tipo Gran ausente da sincronizacao: ' . $kind);
}
granTaxonomySyncAssert(
    str_contains($syncService, "'area' => ['filterType' => 'carreira', 'entityType' => 'area'")
    && str_contains($syncService, 'finalizeSync')
    && str_contains($syncService, 'preserve_parent')
    && str_contains($syncService, 'hasSubjectHierarchy')
    && str_contains($syncService, 'findCanonicalMatchByParent'),
    'Area deve ser sincronizada como foco e a hierarquia oficial deve impedir assunto plano de virar materia.'
);
granTaxonomySyncAssert(
    strpos($section, "{ kind: 'carreira'") < strpos($section, "{ kind: 'cargo'")
        && strpos($section, "{ kind: 'orgao'") < strpos($section, "{ kind: 'cargo'"),
    'Carreiras e orgaos devem ser sincronizados antes dos cargos que os referenciam.'
);
granTaxonomySyncAssert(
    str_contains($route, "'sync_taxonomy_chunk'")
    && str_contains($route, "'sync_taxonomy_batch'")
    && str_contains($route, "'finalize_taxonomy_sync'")
    && str_contains($route, "'sync_missing_subject_roots'")
    && str_contains($route, "'resolve_subject_taxonomy_pending'")
    && str_contains($route, "'finalize_cargo_taxonomy_relations'")
    && str_contains($route, "'taxonomy_status'")
    && str_contains($route, 'AdminGranTaxonomySyncService')
    && str_contains($route, "'check_taxonomy_updates'")
    && str_contains($route, "'changedCategories'")
    && str_contains($route, "'checkedCatalogs'")
    && str_contains($route, "'mark_taxonomy_synced'")
    && substr_count($route, "RateLimiter::enforceProfile('admin_taxonomy_sync'") === 7,
    'Rotas administrativas da sincronizacao Gran ausentes.'
);
granTaxonomySyncAssert(
    str_contains($syncService, 'public function getStatus(): array')
    && str_contains($syncService, 'metadata_records')
    && str_contains($syncService, "'metadataRecords' => 0")
    && str_contains($syncService, 'source_provider = ?')
    && str_contains($syncService, 'source_entity_type IN ({$placeholders})')
    && str_contains($syncService, "'synchronized' => false")
    && str_contains($syncService, "'ready' => false"),
    'Servico deve informar status por identidade externa Gran, sem confundir filtros locais com catalogos sincronizados.'
);
granTaxonomySyncAssert(
    str_contains($syncService, 'getMissingSubjectRootExternalIds')
    && str_contains($syncService, 'getMissingSubjectReferences')
    && str_contains($syncService, 'source_parent_external_id')
    && str_contains($syncService, 'source_root_external_id')
    && str_contains($syncService, 'source_external_id IN ({$placeholders})'),
    'Toda cadeia pendente deve consultar em lote somente pais e raizes que ainda nao existem localmente.'
);
granTaxonomySyncAssert(
    str_contains($syncService, '$resolveHierarchy = function')
    && str_contains($syncService, 'isset($visiting[$externalId])')
    && str_contains($syncService, "'materia' => 'topico'"),
    'A conciliacao da arvore deve ser recursiva, deterministica e protegida contra ciclos.'
);
granTaxonomySyncAssert(
    str_contains($crawlerService, 'hydrateGranTaxonomyIds')
    && str_contains($crawlerService, "'sourceEntityType' => 'assunto'")
    && str_contains($crawlerService, 'mapGranFocusItems'),
    'Mapper deve preservar nivel, identidade e area/foco da Gran.'
);
granTaxonomySyncAssert(
    str_contains($repository, 'findFilterIdBySourceIdentity')
    && str_contains($questionsService, 'extractExternalTaxonomySourceIdentity')
    && str_contains($questionsService, 'Sincronize as taxonomias da Gran antes de publicar o lote.')
    && !str_contains($questionsService, "['parentId', 'parent_id', 'pai', 'assunto_raiz'"),
    'Publicacao Gran deve resolver identidade externa sem usar pai/raiz externos como IDs locais.'
);
granTaxonomySyncAssert(
    str_contains($bridge, 'COLLECT_TAXONOMY_BATCH')
    && str_contains($bridge, 'collectGranTaxonomyBatch')
    && str_contains($bridge, 'CHECK_TAXONOMY_UPDATES')
    && str_contains($bridge, 'checkGranTaxonomyUpdates')
    && str_contains($section, 'GRAN_TAXONOMY_STEPS')
    && str_contains($section, 'GRAN_TAXONOMY_CATEGORIES')
    && str_contains($section, "action: 'check_taxonomy_updates'")
    && str_contains($section, 'handleCheckTaxonomyUpdates')
    && str_contains($section, 'handleTaxonomySync')
    && str_contains($section, 'taxonomyExpanded')
    && str_contains($section, 'gran-taxonomy-check-result')
    && str_contains($section, 'Verificar atualizacoes'),
    'Painel deve verificar manifestos sem escrita, iniciar fechado e sincronizar apenas catalogos necessarios.'
);
granTaxonomySyncAssert(
    str_contains($route, "'taxonomy_hierarchy_gaps'")
    && str_contains($syncService, 'public function syncMissingSubjectRoots')
    && str_contains($syncService, 'recoverMissingSubjectRootsFromPublicCatalog')
    && str_contains($syncService, 'recoverPendingSubjectHierarchyFromPublicCatalog')
    && str_contains($syncService, 'getMissingSubjectHierarchyExternalIds')
    && str_contains($syncService, 'syncMissingSubjectHierarchyNodes')
    && str_contains($syncService, 'PUBLIC_SUBJECT_CATALOG_URL')
    && str_contains($syncService, '/open/elastic/assunto')
    && str_contains($syncService, "'&id%5B%5D='")
    && str_contains($syncService, '$recordsByExternalId')
    && str_contains($syncService, "\$record['materia'] = true")
    && str_contains($section, "action: 'resolve_subject_taxonomy_pending'")
    && str_contains($section, "action: 'taxonomy_hierarchy_gaps'")
    && !str_contains($bridge, 'collectGranPublicSubjectHierarchy')
    && str_contains($section, "collectGranTaxonomyBatch('assunto_tree', missingExternalIds)")
    && str_contains($section, 'requiresCollector')
    && str_contains($section, 'subjectHierarchyFinalized')
    && !str_contains($section, "collectGranTaxonomyBatch('assunto')")
    && !str_contains($section, 'shouldRecoverPendingOnly')
    && str_contains($section, 'canFinalizeCargoLocally')
    && str_contains($section, "action: 'finalize_cargo_taxonomy_relations'")
    && str_contains($section, "status?.synchronized ? 'Resolver pendencias'")
    && str_contains($section, 'summary.pending = Number(recovered?.finalized?.pending || 0)'),
    'Pendencias devem materializar somente pais e raizes ausentes pelo catalogo publico e exibir o saldo final.'
);
granTaxonomySyncAssert(
    str_contains($extensionWorker, 'const TAXONOMY_PAGE_SIZE = 1000;')
    && substr_count($extensionWorker, 'perPage: TAXONOMY_PAGE_SIZE') === 7
    && substr_count($syncService, "'perPage' => 1000") === 7
    && str_contains($extensionWorker, 'MAX_TAXONOMY_ROOTS_PER_REQUEST = 25')
    && str_contains($extensionWorker, 'MAX_TAXONOMY_ROOTS_PER_BATCH = 5000')
    && str_contains($extensionWorker, "params.append('raiz[]', rootExternalId)"),
    'A extensao e o backend devem processar taxonomias em paginas grandes e consistentes.'
);
granTaxonomySyncAssert(
    str_contains($syncService, 'public function syncBatch')
    && str_contains($route, "'granResponses'")
    && str_contains($section, 'splitGranTaxonomyResponses')
    && str_contains($section, 'finalizeRelations: false')
    && str_contains($section, '{ timeout: 120_000 }')
    && str_contains($section, 'finalizeCargoRelationsInChunks')
    && str_contains($section, '{ timeout: 80_000 }')
    && str_contains($section, 'nextCursor <= cursor')
    && str_contains($route, "array_key_exists('finalizeRelations', \$input)")
    && str_contains($route, 'finalizeCargoRelationsChunk')
    && str_contains($syncService, 'public function finalizeCargoRelationsChunk')
    && str_contains($syncService, 'filter_id > {$afterFilterId}')
    && str_contains($syncService, "pendingOnly ? ' AND cargo.parent_id IS NULL'")
    && str_contains($section, 'finalizeCargoRelationsInChunks(true)')
    && str_contains($section, 'finalizeCargoRelationsInChunks(false)')
    && str_contains($syncService, 'bool $finalizeRelations = true')
    && str_contains($syncService, '$finalizeRelations && in_array'),
    'Catalogos grandes devem usar lotes HTTP limitados e reconciliar cargos com cursor abaixo do timeout do proxy.'
);
granTaxonomySyncAssert(
    str_contains($section, 'fetchGranCrawlerBootstrap')
    && str_contains($section, 'BOOTSTRAP_CACHE_MS = 60_000')
    && substr_count($section, 'apiClient.get(ENDPOINT)') === 1
    && !str_contains($section, "action: 'taxonomy_status'")
    && !str_contains($section, "    handleVisibility();\n    document.addEventListener('visibilitychange'"),
    'O bootstrap deve carregar jobs, lotes e taxonomias uma vez e nao repetir o status em uma segunda rota.'
);
granTaxonomySyncAssert(
    str_contains($syncService, 'readDescription($record, $name)')
        && str_contains($syncService, 'readUrlCandidate($record')
        && str_contains($syncService, 'description = COALESCE(:description, description)')
        && str_contains($syncService, 'website = COALESCE(:website, website)')
        && str_contains($syncService, 'asset_url = COALESCE(:asset_url, asset_url)')
        && str_contains($syncService, 'preferCanonicalName(')
        && str_contains($syncService, 'INSERT IGNORE INTO filter_aliases')
        && str_contains($syncService, 'readAliases('),
    'Bancas devem sincronizar metadados institucionais sem apagar cadastro editorial existente.'
);
granTaxonomySyncAssert(
    str_contains($extensionWorker, "['_source[]', 'nome_completo']")
        && str_contains($extensionWorker, "['_source[]', 'sigla']")
        && str_contains($extensionWorker, "['_source[]', 'descricao']")
        && str_contains($extensionWorker, "['_source[]', 'website']")
        && str_contains($extensionWorker, "['_source[]', 'logo_url']")
        && str_contains($extensionWorker, "['_source[]', 'qtdQuestoes']")
        && str_contains($extensionWorker, "['_source[]', 'qtdProvas']")
        && str_contains($extensionWorker, "['_source[]', 'tiposProva']")
        && str_contains($extensionWorker, "['_source[]', 'palavrasChave']")
        && str_contains($extensionWorker, "['_source[]', 'qtdQuestoesNaoAcumulado']"),
    'Coletor deve solicitar metadados institucionais, editoriais e operacionais uteis.'
);

fwrite(STDOUT, "AdminGranTaxonomySyncWiringTest: PASS\n");
