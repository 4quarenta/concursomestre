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

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../../config/cron_lock.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/subscriptions/routes.php';

$lock = null;
$coverageNoop = in_array('--coverage-noop', array_slice($argv, 1), true);

try {
    $lock = acquireCronLockOrThrow('subscriptions_stripe_reconciliation');

    $database = new Database();
    $db = $database->getConnection();
    $controller = buildSubscriptionsController($db);
    if ($coverageNoop) {
        fwrite(STDOUT, json_encode([
            'success' => true,
            'mode' => 'coverage-noop',
            'reconciliationReady' => true,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
        exit(0);
    }
    $summary = $controller->runStripeReconciliationCron();

    fwrite(STDOUT, json_encode([
        'success' => true,
        'summary' => $summary,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => 'Falha ao reconciliar assinaturas Stripe.',
        'details' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
} finally {
    if ($lock instanceof CronLockHandle) {
        $lock->release();
    }
}
