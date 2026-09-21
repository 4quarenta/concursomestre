<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$campaignService = file_get_contents($root . '/modules/marketing/services/MarketingCampaignService.php');
$campaignRepository = file_get_contents($root . '/modules/marketing/repositories/MarketingCampaignRepository.php');
$worker = file_get_contents($root . '/modules/marketing_automation/services/MarketingAutomationService.php');
$workerRepository = file_get_contents($root . '/modules/marketing_automation/repositories/MarketingAutomationRepository.php');
$cli = file_get_contents($root . '/scripts/tasks/process_marketing_automations.php');
$campaignUi = file_get_contents(dirname($root) . '/src/app/admin/components/marketing/AdminCampaignOperations.tsx');

foreach ([$campaignService, $campaignRepository, $worker, $workerRepository, $cli, $campaignUi] as $source) {
    if (!is_string($source) || trim($source) === '') {
        throw new RuntimeException('Marketing worker audience source is missing.');
    }
}

foreach ([
    'RULE_FIELDS = [\'account_age_days\', \'plan\', \'role\', \'user_id\']',
    'workerCampaignBatch(',
    'workerRecipientEligibility(',
    'listWorkerAudienceBatch(',
    'MARKETING_EMAIL_PREFERENCE_DISABLED',
    'CommunicationService::fromDatabase',
] as $needle) {
    if (!str_contains((string) $campaignService . (string) $campaignRepository . (string) $worker, (string) $needle)) {
        throw new RuntimeException('Campaign audience contract is missing: ' . $needle);
    }
}

if (!str_contains((string) $campaignRepository, 'LIMIT \' . $limit')
    || !str_contains((string) $campaignRepository, "COALESCE(u.role, 'user') NOT IN ('admin', 'staff')")
    || !str_contains((string) $cli, "marketingAutomationCliOption('campaign-id'")) {
    throw new RuntimeException('Campaign audience query or scoped CLI contract is not bounded.');
}
if (!str_contains((string) $campaignUi, 'Todos os usuários elegíveis')
    || !str_contains((string) $campaignUi, 'ID do usuário')) {
    throw new RuntimeException('Admin campaign UI does not expose audience scope.');
}
if (str_contains((string) $worker, 'M20F07_SYNTHETIC') || str_contains((string) $campaignService, 'test_namespace')) {
    throw new RuntimeException('Test-only audience semantics must not enter product code.');
}

echo "Marketing worker campaign scope contract: PASS\n";
