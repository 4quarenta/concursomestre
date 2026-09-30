<?php

declare(strict_types=1);

// Each configured mode runs in its own PHP process because config uses constants.
$mode = $argv[1] ?? 'test';
if (!in_array($mode, ['test', 'live', 'unconfigured'], true)) {
    throw new InvalidArgumentException('Use test, live or unconfigured.');
}
require_once __DIR__ . '/../config/env.php';
$_ENV['STRIPE_SECRET_KEY'] = $mode === 'unconfigured' ? '' : 'sk_' . $mode . '_fixture';
$_ENV['STRIPE_WEBHOOK_SECRET'] = 'whsec_mode_guard_fixture';
$_ENV['STRIPE_PUBLISHABLE_KEY'] = '';
require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsService.php';

final class ModeGuardReachedQueue extends LogicException {}

final class ModeGuardRepository extends SubscriptionsRepository
{
    public ?array $job = null;
    public int $enqueues = 0;
    public int $failures = 0;

    public function __construct() {}

    public function enqueueStripeWebhookEvent(array $event): array
    {
        ++$this->enqueues;
        throw new ModeGuardReachedQueue();
    }

    public function claimNextStripeWebhookEvent(): ?array
    {
        return $this->job;
    }

    public function markProviderWebhookEventFailed(
        string $provider,
        string $eventId,
        string $errorMessage,
        ?string $claimToken = null,
        string $errorCode = 'PROCESSING_ERROR'
    ): void {
        ++$this->failures;
    }
}

final class ModeGuardService extends SubscriptionsService
{
    public int $dispatches = 0;

    public function processStripeWebhookEventObject(
        object $event,
        ?string $payloadHash = null,
        $stripeClient = null,
        ?string $preclaimedToken = null
    ): array {
        ++$this->dispatches;
        return ['received' => true];
    }
}

$repository = new ModeGuardRepository();
$service = (new ReflectionClass(ModeGuardService::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(SubscriptionsService::class, 'repository'))->setValue($service, $repository);
$assertions = 0;
$assert = static function (bool $condition, string $label) use (&$assertions): void {
    if (!$condition) {
        throw new RuntimeException($label);
    }
    ++$assertions;
};
$sign = static function (string $payload): string {
    $timestamp = time();
    return 't=' . $timestamp . ',v1=' . hash_hmac('sha256', $timestamp . '.' . $payload, STRIPE_WEBHOOK_SECRET);
};

foreach ([true, false, null, 'true', 'false', 1, 0, [], 'missing'] as $index => $liveMode) {
    $data = ['id' => 'evt_mode_fixture', 'object' => 'event', 'type' => 'capability.updated',
        'created' => time(), 'data' => ['object' => ['id' => 'cap_fixture']]];
    if ($liveMode !== 'missing') {
        $data['livemode'] = $liveMode;
    }
    $payload = json_encode($data, JSON_THROW_ON_ERROR);
    $signature = $sign($payload);
    $sdkEvent = \Stripe\Webhook::constructEvent($payload, $signature, STRIPE_WEBHOOK_SECRET);
    $allowed = is_bool($liveMode) && $mode !== 'unconfigured' && $liveMode === ($mode === 'live');
    if (is_bool($liveMode)) {
        $assert(!property_exists($sdkEvent, 'livemode'), 'Fixture must exercise real SDK magic properties.');
    }

    foreach ([$sdkEvent, json_decode($payload, false, 64, JSON_THROW_ON_ERROR)] as $event) {
        $accepted = false;
        try {
            assertStripeEventMatchesConfiguredMode($event);
            $accepted = true;
        } catch (RuntimeException $exception) {
            $assert(!str_contains($exception->getMessage(), STRIPE_SECRET_KEY ?: 'fixture'), 'Error must not expose credentials.');
        }
        $assert($accepted === $allowed, 'Mode guard result mismatch: ' . $mode . '/' . $index);
    }

    foreach (['enqueueStripeWebhook', 'processStripeWebhook', 'processNextQueuedStripeWebhook'] as $entrypoint) {
        $beforeEnqueues = $repository->enqueues;
        $beforeDispatches = $service->dispatches;
        $beforeFailures = $repository->failures;
        $repository->job = ['event_id' => 'evt_mode_fixture', 'claim_token' => 'fixture',
            'payload_json' => $payload, 'payload_hash' => hash('sha256', $payload)];
        try {
            $entrypoint === 'processNextQueuedStripeWebhook'
                ? $service->$entrypoint()
                : $service->$entrypoint($payload, $signature);
        } catch (ModeGuardReachedQueue) {
            // Reaching the repository is the acceptance boundary; never write to a database.
        } catch (RuntimeException) {
            $assert(!$allowed, 'Valid event was rejected at ' . $entrypoint);
        }
        $effects = ($repository->enqueues - $beforeEnqueues) + ($service->dispatches - $beforeDispatches);
        $assert($effects === ($allowed ? 1 : 0), 'Invalid event reached queue/domain at ' . $entrypoint);
        if ($entrypoint === 'processNextQueuedStripeWebhook') {
            $assert($repository->failures - $beforeFailures === ($allowed ? 0 : 1), 'Worker rejection must be recorded.');
        }
    }
}

if ($mode !== 'unconfigured') {
    foreach (['enqueueStripeWebhook', 'processStripeWebhook'] as $entrypoint) {
        $before = $repository->enqueues + $service->dispatches;
        $rejected = false;
        try {
            $service->$entrypoint($payload, 't=' . time() . ',v1=' . str_repeat('0', 64));
        } catch (\Stripe\Exception\SignatureVerificationException) {
            $rejected = true;
        }
        $assert($rejected && $before === $repository->enqueues + $service->dispatches, 'Invalid signature must be rejected before effects.');
    }
}
echo 'Stripe webhook mode ' . $mode . ': PASS (' . $assertions . " assertions)\n";
