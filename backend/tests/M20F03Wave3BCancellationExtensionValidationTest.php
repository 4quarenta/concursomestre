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
$users = [];
$plans = [];
$customers = [];
$subscriptionsToCancel = [];
$definitions = [];
$grants = [];
$cases = [];

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
    $planQuery = $db->query("SELECT id FROM plans WHERE name = 'Pro' AND active = 1 AND is_active = 1 ORDER BY id LIMIT 1");
    $planId = (int) $planQuery->fetchColumn();
    if ($planId < 1) {
        throw new RuntimeException('Plano Pro canônico não encontrado para o fixture.');
    }

    $expiryUser = billingValidationCreateTestUser($db, 'expiry-cancel-' . $suffix);
    $expiryUserId = (string) $expiryUser['id'];
    $users[] = $expiryUserId;
    $expiryCustomer = billingValidationCreateClockedCustomer($db, $stripe, $expiryUser);
    $customers[] = $expiryCustomer;
    $expiryScenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $expiryUserId, $planId);
    $expirySubscriptionId = (string) ($expiryScenario['creation']['subscription_id'] ?? '');
    $subscriptionsToCancel[] = $expirySubscriptionId;
    $benefits = new BenefitService($db);
    $accessDefinition = $benefits->createDefinition([
        'definition_key' => 'wave3b-expiry-cancel-' . $suffix,
        'name' => 'Wave 3B expiry after cancellation',
        'benefit_mode' => 'ACCESS_ONLY', 'access_plan' => 'Elite', 'access_duration_days' => 2,
        'stacking_policy' => 'DENY', 'source_scope' => 'ANY', 'active' => 1,
    ], $expiryUserId);
    $definitions[] = (string) $accessDefinition['id'];
    $accessGrant = $benefits->grant($expiryUserId, (string) $accessDefinition['id'], [
        'source_type' => 'ADMIN_MANUAL', 'source_reference' => 'wave3b-cancel', 'idempotency_key' => 'wave3b-expiry-cancel-' . $suffix,
    ], $expiryUserId);
    $grants[] = (string) $accessGrant['id'];
    $cancelled = $subscriptions->updateRenewal($expiryUserId, ['auto_renew' => false]);
    $db->prepare('UPDATE benefit_grants SET grant_expires_at = UTC_TIMESTAMP(6) - INTERVAL 1 SECOND WHERE id = :id')->execute([':id' => $accessGrant['id']]);
    $expiredEntitlement = $benefits->getUserEntitlement($expiryUserId, gmdate('Y-m-d H:i:s'));
    $remoteCancelled = $stripe->subscriptions->retrieve($expirySubscriptionId, []);
    if (($cancelled['auto_renew'] ?? true) !== false || empty($remoteCancelled->cancel_at_period_end) || $expiredEntitlement['effective_access'] !== 'Pro') {
        throw new RuntimeException('Expiracao depois do cancelamento nao reverteu para o plano pago atual.');
    }
    $cases[] = ['case_id' => 'EXPIRY-AFTER-CANCELLATION', 'status' => 'PASS', 'actual' => ['cancel_at_period_end' => true, 'effective_access' => 'PRO'], 'evidence_reference' => 'M20F03Wave3BCancellationExtensionValidationTest.php'];

    $reactivateUser = billingValidationCreateTestUser($db, 'react-ext-' . $suffix);
    $reactivateUserId = (string) $reactivateUser['id'];
    $users[] = $reactivateUserId;
    $reactivateCustomer = billingValidationCreateClockedCustomer($db, $stripe, $reactivateUser);
    $customers[] = $reactivateCustomer;
    $reactivateScenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $reactivateUserId, $planId);
    $reactivateSubscriptionId = (string) ($reactivateScenario['creation']['subscription_id'] ?? '');
    $subscriptionsToCancel[] = $reactivateSubscriptionId;
    $extensionDefinition = $benefits->createDefinition([
        'definition_key' => 'wave3b-reactivate-extension-' . $suffix,
        'name' => 'Wave 3B cancellation reactivation extension',
        'benefit_mode' => 'BILLING_EXTENSION_ONLY', 'billing_extension_days' => 2,
        'stacking_policy' => 'EXTEND', 'source_scope' => 'ANY', 'active' => 1,
    ], $reactivateUserId);
    $definitions[] = (string) $extensionDefinition['id'];
    $extensionGrant = $benefits->grant($reactivateUserId, (string) $extensionDefinition['id'], [
        'source_type' => 'ADMIN_MANUAL', 'source_reference' => 'wave3b-cancel', 'idempotency_key' => 'wave3b-reactivate-extension-' . $suffix,
    ], $reactivateUserId);
    $grants[] = (string) $extensionGrant['id'];
    $applied = (new BillingExtensionService($db))->apply((string) $extensionGrant['id'], $reactivateUserId);
    $extended = $stripe->subscriptions->retrieve($reactivateSubscriptionId, ['expand' => ['items.data.price']]);
    $extendedEnd = $periodEnd($extended);
    $subscriptions->updateRenewal($reactivateUserId, ['auto_renew' => false]);
    $subscriptions->updateRenewal($reactivateUserId, ['auto_renew' => true]);
    $remoteReactivated = $stripe->subscriptions->retrieve($reactivateSubscriptionId, ['expand' => ['items.data.price']]);
    $reactivatedEnd = $periodEnd($remoteReactivated);
    if (($applied['status'] ?? '') !== 'APPLIED' || !empty($remoteReactivated->cancel_at_period_end) || $reactivatedEnd < $extendedEnd) {
        throw new RuntimeException('Reativacao nao preservou a extensao confirmada.');
    }
    $cases[] = ['case_id' => 'CANCEL-REACTIVATE-EXTENSION', 'status' => 'PASS', 'actual' => ['cancel_at_period_end' => false, 'extension_preserved_seconds' => $reactivatedEnd - $extendedEnd, 'grant_status' => 'APPLIED'], 'evidence_reference' => 'M20F03Wave3BCancellationExtensionValidationTest.php'];

    echo json_encode(['result' => 'PASS', 'suite' => 'm20f03_wave3b_cancellation_extension', 'cases' => $cases], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
} finally {
    foreach ($grants as $grantId) {
        $db->prepare('DELETE FROM benefit_audit_events WHERE benefit_grant_id = :id')->execute([':id' => $grantId]);
        $db->prepare('DELETE FROM benefit_domain_events WHERE benefit_grant_id = :id')->execute([':id' => $grantId]);
        $db->prepare('DELETE FROM benefit_grants WHERE id = :id')->execute([':id' => $grantId]);
    }
    foreach ($definitions as $definitionId) {
        $db->prepare('DELETE FROM benefit_audit_events WHERE actor_user_id LIKE :actor')->execute([':actor' => 'billing-e2e-%' . $suffix]);
        $db->prepare('DELETE FROM benefit_definitions WHERE id = :id')->execute([':id' => $definitionId]);
    }
    foreach ($subscriptionsToCancel as $subscriptionId) {
        if ($subscriptionId !== '') {
            billingValidationCancelRemoteSubscription($stripe, $subscriptionId);
        }
    }
    foreach ($customers as $customer) {
        billingValidationDeleteRemoteCustomer($stripe, $customer['customer_id'] ?? null);
        if (!empty($customer['clock_id'])) {
            try {
                $stripe->testHelpers->testClocks->delete((string) $customer['clock_id'], []);
            } catch (Throwable $error) {
                error_log('[wave3b_cancel_cleanup_clock] ' . $error->getMessage());
            }
        }
    }
    foreach ($users as $cleanupUserId) {
        try {
            billingValidationCleanupUserArtifacts($db, $cleanupUserId);
        } catch (Throwable $error) {
            error_log('[wave3b_cancel_cleanup_user] ' . $error->getMessage());
        }
    }
    billingValidationDeletePlans($db, []);
    billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
}
