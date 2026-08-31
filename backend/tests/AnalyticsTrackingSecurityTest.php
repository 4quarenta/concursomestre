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

require_once __DIR__ . '/../modules/analytics/services/AnalyticsTrackingService.php';

class AnalyticsTrackingRepositorySpy extends AnalyticsTrackingRepository
{
    public array $lastPayload = [];

    public function __construct()
    {
    }

    public function insertEvent(array $payload): void
    {
        $this->lastPayload = $payload;
    }
}

function assertAnalyticsCondition(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$repository = new AnalyticsTrackingRepositorySpy();
$service = new AnalyticsTrackingService($repository, new AnalyticsTrackingValidator());

$service->track([
    'eventName' => 'checkout_started',
    'userId' => 'u-attacker',
    'email' => 'person@example.com',
    'sessionKey' => 'raw-session-id',
    'originUrl' => 'https://example.com/checkout?token=secret',
    'metadata' => ['step' => 'plans', 'paymentIntentId' => 'pi_secret'],
], ['user_id' => 'u-real']);

assertAnalyticsCondition(
    ($repository->lastPayload['user_id'] ?? null) === null,
    'Analytics events must not persist direct authenticated identity.'
);
assertAnalyticsCondition(($repository->lastPayload['email'] ?? null) === null, 'Analytics must not persist email.');
assertAnalyticsCondition(($repository->lastPayload['session_key'] ?? null) === null, 'Analytics must not persist session ids.');
assertAnalyticsCondition(($repository->lastPayload['origin_url'] ?? null) === null, 'Analytics must not persist raw URLs.');
assertAnalyticsCondition(($repository->lastPayload['external_hooks_json'] ?? null) === null, 'Analytics must not persist caller hooks.');
assertAnalyticsCondition(
    ($repository->lastPayload['metadata_json'] ?? null) === '{"step":"plans"}',
    'Analytics metadata must use the explicit safe-key allowlist.'
);

$service->track([
    'eventName' => 'plan_viewed',
    'userId' => 'u-spoof',
], null);

assertAnalyticsCondition(
    array_key_exists('user_id', $repository->lastPayload) && $repository->lastPayload['user_id'] === null,
    'Anonymous analytics events must not accept client-supplied userId.'
);

$service->track([
    'eventName' => 'plan_viewed',
    'source' => 'test',
    'metadata' => ['reason' => 'provider detail', 'paymentIntentId' => 'pi_secret'],
], null);
assertAnalyticsCondition(
    ($repository->lastPayload['metadata_json'] ?? null) === null,
    'Analytics must discard non-contract metadata instead of persisting arbitrary values.'
);

try {
    $service->track(['eventName' => 'purchase_completed', 'source' => 'browser'], null);
    throw new RuntimeException('Browser analytics must not be allowed to assert a paid conversion.');
} catch (InvalidArgumentException $expected) {
}

fwrite(STDOUT, "Analytics tracking security assertions passed.\n");
