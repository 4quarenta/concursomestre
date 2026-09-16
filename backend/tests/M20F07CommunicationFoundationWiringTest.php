<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$service = (string) file_get_contents($root . '/shared/communications/CommunicationService.php');
$policy = (string) file_get_contents($root . '/shared/communications/CommunicationPolicy.php');
$repository = (string) file_get_contents($root . '/shared/communications/CommunicationRepository.php');
$catalog = (string) file_get_contents($root . '/shared/communications/CommunicationEventCatalog.php');
$worker = (string) file_get_contents($root . '/scripts/workers/process_platform_events.php');
$migration = (string) file_get_contents($root . '/database/migrations/20260916_210000_communication_foundation.php');

$assert($service !== '' && $policy !== '' && $repository !== '' && $catalog !== '', 'Communication foundation files are missing.');
$assert(str_contains($service, 'communication.intent.dispatch'), 'Communication intent was not connected to the canonical outbox.');
$assert(str_contains($service, 'idempotencyKey'), 'Communication service must require stable idempotency.');
$assert(str_contains($service, 'CM_SYNTHETIC_EMAIL_SINK'), 'Synthetic email fail-closed guard is missing.');
$assert(str_contains($worker, 'CommunicationService::fromDatabase'), 'The real platform worker does not consume communications.');
$assert(str_contains($worker, 'dispatchEmail'), 'The platform worker does not dispatch canonical email deliveries.');
$directMailerCall = 'Mailer:' . ':send';
$assert(!str_contains((string) file_get_contents($root . '/modules/admin/services/AdminUserCommunicationService.php'), $directMailerCall), 'Support/moderation email still bypasses CommunicationService.');
$assert(!str_contains((string) file_get_contents($root . '/modules/marketing_automation/services/MarketingAutomationService.php'), $directMailerCall), 'Marketing email still bypasses CommunicationService.');
$assert(str_contains((string) file_get_contents($root . '/modules/notifications/services/NotificationsService.php'), 'CommunicationService::fromDatabase'), 'Admin notification endpoint still bypasses CommunicationService.');
$assert(str_contains($migration, 'communication_intents'), 'Communication intent schema is missing.');
$assert(str_contains($migration, 'uq_communication_intent_idempotency'), 'Communication intent idempotency constraint is missing.');
$assert(str_contains($migration, 'communication_audit_events'), 'Communication audit schema is missing.');
$assert(str_contains($policy, 'CLASS_TRANSACTIONAL') && str_contains($policy, 'CLASS_MARKETING'), 'Communication classes are not explicit.');
$assert(str_contains($catalog, 'marketing.campaign.message') && str_contains($catalog, 'billing.refund.retention_offer.created'), 'Communication event denominator is incomplete.');

fwrite(STDOUT, "M20F07 communication foundation wiring passed.\n");
