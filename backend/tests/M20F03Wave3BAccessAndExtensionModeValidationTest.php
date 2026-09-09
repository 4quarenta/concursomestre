<?php

declare(strict_types=1);

require_once __DIR__ . '/support/BillingStripeValidationSupport.php';
require_once __DIR__ . '/../modules/benefits/services/BenefitService.php';
require_once __DIR__ . '/../modules/billing/services/BillingExtensionService.php';

if (getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
    throw new RuntimeException('A prova exige CM_SYNTHETIC_EMAIL_SINK=1.');
}

$db = billingValidationConnectDb();
$stripe = getStripeClient();
$subscriptions = billingValidationCreateSubscriptionsService($db);
$settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails'];
$settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
$suffix = billingValidationMakeRunSuffix();
$userId = '';
$planId = null;
$customerId = '';
$clockId = '';
$subscriptionId = '';
$definitionId = '';
$grantId = '';

$periodEnd = static function (object $subscription): int {
    $direct = $subscription->current_period_end ?? null;
    if (is_numeric($direct) && (int) $direct > 0) {
        return (int) $direct;
    }
    foreach (($subscription->items->data ?? []) as $item) {
        if (is_numeric($item->current_period_end ?? null) && (int) $item->current_period_end > 0) {
            return (int) $item->current_period_end;
        }
    }
    return (int) ($subscription->trial_end ?? 0);
};

try {
    billingValidationEnsureStripeSettings($db);
    $planId = billingValidationCreateTestPlan($db, 'Wave 3B access extension ' . strtoupper($suffix), 18.00, 2);
    $user = billingValidationCreateTestUser($db, 'mode-' . $suffix);
    $userId = (string) $user['id'];
    $customer = billingValidationCreateClockedCustomer($db, $stripe, $user);
    $customerId = (string) $customer['customer_id'];
    $clockId = (string) $customer['clock_id'];
    $scenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $userId, $planId);
    $subscriptionId = (string) ($scenario['creation']['subscription_id'] ?? '');
    $before = $stripe->subscriptions->retrieve($subscriptionId, ['expand' => ['items.data.price']]);
    $beforeEnd = $periodEnd($before);
    $benefits = new BenefitService($db);
    $definition = $benefits->createDefinition([
        'definition_key' => 'wave3b-mode-combined-' . $suffix,
        'name' => 'Wave 3B access and extension mode',
        'benefit_mode' => 'ACCESS_AND_BILLING_EXTENSION',
        'access_plan' => 'Elite',
        'access_duration_days' => 2,
        'billing_extension_days' => 2,
        'stacking_policy' => 'EXTEND',
        'source_scope' => 'ANY',
        'active' => 1,
    ], $userId);
    $definitionId = (string) $definition['id'];
    $grant = $benefits->grant($userId, $definitionId, [
        'source_type' => 'ADMIN_MANUAL', 'source_reference' => 'wave3b-mode', 'idempotency_key' => 'wave3b-mode-' . $suffix,
    ], $userId);
    $grantId = (string) $grant['id'];
    $applied = (new BillingExtensionService($db))->apply($grantId, $userId);
    $after = $stripe->subscriptions->retrieve($subscriptionId, ['expand' => ['items.data.price']]);
    $afterEnd = $periodEnd($after);
    $entitlement = $benefits->getUserEntitlement($userId, gmdate('Y-m-d H:i:s'));
    if (($applied['status'] ?? '') !== 'APPLIED' || $afterEnd < $beforeEnd + 2 * 86400 || $entitlement['effective_access'] !== 'Elite') {
        throw new RuntimeException('ACCESS_AND_BILLING_EXTENSION nao confirmou acesso e extensao.');
    }
    echo json_encode([
        'result' => 'PASS',
        'case_id' => 'BENEFIT-MODE-ACCESS-AND-BILLING-EXTENSION',
        'status' => 'PASS',
        'benefit_mode' => 'ACCESS_AND_BILLING_EXTENSION',
        'provider_mode' => resolveStripeKeyMode(STRIPE_SECRET_KEY),
        'provider_extension_seconds' => $afterEnd - $beforeEnd,
        'effective_access' => strtoupper((string) $entitlement['effective_access']),
        'grant_status' => $applied['status'],
        'evidence_reference' => 'M20F03Wave3BAccessAndExtensionModeValidationTest.php',
    ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
} finally {
    if ($grantId !== '') {
        $db->prepare('DELETE FROM benefit_audit_events WHERE benefit_grant_id = :id')->execute([':id' => $grantId]);
        $db->prepare('DELETE FROM benefit_domain_events WHERE benefit_grant_id = :id')->execute([':id' => $grantId]);
        $db->prepare('DELETE FROM benefit_grants WHERE id = :id')->execute([':id' => $grantId]);
    }
    if ($definitionId !== '') {
        $db->prepare('DELETE FROM benefit_audit_events WHERE actor_user_id = :actor')->execute([':actor' => $userId]);
        $db->prepare('DELETE FROM benefit_definitions WHERE id = :id')->execute([':id' => $definitionId]);
    }
    if ($subscriptionId !== '') {
        billingValidationCancelRemoteSubscription($stripe, $subscriptionId);
    }
    if ($customerId !== '') {
        billingValidationDeleteRemoteCustomer($stripe, $customerId);
    }
    if ($clockId !== '') {
        try {
            $stripe->testHelpers->testClocks->delete($clockId, []);
        } catch (Throwable $error) {
            error_log('[wave3b_mode_cleanup_clock] ' . $error->getMessage());
        }
    }
    if ($userId !== '') {
        try {
            billingValidationCleanupUserArtifacts($db, $userId);
        } catch (Throwable $error) {
            error_log('[wave3b_mode_cleanup_user] ' . $error->getMessage());
        }
    }
    billingValidationDeletePlans($db, $planId === null ? [] : [$planId]);
    billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
}
