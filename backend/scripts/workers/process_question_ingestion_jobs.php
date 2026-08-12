<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este worker so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/routes.php';
require_once __DIR__ . '/../../modules/questions/services/PrivateQuestionIngestionService.php';
require_once __DIR__ . '/../../modules/questions/services/GranExamFileMaterializer.php';
require_once __DIR__ . '/../../modules/questions/services/GranQuestionAssetMaterializer.php';

$defaultActorUserId = trim((string) (getenv('QUESTION_INGESTION_ACTOR_ID') ?: ''));
if ($defaultActorUserId === '') {
    fwrite(STDERR, "Defina QUESTION_INGESTION_ACTOR_ID para processar a fila.\n");
    exit(2);
}

$maxJobs = max(1, min(100, (int) ($argv[1] ?? 10)));
$db = (new Database())->getConnection();
$ingestion = new PrivateQuestionIngestionService($db);
$granExamFileMaterializer = new GranExamFileMaterializer();
$granQuestionAssetMaterializer = new GranQuestionAssetMaterializer();
$processed = [];
$workerSlot = preg_replace('/[^a-zA-Z0-9_-]/', '-', trim((string) (getenv('WORKER_SLOT') ?: 'manual'))) ?: 'manual';
$workerId = sprintf('%s:%s:%d', gethostname() ?: 'worker', $workerSlot, getmypid());

for ($index = 0; $index < $maxJobs; $index++) {
    $job = $ingestion->reserveNextJob($workerId);
    if ($job === null) {
        break;
    }
    try {
        $actorUserId = trim((string) ($job['actor_user_id'] ?? '')) ?: $defaultActorUserId;
        $payload = json_decode((string) $job['payload_json'], true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($payload)) {
            throw new InvalidArgumentException('Payload de job invalido.');
        }
        $controller = buildQuestionsController($db);
        if (is_array($payload['batches'] ?? null)) {
            $materializationFailures = [];
            $materializedBatches = [];
            foreach (array_values($payload['batches']) as $batch) {
                if (!is_array($batch)) continue;
                $clientKey = trim((string) ($batch['clientKey'] ?? $batch['client_key'] ?? ''));
                $batchPayload = is_array($batch['payload'] ?? null) ? $batch['payload'] : $batch;
                $batchPayload = $granExamFileMaterializer->materialize($batchPayload);
                $materialized = $granQuestionAssetMaterializer->materializeForIngestion($batchPayload);
                foreach ($materialized['itemFailures'] as $failure) {
                    $materializationFailures[] = ($clientKey !== '' ? ['clientKey' => $clientKey] : []) + $failure;
                }
                if (($materialized['payload']['questions'] ?? []) === []) {
                    continue;
                }
                $batch['payload'] = $materialized['payload'];
                $materializedBatches[] = $batch;
            }
            if ($materializedBatches === []) {
                $result = ['success' => true, 'count' => 0, 'created' => [], 'itemFailures' => []];
            } else {
                $payload['batches'] = $materializedBatches;
                $result = $controller->bulkImportQuestionBatches($actorUserId, true, $payload);
            }
            $result['itemFailures'] = array_values(array_merge(
                $materializationFailures,
                is_array($result['itemFailures'] ?? null) ? $result['itemFailures'] : []
            ));
        } else {
            $payload = $granExamFileMaterializer->materialize($payload);
            $materialized = $granQuestionAssetMaterializer->materializeForIngestion($payload);
            if (($materialized['payload']['questions'] ?? []) === []) {
                $result = ['success' => true, 'count' => 0, 'created' => [], 'itemFailures' => []];
            } else {
                $result = $controller->bulkImportQuestions($actorUserId, true, $materialized['payload'], null);
            }
            $result['itemFailures'] = array_values(array_merge(
                $materialized['itemFailures'],
                is_array($result['itemFailures'] ?? null) ? $result['itemFailures'] : []
            ));
        }
        $ingestion->completeJob((int) $job['id'], (int) $job['request_id'], $result, $workerId);
        $processed[] = ['jobId' => (int) $job['id'], 'status' => 'done'];
    } catch (Throwable $exception) {
        $status = $ingestion->failJob((int) $job['id'], (int) $job['request_id'], $exception, $workerId);
        $processed[] = ['jobId' => (int) $job['id'], 'status' => $status];
    }
}

$retentionDays = max(1, min(30, (int) (getenv('QUESTION_INGESTION_RETENTION_DAYS') ?: 1)));
try {
    $failureHistoryBackfilled = $ingestion->backfillGranQuestionFailureHistory(100);
} catch (Throwable $exception) {
    error_log('[question-ingestion-failure-history] ' . $exception->getMessage());
    $failureHistoryBackfilled = 0;
}
try {
    $pruned = $ingestion->pruneCompletedProcessingRecords($retentionDays);
} catch (Throwable $exception) {
    error_log('[question-ingestion-retention] ' . $exception->getMessage());
    $pruned = ['batches' => 0, 'jobs' => 0, 'requests' => 0];
}

$result = [
    'worker' => $workerId,
    'slot' => $workerSlot,
    'processed' => $processed,
    'failureHistoryBackfilled' => $failureHistoryBackfilled,
    'pruned' => $pruned,
    'finishedAt' => gmdate('c'),
];
$healthDir = dirname(__DIR__, 2) . '/storage/health/workers';
if ((is_dir($healthDir) || @mkdir($healthDir, 0775, true)) && is_dir($healthDir)) {
    @file_put_contents(
        $healthDir . '/question-ingestion-' . $workerSlot . '.json',
        json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        LOCK_EX
    );
}
fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
