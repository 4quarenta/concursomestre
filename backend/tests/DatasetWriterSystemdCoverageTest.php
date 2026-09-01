<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/data/DatasetWriterSystemdCoverage.php';

function systemdCoverageAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$state = [
    'units' => [
        'active.service' => ['ActiveState' => 'active'],
        'inactive.service' => ['ActiveState' => 'inactive'],
    ],
];

systemdCoverageAssert(
    DatasetWriterSystemdCoverage::expectedActiveState($state, 'active.service') === 'active',
    'Active pre-freeze state must be preserved.'
);
systemdCoverageAssert(
    DatasetWriterSystemdCoverage::evaluate('active', 'active')['ok'],
    'Active unit restored as active must pass.'
);
systemdCoverageAssert(
    !DatasetWriterSystemdCoverage::evaluate('active', 'inactive')['ok'],
    'Active unit restored as inactive must fail.'
);
systemdCoverageAssert(
    DatasetWriterSystemdCoverage::evaluate('inactive', 'inactive')['classification'] === 'INACTIVE_AS_BEFORE_FREEZE',
    'Inactive unit must remain a valid inactive no-op after resume.'
);
systemdCoverageAssert(
    !DatasetWriterSystemdCoverage::evaluate('inactive', 'active')['ok'],
    'Coverage must not activate a unit that was inactive before freeze.'
);

try {
    DatasetWriterSystemdCoverage::expectedActiveState($state, 'unknown.service');
    throw new RuntimeException('Missing unit evidence must fail closed.');
} catch (RuntimeException $exception) {
    systemdCoverageAssert(
        str_contains($exception->getMessage(), 'does not cover unit'),
        'Missing unit evidence must report the exact blocker.'
    );
}

fwrite(STDOUT, "Systemd coverage state assertions passed.\n");
