<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/data/DatasetAvailabilitySafeFreezeState.php';

function availabilitySafeAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$key = str_repeat('availability-safe-state-key-', 2);
$frozen = DatasetAvailabilitySafeFreezeState::sign([
    'runId' => 'phase13x-strict-window1-20260901T145759Z-canonical',
    'status' => 'FROZEN',
    'phase' => 'frozen',
    'createdAt' => '2026-09-01T14:58:01Z',
    'startEpoch' => 1788274679,
    'deadlineEpoch' => 1788368279,
    'frozenUnits' => ['cron.service'],
    'publicServingUnits' => ['nginx.service', 'php8.4-fpm.service', 'concursomestre-frontend.service'],
    'httpWriteBoundary' => [
        'allowedMethods' => ['GET', 'HEAD', 'OPTIONS'],
        'path' => '/etc/nginx/snippets/concursomestre-phase13x-http-freeze.conf',
        'sha256' => str_repeat('a', 64),
    ],
], $key);

$frozenValidation = DatasetAvailabilitySafeFreezeState::validate($frozen, 'phase13x-strict-window1-20260901T145759Z-canonical', $key);
availabilitySafeAssert($frozenValidation['valid'], 'A canonical frozen availability-safe state must validate.');
availabilitySafeAssert(
    DatasetAvailabilitySafeFreezeState::supersessionStatus($frozen) === 'REMAINS_AUTHORITATIVE',
    'A frozen availability-safe state must remain authoritative before the methodology transition.'
);

$superseded = DatasetAvailabilitySafeFreezeState::supersede(
    $frozen,
    'phase20br-coverage-20260901T180000Z',
    'COVERAGE_BASED_WRITER_VALIDATION'
);
$superseded = DatasetAvailabilitySafeFreezeState::sign($superseded, $key);
$supersededValidation = DatasetAvailabilitySafeFreezeState::validate($superseded, 'phase13x-strict-window1-20260901T145759Z-canonical', $key);
availabilitySafeAssert($supersededValidation['valid'], 'A superseded availability-safe state must remain signed and valid.');
availabilitySafeAssert(
    DatasetAvailabilitySafeFreezeState::supersessionStatus($superseded) === 'SUPERSEDED',
    'The superseded availability-safe state must expose the migrated methodology status.'
);

fwrite(STDOUT, "Availability-safe freeze state assertions passed.\n");
