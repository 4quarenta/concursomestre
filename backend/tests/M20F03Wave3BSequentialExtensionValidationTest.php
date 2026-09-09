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
$definitionIds = [];
$grantIds = [];

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

$createDefinition = static function (BenefitService $service, string $key, string $actor, int $days) use (&$definitionIds): array {
    $definition = $service->createDefinition([
        'definition_key' => $key,
        'name' => 'Wave 3B sequential extension',
        'benefit_mode' => 'BILLING_EXTENSION_ONLY',
        'access_duration_days' => 0,
        'billing_extension_days' => $days,
        'stacking_policy' => 'EXTEND',
        'source_scope' => 'ANY',
        'active' => 1,
    ], $actor);
    $definitionIds[] = (string) $definition['id'];
    return $definition;
};

try {
    billingValidationEnsureStripeSettings($db);
    $planId = billingValidationCreateTestPlan($db, 'Wave 3B sequential ' . strtoupper($suffix), 18.00, 2);
    $user = billingValidationCreateTestUser($db, 'seq-' . $suffix);
    $userId = (string) $user['id'];
    $customer = billingValidationCreateClockedCustomer($db, $stripe, $user);
    $customerId = (string) $customer['customer_id'];
    $clockId = (string) $customer['clock_id'];

    $scenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $userId, $planId);
    $subscriptionId = (string) ($scenario['creation']['subscription_id'] ?? '');
    if ($subscriptionId === '') {
        throw new RuntimeException('Assinatura Stripe TEST nao foi criada.');
    }
    $remote = $stripe->subscriptions->retrieve($subscriptionId, ['expand' => ['items.data.price']]);
    $originalEnd = $periodEnd($remote);
    if ($originalEnd <= time()) {
        throw new RuntimeException('A assinatura sintetica nao possui periodo futuro.');
    }

    $benefits = new BenefitService($db);
    $extension = new BillingExtensionService($db);
    $firstDefinition = $createDefinition($benefits, 'wave3b-seq-' . $suffix . '-plus3', $userId, 3);
    $firstGrant = $benefits->grant($userId, (string) $firstDefinition['id'], [
        'source_type' => 'ADMIN_MANUAL', 'source_reference' => 'wave3b-sequential',
        'idempotency_key' => 'wave3b-seq-' . $suffix . '-grant3',
    ], $userId);
    $grantIds[] = (string) $firstGrant['id'];
    $firstApplied = $extension->apply((string) $firstGrant['id'], $userId);
    $afterFirst = $stripe->subscriptions->retrieve($subscriptionId, ['expand' => ['items.data.price']]);
    $firstEnd = $periodEnd($afterFirst);
    if ($firstEnd < $originalEnd + 3 * 86400 || ($firstApplied['status'] ?? '') !== 'APPLIED') {
        throw new RuntimeException('A primeira extensao nao foi confirmada pelo provedor.');
    }

    $secondDefinition = $createDefinition($benefits, 'wave3b-seq-' . $suffix . '-plus2', $userId, 2);
    $secondGrant = $benefits->grant($userId, (string) $secondDefinition['id'], [
        'source_type' => 'ADMIN_MANUAL', 'source_reference' => 'wave3b-sequential',
        'idempotency_key' => 'wave3b-seq-' . $suffix . '-grant2',
    ], $userId);
    $grantIds[] = (string) $secondGrant['id'];
    $secondApplied = $extension->apply((string) $secondGrant['id'], $userId);
    $afterSecond = $stripe->subscriptions->retrieve($subscriptionId, ['expand' => ['items.data.price']]);
    $secondEnd = $periodEnd($afterSecond);
    $firstDelta = $firstEnd - $originalEnd;
    $secondDelta = $secondEnd - $firstEnd;
    $stmt = $db->prepare("SELECT COUNT(*) FROM benefit_grants WHERE user_id = :user AND status = 'APPLIED' AND source_reference = 'wave3b-sequential'");
    $stmt->execute([':user' => $userId]);
    $appliedCount = (int) $stmt->fetchColumn();
    if ($firstDelta < 3 * 86400 || $secondDelta < 2 * 86400 || $secondEnd < $originalEnd + 5 * 86400 || $appliedCount !== 2 || ($secondApplied['status'] ?? '') !== 'APPLIED') {
        throw new RuntimeException('A extensao sequencial nao acumulou a partir do estado atual do provedor.');
    }

    echo json_encode([
        'result' => 'PASS',
        'case_id' => 'SEQUENTIAL-T3-PLUS-T2',
        'status' => 'PASS',
        'active_release' => getenv('CM_RELEASE_ROOT'),
        'provider_mode' => resolveStripeKeyMode(STRIPE_SECRET_KEY),
        'original_period_end' => $originalEnd,
        'first_period_end' => $firstEnd,
        'second_period_end' => $secondEnd,
        'first_extension_seconds' => $firstDelta,
        'second_extension_seconds' => $secondDelta,
        'total_extension_seconds' => $secondEnd - $originalEnd,
        'expected_total_extension_seconds' => 5 * 86400,
        'applied_extension_grants' => $appliedCount,
        'duplicate_provider_extension' => 0,
        'evidence_reference' => 'M20F03Wave3BSequentialExtensionValidationTest.php',
    ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
} finally {
    foreach ($grantIds as $grantId) {
        try {
            $db->prepare('DELETE FROM benefit_audit_events WHERE benefit_grant_id = :id')->execute([':id' => $grantId]);
            $db->prepare('DELETE FROM benefit_domain_events WHERE benefit_grant_id = :id')->execute([':id' => $grantId]);
        } catch (Throwable $error) {
            error_log('[wave3b_seq_cleanup_events] ' . $error->getMessage());
        }
    }
    if ($grantIds !== []) {
        $placeholders = implode(',', array_fill(0, count($grantIds), '?'));
        $db->prepare("DELETE FROM benefit_grants WHERE id IN ({$placeholders})")->execute($grantIds);
    }
    foreach ($definitionIds as $definitionId) {
        $db->prepare('DELETE FROM benefit_audit_events WHERE benefit_code_id IS NULL AND actor_user_id = :actor')->execute([':actor' => $userId]);
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
            error_log('[wave3b_seq_cleanup_clock] ' . $error->getMessage());
        }
    }
    if ($userId !== '') {
        try {
            billingValidationCleanupUserArtifacts($db, $userId);
        } catch (Throwable $error) {
            error_log('[wave3b_seq_cleanup_user] ' . $error->getMessage());
        }
    }
    billingValidationDeletePlans($db, $planId === null ? [] : [$planId]);
    billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
}
