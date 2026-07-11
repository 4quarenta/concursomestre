<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este worker so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/routes.php';
require_once __DIR__ . '/../../modules/questions/services/PrivateQuestionIngestionService.php';

$actorUserId = trim((string) (getenv('QUESTION_INGESTION_ACTOR_ID') ?: ''));
if ($actorUserId === '') {
    fwrite(STDERR, "Defina QUESTION_INGESTION_ACTOR_ID para processar a fila.\n");
    exit(2);
}

$maxJobs = max(1, min(100, (int) ($argv[1] ?? 10)));
$db = (new Database())->getConnection();
$ingestion = new PrivateQuestionIngestionService($db);
$processed = [];

for ($index = 0; $index < $maxJobs; $index++) {
    $job = $ingestion->reserveNextJob();
    if ($job === null) {
        break;
    }
    try {
        $payload = json_decode((string) $job['payload_json'], true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($payload)) {
            throw new InvalidArgumentException('Payload de job invalido.');
        }
        $result = buildQuestionsController($db)->bulkImportQuestions($actorUserId, true, $payload, null);
        $ingestion->completeJob((int) $job['id'], (int) $job['request_id'], $result);
        $processed[] = ['jobId' => (int) $job['id'], 'status' => 'done'];
    } catch (Throwable $exception) {
        $ingestion->failJob((int) $job['id'], (int) $job['request_id'], $exception);
        $processed[] = ['jobId' => (int) $job['id'], 'status' => 'failed'];
    }
}

fwrite(STDOUT, json_encode(['processed' => $processed], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
