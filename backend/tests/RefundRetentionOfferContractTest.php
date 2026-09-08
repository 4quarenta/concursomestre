<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$service = (string) file_get_contents($root . '/modules/transactions/services/TransactionsService.php');
$validator = (string) file_get_contents($root . '/modules/transactions/validators/TransactionsValidator.php');
$repository = (string) file_get_contents($root . '/modules/transactions/repositories/TransactionsRepository.php');
$migration = (string) file_get_contents($root . '/database/migrations/20260907_120000_refund_retention_offers.php');
$benefit = (string) file_get_contents($root . '/modules/benefits/services/BenefitService.php');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$assert(str_contains($migration, 'refund_retention_offers'), 'Retention offers require dedicated persistence.');
$assert(str_contains($migration, 'offered_days SMALLINT UNSIGNED'), 'Retention days must be persisted per offer.');
$assert(str_contains($migration, 'benefit_domain_events'), 'M20F-03 requires a domain-event store for future consumers.');
$assert(str_contains($validator, "min_range' => 1") && str_contains($validator, "max_range' => 366"), 'Retention days require bounded Admin input.');
$assert(str_contains($validator, "'offered_days' => (int) " . '$offeredDays'), 'The selected Admin days must survive validation.');
$assert(str_contains($service, "'source_scope' => 'REFUND_RETENTION_OFFER'"), 'Retention grants must use the canonical Benefit source.');
$assert(str_contains($service, 'BenefitService::EVENT_REFUND_RETENTION_OFFER_CREATED'), 'Offer creation must emit a domain event.');
$assert(str_contains($service, 'BenefitService::EVENT_REFUND_RETENTION_ACCEPTED'), 'Offer acceptance must emit a domain event.');
$assert(str_contains($service, 'BenefitService::EVENT_REFUND_RETENTION_DECLINED'), 'Offer decline must emit a domain event.');
$assert(str_contains($service, 'BenefitService::EVENT_REFUND_RETENTION_EXPIRED'), 'Offer expiration must emit a domain event.');
$assert(str_contains($service, 'BenefitService::EVENT_REFUND_COMPLETED'), 'Canonical refund completion must emit a domain event.');
$assert(str_contains($service, 'findTransactionByIdForUpdate'), 'Refund retention decisions must lock the transaction authority.');
$assert(str_contains($service, 'ACCEPTED_PENDING_BENEFIT'), 'Acceptance must remain recoverable until provider confirmation.');
$assert(str_contains($service, "'offered_days' => (int) " . "\$offer['offered_days']"), 'Provider grant metadata must use the selected offer days.');
$assert(str_contains($service, 'BillingExtensionService'), 'Retention acceptance must use BillingExtensionService.');
$assert(!str_contains($service, 'users.plan'), 'Retention flow must not mutate users.plan directly.');
$assert(!str_contains($service, 'UPDATE user_subscriptions'), 'Retention flow must not mutate user_subscriptions directly.');
$assert(str_contains($benefit, 'recordDomainEvent'), 'BenefitService must expose the transport-neutral domain-event contract.');
$assert(str_contains($benefit, 'sanitizeDomainPayload'), 'Domain event payloads must be sanitized.');

fwrite(STDOUT, "Refund retention offer contract assertions passed.\n");
