<?php

declare(strict_types=1);

function analyticsZeroStateAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$root = dirname(__DIR__);
$route = (string) file_get_contents($root . '/modules/analytics/routes.php');
$repository = (string) file_get_contents($root . '/modules/analytics/repositories/AnalyticsDatasetStateRepository.php');

foreach (['AnalyticsDatasetStateRepository', 'shouldDiscardForPrelaunchZeroState', 'prelaunch_zero_state'] as $needle) {
    analyticsZeroStateAssert(str_contains($route, $needle), 'Analytics route zero-state guard missing: ' . $needle);
}
foreach (['questions', 'filters', 'provas', 'SELECT EXISTS', 'information_schema.TABLES'] as $needle) {
    analyticsZeroStateAssert(str_contains($repository, $needle), 'Canonical zero-state evidence missing: ' . $needle);
}
analyticsZeroStateAssert(!str_contains($route, 'DELETE FROM analytics_lifecycle_events'), 'Analytics route must not clean data itself.');

fwrite(STDOUT, "AnalyticsZeroStateWiringTest: PASS\n");
