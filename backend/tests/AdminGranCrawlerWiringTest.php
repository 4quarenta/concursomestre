<?php

declare(strict_types=1);

function adminGranCrawlerWiringAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$root = dirname($backend);
$service = (string) file_get_contents($backend . '/modules/admin/services/AdminGranCrawlerService.php');
$route = (string) file_get_contents($backend . '/modules/admin/gran_crawler_routes.php');
$endpoint = (string) file_get_contents($backend . '/api/admin/gran_crawler.php');
$queue = (string) file_get_contents($backend . '/modules/questions/services/PrivateQuestionIngestionService.php');
$questionsService = (string) file_get_contents($backend . '/modules/questions/services/QuestionsService.php');
$questionsRepository = (string) file_get_contents($backend . '/modules/questions/repositories/QuestionsRepository.php');
$worker = (string) file_get_contents($backend . '/scripts/workers/process_question_ingestion_jobs.php');
$component = (string) file_get_contents($root . '/src/app/admin/components/import/AdminGranCrawlerSection.tsx');
$reviewBatch = (string) file_get_contents($root . '/src/app/admin/components/import/AdminGranCrawlerReviewBatch.tsx');
$sections = (string) file_get_contents($root . '/src/app/admin/components/database/AdminDatabaseSections.tsx');
$bridge = (string) file_get_contents($root . '/src/app/admin/components/import/granExtensionBridge.ts');
$batchMigration = (string) file_get_contents($backend . '/database/migrations/20260802_010000_gran_crawler_batches.php');
$batchRollback = (string) file_get_contents($backend . '/database/rollbacks/20260802_010000_gran_crawler_batches.sql');
$batchMetadataMigration = (string) file_get_contents($backend . '/database/migrations/20260802_020000_gran_batch_collection_metadata.php');
$batchMetadataRollback = (string) file_get_contents($backend . '/database/rollbacks/20260802_020000_gran_batch_collection_metadata.sql');
$failureMigration = (string) file_get_contents($backend . '/database/migrations/20260804_010000_gran_question_failure_diagnostics.php');
$failureRollback = (string) file_get_contents($backend . '/database/rollbacks/20260804_010000_gran_question_failure_diagnostics.sql');
$failureHistoryMigration = (string) file_get_contents($backend . '/database/migrations/20260804_020000_gran_question_failure_history.php');
$failureHistoryRollback = (string) file_get_contents($backend . '/database/rollbacks/20260804_020000_gran_question_failure_history.sql');
$legacyEntry = (string) file_get_contents($backend . '/scripts/importers/questions/gran/index.php');

