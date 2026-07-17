<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

require_once __DIR__ . '/../../config/cron_lock.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/subscriptions/routes.php';

$limit = 50;
foreach (array_slice($argv, 1) as $argument) {
    if (str_starts_with($argument, '--limit=')) {
        $limit = max(1, min(500, (int) substr($argument, 8)));
    }
}

$lock = null;
$processed = 0;
$failed = 0;

try {
    $lock = acquireCronLockOrThrow('subscriptions_stripe_webhook_worker');
    $db = (new Database())->getConnection();
    $controller = buildSubscriptionsController($db);

    while ($processed < $limit) {
        try {
            $result = $controller->processNextQueuedStripeWebhook();
            if ($result === null) {
                break;
            }
            $processed++;
            fwrite(STDOUT, json_encode([
                'event' => 'stripe_webhook_processed',
                'eventId' => $result['eventId'] ?? null,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
        } catch (Throwable $exception) {
            $processed++;
            $failed++;
            fwrite(STDERR, json_encode([
                'event' => 'stripe_webhook_failed',
                'errorType' => get_class($exception),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
        }
    }
} catch (Throwable $exception) {
    $failed++;
    fwrite(STDERR, json_encode([
        'event' => 'stripe_webhook_worker_error',
        'errorType' => get_class($exception),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} finally {
    if ($lock instanceof CronLockHandle) {
        $lock->release();
    }
}

fwrite(STDOUT, json_encode([
    'event' => 'stripe_webhook_worker_finished',
    'processed' => $processed,
    'failed' => $failed,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);

exit($failed > 0 ? 1 : 0);
