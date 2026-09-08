<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$service = (string) file_get_contents($root . '/modules/transactions/services/TransactionsService.php');
$validator = (string) file_get_contents($root . '/modules/transactions/validators/TransactionsValidator.php');
$repository = (string) file_get_contents($root . '/modules/transactions/repositories/TransactionsRepository.php');
$routes = (string) file_get_contents($root . '/modules/transactions/routes.php');
$migration = (string) file_get_contents($root . '/database/migrations/20260907_120000_refund_retention_offers.php');
$benefit = (string) file_get_contents($root . '/modules/benefits/services/BenefitService.php');
$mailer = (string) file_get_contents($root . '/shared/utils/Mailer.php');

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
$assert(str_contains($routes, 'function assertTransactionsMutationCsrf'), 'Transaction mutations require the shared CSRF guard.');
$assert(substr_count($routes, 'assertTransactionsMutationCsrf();') >= 4, 'Refund and retention mutation routes must use the CSRF guard.');
$assert(str_contains($service, 'processExpiredRefundRetentionOffers'), 'Retention expiration requires an autonomous processing path.');
$assert(str_contains($service, 'Oferta de retenção expirada'), 'Expired offers must use the canonical refund reason.');
$assert(str_contains($repository, 'findNextExpiredRetentionOfferCandidate'), 'Expired offer processing must use a bounded repository candidate query.');
$assert(str_contains($mailer, 'CM_SYNTHETIC_EMAIL_SINK'), 'Synthetic billing tests must have an explicit no-delivery sink.');
$assert(str_contains($mailer, "PHP_SAPI === 'cli'"), 'Synthetic email isolation must be limited to CLI acceptance runs.');
$assert(substr_count($validator, "max_range' => 366") === 1, 'Retention days must retain one explicit technical upper guardrail.');

fwrite(STDOUT, "Refund retention offer contract assertions passed.\n");
