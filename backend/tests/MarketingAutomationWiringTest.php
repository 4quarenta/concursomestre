<?php

declare(strict_types=1);

function assertContainsMarketingAutomation(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

foreach ([
    '/modules/marketing_automation/repositories/MarketingAutomationRepository.php',
    '/modules/marketing_automation/services/MarketingAutomationService.php',
    '/scripts/tasks/process_marketing_automations.php',
    '/database/migrations/20260501_marketing_automation_events.sql',
] as $file) {
    if (!is_file($base . $file)) {
        throw new RuntimeException('Marketing automation file is missing: ' . $file);
    }
}

foreach ([
    'CREATE TABLE IF NOT EXISTS marketing_automation_events',
    'UNIQUE KEY uq_marketing_automation_event',
    'claimEvent',
] as $needle) {
    assertContainsMarketingAutomation(
        $base . '/modules/marketing_automation/repositories/MarketingAutomationRepository.php',
        $needle,
        'Marketing automation repository must be idempotent'
    );
}

foreach ([
    'recent_signup',
    'near_subscription',
    'inactive_7_days',
    'trial_ending',
    'saved_questions',
    'elite_upgrade',
] as $condition) {
    assertContainsMarketingAutomation(
        $base . '/modules/marketing_automation/repositories/MarketingAutomationRepository.php',
        $condition,
        'Marketing automation repository must support condition ' . $condition
    );
}

foreach ([
    'createNotification',
    'Mailer::send',
    'resolveSystemEmailTemplate',
    'marketing_campaign_message',
    'normalizeActionUrl',
    "preg_match('/^https:\\/\\//i', \$candidate)",
    'dry_run',
] as $needle) {
    assertContainsMarketingAutomation(
        $base . '/modules/marketing_automation/services/MarketingAutomationService.php',
        $needle,
        'Marketing automation service must support notifications, email, safe URLs and dry-run'
    );
}

foreach ([
    "PHP_SAPI !== 'cli'",
    'acquireCronLockOrThrow',
    'PROCESS_MARKETING_AUTOMATIONS',
] as $needle) {
    assertContainsMarketingAutomation(
        $base . '/scripts/tasks/process_marketing_automations.php',
        $needle,
        'Marketing automation task must be CLI-only, locked and execute-gated'
    );
}

assertContainsMarketingAutomation(
    $base . '/database/schema.sql',
    'marketing_automation_events',
    'Main schema must include marketing automation events'
);

fwrite(STDOUT, "Marketing automation wiring assertions passed.\n");
