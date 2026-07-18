<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$route = (string) file_get_contents($root . '/modules/subscriptions/routes.php');
$service = (string) file_get_contents($root . '/modules/subscriptions/services/SubscriptionsService.php');
$repository = (string) file_get_contents($root . '/modules/subscriptions/repositories/SubscriptionsRepository.php');
$worker = (string) file_get_contents($root . '/scripts/tasks/process_stripe_webhook_jobs.php');
$migration = (string) file_get_contents($root . '/database/migrations/20260717_020000_stripe_recovery_queue.php');
$cron = (string) file_get_contents(dirname($root) . '/config/deploy/cron.concursomestre.example');

if (!str_contains($route, 'enqueueStripeWebhook($payload, $signature)')) {
    throw new RuntimeException('A rota Stripe ainda processa o evento pesado de forma sincrona.');
}
foreach (['constructEvent', 'enqueueStripeWebhookEvent', 'processNextQueuedStripeWebhook'] as $needle) {
    if (!str_contains($service, $needle)) {
        throw new RuntimeException('Fluxo assincrono Stripe incompleto: ' . $needle);
    }
}
foreach ([
    'FOR UPDATE SKIP LOCKED',
    "status = 'processing'",
    'payload_json = NULL',
    'payload_json IS NOT NULL',
    "payload_json <> ''",
] as $needle) {
    if (!str_contains($repository, $needle)) {
        throw new RuntimeException('Fila duravel Stripe incompleta: ' . $needle);
    }
}
if (!str_contains($worker, "PHP_SAPI !== 'cli'")
    || !str_contains($worker, 'acquireCronLockOrThrow')
    || !str_contains($cron, 'process_stripe_webhook_jobs.php')
    || !str_contains($migration, 'idx_provider_webhook_queue')) {
    throw new RuntimeException('Worker, migration ou cron Stripe incompleto.');
}

echo "Async Stripe webhook wiring assertions passed.\n";
