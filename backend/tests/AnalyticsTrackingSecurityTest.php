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
    'metadata' => ['step' => 'plans'],
], ['user_id' => 'u-real']);

assertAnalyticsCondition(
    ($repository->lastPayload['user_id'] ?? null) === 'u-real',
    'Authenticated analytics events must use the session user_id, not the client payload userId.'
);

$service->track([
    'eventName' => 'plan_viewed',
    'userId' => 'u-spoof',
], null);

assertAnalyticsCondition(
    array_key_exists('user_id', $repository->lastPayload) && $repository->lastPayload['user_id'] === null,
    'Anonymous analytics events must not accept client-supplied userId.'
);

try {
    $service->track([
        'eventName' => 'plan_viewed',
        'metadata' => ['payload' => str_repeat('x', 9000)],
    ], null);
    throw new RuntimeException('Oversized analytics metadata should be rejected.');
} catch (InvalidArgumentException $expected) {
}

fwrite(STDOUT, "Analytics tracking security assertions passed.\n");
