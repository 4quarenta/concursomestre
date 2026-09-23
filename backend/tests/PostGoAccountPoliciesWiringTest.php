<?php

declare(strict_types=1);

function assertPostGoPolicyContains(string $source, string $needle, string $message): void
{
    if (strpos($source, $needle) === false) {
        throw new RuntimeException($message);
    }
}

function assertPostGoPolicyFileContains(string $relativePath, string $needle, string $message): void
{
    $path = dirname(__DIR__) . '/' . $relativePath;
    $source = file_get_contents($path);
    if (!is_string($source) || strpos($source, $needle) === false) {
        throw new RuntimeException($message . ' [' . $relativePath . ']');
    }
}

$billingPolicy = file_get_contents(dirname(__DIR__) . '/shared/billing/BillingAccountAccessPolicy.php');
$subscriptions = file_get_contents(dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php');
$authSession = file_get_contents(dirname(__DIR__) . '/shared/auth/AuthSession.php');
$jwt = file_get_contents(dirname(__DIR__) . '/shared/auth/JWTAuth.php');
$auth = file_get_contents(dirname(__DIR__) . '/modules/auth/services/AuthService.php');
$repository = file_get_contents(dirname(__DIR__) . '/modules/auth/repositories/AuthRepository.php');
$transactions = file_get_contents(dirname(__DIR__) . '/modules/transactions/services/TransactionsService.php');
$analytics = file_get_contents(dirname(__DIR__) . '/modules/admin/services/AdminAnalyticsService.php');

foreach ([$billingPolicy, $subscriptions, $authSession, $jwt, $auth, $repository, $transactions, $analytics] as $source) {
    if (!is_string($source)) {
        throw new RuntimeException('Falha ao ler fonte de politica pos-go.');
    }
}

assertPostGoPolicyContains($billingPolicy, 'GRACE_PERIOD_HOURS = 72', 'Billing policy must define the approved 72-hour grace period.');
assertPostGoPolicyContains($billingPolicy, "grace_expires_at <= :cutoff", 'Grace expiry must block at the exact 72-hour boundary.');
assertPostGoPolicyContains($billingPolicy, "status = 'blocked'", 'Billing policy must persist a terminal account block.');
assertPostGoPolicyContains($billingPolicy, 'revokeAllUserSessionFamilies', 'Terminal account blocking must revoke existing session families.');
assertPostGoPolicyContains($billingPolicy, 'restriction_recovered', 'Billing recovery must be audited.');

assertPostGoPolicyContains($subscriptions, 'BillingAccountAccessPolicy::recordFailure', 'Invoice failure must start the persisted grace policy.');
assertPostGoPolicyContains($subscriptions, 'preserveAccessDuringBillingGraceOrRevoke', 'Invoice failure must preserve access during grace.');
assertPostGoPolicyContains($subscriptions, 'BillingAccountAccessPolicy::blockExpired', 'Stripe reconciliation must execute the bounded expiry worker.');
assertPostGoPolicyContains($subscriptions, "BillingAccountAccessPolicy::resolve", 'Paid invoices must resolve the account restriction.');

assertPostGoPolicyContains($authSession, 'BillingAccountAccessPolicy::assertCanAuthenticate', 'All issued sessions must pass account restriction policy.');
assertPostGoPolicyContains($jwt, 'billing_account_blocked', 'Existing access tokens must be rejected after account blocking.');
assertPostGoPolicyContains($auth, 'hash(\'sha256\', $token)', 'Password-reset tokens must be hashed before persistence.');
assertPostGoPolicyContains($auth, "'entityId' => \$tokenHash", 'Password-reset queue identity must not contain the raw reset token.');
assertPostGoPolicyContains($repository, 'hash(\'sha256\', $token)', 'Password-reset lookup and use must hash the presented token.');
assertPostGoPolicyContains($repository, ':legacy_token', 'Password-reset lookup must preserve one-time compatibility for existing legacy tokens.');
assertPostGoPolicyContains($transactions, '$paidEvidenceKeys', 'Transaction projections must reconcile approved Stripe evidence.');
assertPostGoPolicyContains($transactions, 'count($paidEvidenceKeys)', 'Transaction projections must not add future installments after an already paid cycle.');
assertPostGoPolicyContains($transactions, 'providerInvoiceId', 'Projection reconciliation must deduplicate by provider invoice identity.');
assertPostGoPolicyContains($analytics, 'resolveProjectionPaidInstallments', 'Admin projections must reconcile approved Stripe evidence before counting future installments.');
assertPostGoPolicyContains($analytics, 'provider_invoice_id', 'Admin projections must deduplicate paid evidence by provider invoice identity.');

assertPostGoPolicyFileContains(
    'database/migrations/20260923_040000_post_go_account_policies.php',
    'account_access_restrictions',
    'Post-go migration must persist billing restrictions.'
);
assertPostGoPolicyFileContains(
    'database/migrations/20260923_040000_post_go_account_policies.php',
    "delivery_status",
    'Verification delivery status must be available for safe cleanup eligibility.'
);
assertPostGoPolicyFileContains(
    'modules/users/services/UnverifiedAccountCleanupService.php',
    'requestedMode = strtolower(trim((string) ($options[\'mode\'] ?? \'dry-run\')))',
    'Cleanup must default to dry-run.'
);
assertPostGoPolicyFileContains(
    'modules/users/services/UnverifiedAccountCleanupService.php',
    'UNVERIFIED_CLEANUP_EXECUTION_ENABLED',
    'Cleanup execution must remain disabled until an explicit operational gate is enabled.'
);
assertPostGoPolicyFileContains(
    'scripts/tasks/cleanup_unverified_accounts.php',
    "'UNVERIFIED_ACCOUNT_CLEANUP'",
    'Destructive cleanup must require an explicit execution token.'
);

fwrite(STDOUT, "Post-go account policy wiring assertions passed.\n");
