<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este worker so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/events/TransactionalOutbox.php';
require_once __DIR__ . '/../../modules/questions/repositories/QuestionsRepository.php';
require_once __DIR__ . '/../../modules/questions/services/QuestionsRewardService.php';

$limit = max(1, min(100, (int) ($argv[1] ?? 25)));
$workerSlot = preg_replace('/[^a-zA-Z0-9_-]/', '-', trim((string) (getenv('WORKER_SLOT') ?: 'manual'))) ?: 'manual';
$workerId = (gethostname() ?: 'worker') . ':' . $workerSlot . ':' . getmypid();
$db = (new Database())->getConnection();
$outbox = new TransactionalOutbox($db);
$repository = new QuestionsRepository($db);
$rewards = new QuestionsRewardService($repository);
$processed = 0;
$failed = 0;

foreach ($outbox->claimBatch($workerId, $limit) as $event) {
    try {
        $db->beginTransaction();
        $payload = json_decode((string) ($event['payload_json'] ?? ''), true);
        if (!is_array($payload)) {
            throw new RuntimeException('Payload do evento assincrono invalido.');
        }

        if ((string) ($event['event_type'] ?? '') === 'question.answer.recorded') {
            $userId = trim((string) ($payload['userId'] ?? ''));
            if ($userId === '') {
                throw new RuntimeException('Evento de resposta sem usuario.');
            }
            $rewards->applyAnswerProgressRewards($userId, !empty($payload['isCorrect']));
            $snapshot = $repository->findUserProgressSnapshot($userId);
            if (is_array($snapshot)
                && (int) ($snapshot['level'] ?? 1) > (int) ($payload['levelBefore'] ?? 1)) {
                $rewards->applyLevelUpReward($snapshot);
            }
        } else {
            throw new RuntimeException('Tipo de evento sem consumidor: ' . (string) ($event['event_type'] ?? ''));
        }

        $outbox->markProcessed((int) $event['id']);
        $db->commit();
        $processed++;
    } catch (Throwable $exception) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        $outbox->markFailed($event, $exception);
        error_log('[platform-event-worker] ' . $exception->getMessage());
        $failed++;
    }
}

$result = [
    'worker' => $workerId,
    'slot' => $workerSlot,
    'claimed' => $processed + $failed,
    'processed' => $processed,
    'failed' => $failed,
    'finishedAt' => gmdate('c'),
];
$healthDir = dirname(__DIR__, 2) . '/storage/health/workers';
if ((is_dir($healthDir) || @mkdir($healthDir, 0775, true)) && is_dir($healthDir)) {
    @file_put_contents(
        $healthDir . '/platform-events-' . $workerSlot . '.json',
        json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        LOCK_EX
    );
}
fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);

exit($failed > 0 ? 1 : 0);
