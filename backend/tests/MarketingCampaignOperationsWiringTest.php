<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$migration = file_get_contents($root . '/database/migrations/20260905_120000_marketing_campaign_operations.php');
$service = file_get_contents($root . '/modules/marketing/services/MarketingCampaignService.php');
$repository = file_get_contents($root . '/modules/marketing/repositories/MarketingCampaignRepository.php');
$routes = file_get_contents($root . '/modules/admin/routes.php');

foreach ([$migration, $service, $repository, $routes] as $source) {
    if (!is_string($source) || trim($source) === '') {
        throw new RuntimeException('Marketing campaign source is missing.');
    }
}

$required = [
    'marketing_segments',
    'marketing_campaigns',
    'marketing_campaign_interactions',
    'frequency_cap',
    'cooldown_hours',
    'max_impressions',
    'mutual_exclusion_group',
    'suppress_after_conversion',
    'idempotency_key',
];

foreach ($required as $needle) {
    if (!str_contains((string) $migration, $needle)) {
        throw new RuntimeException('Migration is missing required field: ' . $needle);
    }
}

foreach (['marketing_campaigns', 'marketing_segments', 'marketing_campaign_interactions'] as $needle) {
    if (!str_contains((string) $migration . (string) $repository, $needle)) {
        throw new RuntimeException('Marketing persistence wiring is missing: ' . $needle);
    }
}

if (!str_contains((string) $service . (string) $routes, 'marketing_campaign.transition')) {
    throw new RuntimeException('Marketing lifecycle wiring is missing: marketing_campaign.transition');
}

foreach (['findUserProfile', 'evaluateSegment', 'RULE_FIELDS', 'RULE_OPERATORS', 'CHANNELS', 'PLACEMENTS'] as $needle) {
    if (!str_contains((string) $service . (string) $repository, $needle)) {
        throw new RuntimeException('Marketing eligibility contract is missing: ' . $needle);
    }
}

if (str_contains((string) $service, 'system_settings')) {
    throw new RuntimeException('Marketing operations must not use system_settings as campaign authority.');
}

echo "Marketing campaign operations wiring: PASS\n";
