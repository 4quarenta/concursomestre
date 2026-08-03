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
    str_contains($service, 'CURLOPT_FOLLOWLOCATION => false')
    && str_contains($service, 'CURLOPT_PROTOCOLS => CURLPROTO_HTTPS')
    && str_contains($service, "private const API_HOST = 'rota-api.grancursosonline.com.br'")
    && str_contains($service, "private const API_PATH = '/v1/elastic/questao'")
    && str_contains($service, "\$scheme !== 'https'")
    && str_contains($service, "\$host !== self::API_HOST")
    && str_contains($service, "\$path !== self::API_PATH")
    && !str_contains($service, 'HTTP_COOKIE')
    && !str_contains($service, 'INSERT INTO gran'),
    'Gran client must be restricted to HTTPS and the known official endpoint.'
);
adminGranCrawlerWiringAssert(
    str_contains($queue, 'enqueueFromAdminSession')
    && str_contains($queue, "'admin-browser:' . \$actorUserId")
    && str_contains($worker, "\$job['actor_user_id']")
    && str_contains($worker, 'GranExamFileMaterializer.php')
    && str_contains($worker, '$granExamFileMaterializer->materialize($payload)'),
    'Queue and worker must preserve the administrative actor and materialize official files.'
);
adminGranCrawlerWiringAssert(
    str_contains($questionsService, "'files' => array_values(array_filter(")
    && str_contains($questionsService, "\$examPayload['files']")
    && str_contains($questionsRepository, 'syncImportedExamFiles')
    && str_contains($questionsRepository, '$this->syncImportedExamFiles((int) $externalSourceId, $record);'),
    'Exam files must flow from canonical metadata to prova_arquivos.'
);
adminGranCrawlerWiringAssert(
    !str_contains($component, 'localStorage')
    && !str_contains($component, 'sessionStorage')
    && !str_contains($component, 'document.cookie')
    && !str_contains($component, 'granAccessToken')
    && str_contains($component, "action: 'map'")
    && str_contains($component, 'granExamFiles: collection.examFiles')
    && str_contains($component, 'collectGranQuestions'),
    'Frontend must collect through the extension without receiving Gran credentials.'
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
    str_contains($component, 'reviewQueues.pendingPayloads.length > 0 && renderReviewQueue')
    && !str_contains($component, 'Revisar no importador')
    && !str_contains($component, 'handleReviewPayload')
    && !str_contains($component, "action: 'enqueue'")
    && !str_contains($component, 'examTitle'),
    'Collection must enter the canonical review queue automatically without a global exam title.'
);
adminGranCrawlerWiringAssert(
    str_contains($sections, 'AdminGranCrawlerReviewBatch')
    && str_contains($sections, 'renderReviewQueue={(payloads, queueContext)')
    && str_contains($sections, 'payloads.map((payload, payloadIndex)')
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
    && str_contains($component, 'batch.displayName')
    && str_contains($component, 'Job #{job.jobId}'),
    'Crawler batches and jobs must expose compact persisted collection details.'
);
adminGranCrawlerWiringAssert(
    str_contains($component, 'fetchGranCrawlerBootstrap')
    && substr_count($component, 'apiClient.get(ENDPOINT)') === 1
    && str_contains($component, 'BOOTSTRAP_CACHE_MS = 60_000')
    && str_contains($component, 'isTaxonomyVerificationFresh')
    && str_contains($component, 'reviewQueues.publishedPayloads')
    && str_contains($component, 'Limpar fila'),
    'Crawler UI must use one cached bootstrap and an accumulated review queue.'
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