foreach ([
    'requireAdminSessionContext',
    "RateLimiter::enforceProfile('admin_crawler'",
    'AdminGranCrawlerService',
    'Cache-Control: private, no-store',
    "'runtime_store_unavailable'",
    'Response::serviceUnavailable(',
] as $needle) {
    adminGranCrawlerWiringAssert(str_contains($route, $needle), 'Protected admin route missing: ' . $needle);
}
adminGranCrawlerWiringAssert(
    str_contains($endpoint, 'handleAdminGranCrawlerRoute'),
    'Admin endpoint does not delegate to the protected route.'
);
adminGranCrawlerWiringAssert(
    str_contains($failureHistoryMigration, 'gran_question_publication_failures')
    && str_contains($failureHistoryMigration, 'canonical_payload_json')
    && str_contains($failureHistoryMigration, 'failure_history_synced_at')
    && str_contains($failureHistoryRollback, 'DROP TABLE IF EXISTS gran_question_publication_failures')
    && str_contains($queue, 'listGranQuestionFailures')
    && str_contains($queue, 'retryGranQuestionFailure')
    && str_contains($queue, 'retryGranQuestionFailures')
    && str_contains($queue, 'ignoreGranQuestionFailure')
    && str_contains($queue, 'ignoreAllGranQuestionFailures')
    && str_contains($queue, 'syncGranFailureHistory')
    && str_contains($route, "\$action === 'list_publication_failures'")
    && str_contains($route, "\$action === 'retry_publication_failure'")
    && str_contains($route, "\$action === 'ignore_all_publication_failures'")
    && str_contains($route, "\$action === 'retry_publication_failures'")
    && str_contains($route, "\$action === 'ignore_publication_failure'")
    && str_contains($component, 'data-testid="gran-publication-failure-history"'),
    'Falhas do crawler precisam permanecer moderaveis depois da retencao dos jobs.'
);
adminGranCrawlerWiringAssert(
    str_contains($queue, "['active', 'all', 'open', 'retrying', 'resolved', 'ignored']")
    && str_contains($queue, "status IN ('open', 'retrying')")
    && str_contains($service, "listGranQuestionFailures('active', 50)")
    && str_contains($service, "(\$input['status'] ?? 'active')"),
    'A lista operacional de falhas deve excluir questoes ja resolvidas.'
);
adminGranCrawlerWiringAssert(
    str_contains($component, "action: 'retry_publication_failures'")
    && str_contains($component, 'failureIds,')
    && str_contains($component, 'Tentar todas ({failureHistory.openCount})')
    && str_contains($component, "action: 'ignore_publication_failure'")
    && str_contains($component, 'Questoes com erro pendente ({failureHistory.total})')
    && str_contains($queue, "status = 'ignored'")
    && str_contains($queue, "WHERE id IN (")
    && str_contains($service, 'retryPublicationFailures')
    && str_contains($service, 'ignorePublicationFailure')
    && str_contains($service, 'ignoreAllPublicationFailures'),
    'Falhas devem permitir nova tentativa individual, repeticao em massa e baixa operacional auditavel.'
);
adminGranCrawlerWiringAssert(
    str_contains($component, 'Modo automatico')
    && str_contains($component, 'MAX_AUTOMATIC_IN_FLIGHT_BATCHES = 2')
    && str_contains($component, 'waitForOldestPublication')
    && str_contains($component, 'inFlightBatches.push({')
    && str_contains($component, 'const nextYear = exhaustedYear ? cursorYear + 1 : cursorYear;')
    && str_contains($component, "action: 'map_and_enqueue_publication'")
    && str_contains($component, 'fingerprintAutomaticInput({')
    && !str_contains($component, 'payloads: pagePayloads')
    && str_contains($component, "action: 'publication_batch_progress'")
    && str_contains($component, 'AUTOMATIC_BATCH_STATUS_POLL_MS = 12_000')
    && str_contains($component, 'ACTIVE_BATCH_STATUS_REFRESH_MS = 15_000')
    && str_contains($component, "document.visibilityState !== 'visible'")
    && str_contains($service, 'mapAndEnqueuePublication')
    && str_contains($route, "\$action === 'map_and_enqueue_publication'")
    && str_contains($bridge, 'collectGranQuestionById'),
    'Modo automatico deve mapear e enfileirar uma pagina na mesma requisicao, sem devolver e reenviar o payload canonico.'
);
adminGranCrawlerWiringAssert(
    str_contains($service, 'getPublicationBatchProgress')
    && str_contains($service, 'getBatchProgressByPublicId')
    && str_contains($queue, 'public function getBatchProgressByPublicId')
    && str_contains($route, "\$action === 'publication_batch_progress'"),
    'O acompanhamento do modo automatico deve usar um contrato resumido de progresso do lote.'
);
adminGranCrawlerWiringAssert(
    str_contains($route, "'idempotency_conflict'")
    && str_contains($route, 'Response::error($exception->getMessage(), 409'),
    'Colisao de idempotencia precisa retornar conflito, nunca falso erro de permissao.'
);
adminGranCrawlerWiringAssert(
    str_contains($queue, 'question_errors_json')
    && str_contains($queue, "'questionErrors' =>")
    && str_contains($sections, 'reviewQuestionQueueErrors')
    && str_contains($reviewBatch, 'reviewQuestionQueueErrors')
    && str_contains($failureMigration, 'ADD COLUMN question_errors_json')
    && str_contains($failureRollback, 'DROP COLUMN question_errors_json'),
    'Falhas por questao devem persistir diagnostico sanitizado e aparecer no card de revisao.'
);
adminGranCrawlerWiringAssert(
    str_contains($service, 'CURLOPT_FOLLOWLOCATION => false')
    && str_contains($service, 'CURLOPT_PROTOCOLS => CURLPROTO_HTTPS')
    && str_contains($service, "private const API_HOST = 'rota-api.grancursosonline.com.br'")
    && str_contains($service, "private const API_PATH = '/v1/elastic/questao'")
    && str_contains($service, "\$scheme !== 'https'")
    && str_contains($service, "\$host !== self::API_HOST")
    && str_contains($service, "\$path !== self::API_PATH")
    && !str_contains($service, 'HTTP_COOKIE')
    && !str_contains($service, 'INSERT INTO gran_responses'),
    'Cliente Gran deve ser restrito a HTTPS e ao endpoint oficial, sem persistir respostas remotas brutas.'
);
adminGranCrawlerWiringAssert(
    str_contains($queue, 'enqueueFromAdminSession')
    && str_contains($queue, "'admin-browser:' . \$actorUserId")
    && str_contains($worker, "\$job['actor_user_id']")
    && str_contains($worker, 'GranExamFileMaterializer.php')
    && str_contains($worker, '$granExamFileMaterializer->materialize($payload)')
    && str_contains($worker, 'GranQuestionAssetMaterializer.php')
    && str_contains($worker, '$granQuestionAssetMaterializer->materializeForIngestion($payload)')
    && str_contains($worker, "'itemFailures'"),
    'Queue and worker must preserve the actor and materialize official files and question assets.'
);
adminGranCrawlerWiringAssert(
    str_contains($questionsService, 'assertGranAssetWasMaterialized')
    && str_contains($questionsService, 'A imagem da Gran nao foi copiada'),
    'Canonical persistence must reject Gran image URLs that bypassed materialization.'
);
adminGranCrawlerWiringAssert(
    str_contains($questionsService, "'files' => array_values(array_filter(")
    && str_contains($questionsService, "\$examPayload['files']")
    && str_contains($questionsRepository, 'syncImportedExamFiles')
    && str_contains($questionsRepository, '$this->syncImportedExamFiles((int) $externalSourceId, $record);'),
    'Exam files must flow from canonical metadata to prova_arquivos.'
);
adminGranCrawlerWiringAssert(
    !str_contains($component, 'sessionStorage')
    && !str_contains($component, 'document.cookie')
    && !str_contains($component, 'granAccessToken')
    && str_contains($component, "GRAN_LAST_YEAR_STORAGE_KEY = 'admin.granCrawler.lastYear'")
    && str_contains($component, "action: 'map'")
    && str_contains($component, 'granExamFiles: collection.examFiles')
    && str_contains($component, 'granAssetData: collection.assetData || {}')
    && str_contains($service, 'normalizeGranAssetData')
    && str_contains($service, 'hydrateCapturedGranAssets')
    && str_contains($component, 'collectGranQuestions'),
    'Frontend deve coletar pela extensao sem receber credenciais Gran e entregar somente imagens capturadas em base64.'
);
adminGranCrawlerWiringAssert(
    str_contains($service, 'MAX_QUESTIONS_PER_PAGE = 1000')
    && str_contains($component, 'MAX_GRAN_QUESTIONS_PER_PAGE = 1000')
    && str_contains($component, 'setResult(data);')
    && !str_contains($component, 'mergeGranReviewPayloads'),
    'Each query must replace the review queue and support up to 1,000 requested questions.'
);
adminGranCrawlerWiringAssert(
    str_contains($route, "\$action === 'map'")
    && str_contains($route, 'mapBrowserResponse')
    && str_contains($route, "'exam_count' => count(\$result['payloads'] ?? [])")
    && str_contains($route, 'server_side_collection_retired')
    && str_contains($service, 'gran_browser_extension')
    && str_contains($service, 'mapQuestionImportPayloads')
    && str_contains($service, "'sourceExamKey' =>")
    && str_contains($service, "'provider' => 'gran'")
    && str_contains($service, 'normalizeGranExamFiles'),
    'Backend must map only the extension JSON and retain Gran source identity.'
);
adminGranCrawlerWiringAssert(
    str_contains($component, "(result?.payloads?.length || 0) > 0 && renderReviewQueue")
    && str_contains($component, 'renderReviewQueue(result?.payloads || []')
    && !str_contains($component, 'Revisar no importador')
    && !str_contains($component, 'handleReviewPayload')
    && !str_contains($component, "action: 'enqueue'")
    && !str_contains($component, 'const [examTitle, setExamTitle]'),
    'Collection must enter the canonical review queue automatically without a global exam title.'
);
adminGranCrawlerWiringAssert(
    str_contains($sections, 'AdminGranCrawlerReviewBatch')
    && str_contains($sections, 'renderReviewQueue={(payloads, queueContext)')
    && str_contains($sections, 'filteredPayloads.map((payload, payloadIndex)')
    && str_contains($reviewBatch, 'useAdminQuestionWorkbench')
    && str_contains($reviewBatch, 'importEnabled: false')
    && str_contains($reviewBatch, 'importWorkflowProps.onImportFromAiJson(payloadJson,')
    && str_contains($reviewBatch, '<AdminImportSection')
    && str_contains($reviewBatch, 'reviewOnly'),
    'Gran cards must use the same complete import editor in review-only mode.'
);
adminGranCrawlerWiringAssert(
    str_contains($route, "\$action === 'enqueue_publication'")
    && str_contains($service, 'enqueueBatchFromAdminSession')
    && str_contains($queue, 'MAX_QUESTIONS_PER_BATCH = 5000')
    && str_contains($queue, 'DEFAULT_MAX_QUESTIONS_PER_JOB = 1000')
    && str_contains($queue, 'MAX_PAYLOADS_PER_JOB = 50')
    && str_contains($queue, 'private_ingestion_batches')
    && str_contains($worker, 'bulkImportQuestionBatches')
    && str_contains($sections, "action: 'enqueue_publication'")
    && str_contains($sections, 'Publicar prontas'),
    'Mass publication must use one parent batch and bounded asynchronous child jobs.'
);
adminGranCrawlerWiringAssert(
    str_contains($batchMigration, 'gran_taxonomy_sync_manifests')
    && str_contains($batchMigration, 'private_ingestion_batches')
    && str_contains($batchMigration, 'fk_private_ingestion_jobs_batch')
    && str_contains($batchRollback, 'DROP FOREIGN KEY fk_private_ingestion_jobs_batch')
    && str_contains($batchRollback, 'DROP TABLE IF EXISTS private_ingestion_batches'),
    'Crawler batch and manifest schema require an additive migration and explicit rollback.'
);
adminGranCrawlerWiringAssert(
    str_contains($service, "'collectionPage' => \$request['page']")
    && str_contains($queue, 'collection_pages_json')
    && str_contains($queue, 'summarizeJobPayload')
    && str_contains($batchMetadataMigration, 'ADD COLUMN collection_pages_json')
    && str_contains($batchMetadataRollback, 'DROP COLUMN collection_pages_json')
    && str_contains($component, 'currentBatch.displayName'),
    'Crawler must retain collection metadata while exposing only the current processing summary.'
);
adminGranCrawlerWiringAssert(
    str_contains($component, 'fetchGranCrawlerBootstrap')
    && str_contains($component, 'bootstrapRequest = apiClient.get(ENDPOINT, { signal: controller.signal })')
    && str_contains($component, 'if (bootstrapRequest) return bootstrapRequest;')
    && str_contains($component, 'BOOTSTRAP_CACHE_MS = 60_000')
    && str_contains($component, 'isTaxonomyVerificationFresh')
    && str_contains($component, 'renderReviewQueue(result?.payloads || []')
    && str_contains($component, 'Limpar fila'),
    'Crawler UI must use one cached bootstrap and an accumulated review queue.'
);
adminGranCrawlerWiringAssert(
    str_contains($queue, 'getCurrentProcessingBatch')
    && str_contains($queue, "CASE WHEN status IN ('pending', 'processing') THEN 0 ELSE 1 END")
    && str_contains($service, "'currentBatch' => \$ingestion->getCurrentProcessingBatch(\$actorUserId)")
    && !str_contains($route, "\$_GET['history_cursor']")
    && str_contains($component, 'gran-current-processing')
    && !str_contains($component, 'gran-processing-history-pagination'),
    'Crawler must expose only the authenticated actor current processing summary.'
);
adminGranCrawlerWiringAssert(
    str_contains($queue, 'pruneCompletedProcessingRecords')
    && str_contains($queue, "GET_LOCK('question_ingestion_retention', 0)")
    && str_contains($worker, 'QUESTION_INGESTION_RETENTION_DAYS')
    && str_contains($worker, 'pruneCompletedProcessingRecords'),
    'Completed processing records require bounded automatic retention cleanup.'
);
adminGranCrawlerWiringAssert(
    str_contains($bridge, 'window.postMessage')
    && str_contains($bridge, 'event.origin !== window.location.origin')
    && str_contains($bridge, 'detectGranCollector')
    && str_contains($bridge, 'EXTENSION_MARKER_ATTRIBUTE')
    && str_contains($component, 'const presencePromise = detectGranCollector()')
    && !str_contains($bridge, 'granAccessToken'),
    'Extension bridge must validate origin and never transport the bearer token.'
);
adminGranCrawlerWiringAssert(
    str_contains($legacyEntry, 'http_response_code(410)'),
    'Legacy public Gran importer entry must remain retired.'
);

fwrite(STDOUT, "AdminGranCrawlerWiringTest: PASS\n");
