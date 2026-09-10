<?php

declare(strict_types=1);

require_once __DIR__ . '/support/BillingStripeValidationSupport.php';

if (getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
    throw new RuntimeException('A prova exige CM_SYNTHETIC_EMAIL_SINK=1.');
}

$db = billingValidationConnectDb();
$stripe = getStripeClient();
$subscriptions = billingValidationCreateSubscriptionsService($db);
$transactions = billingValidationCreateTransactionsService($db);
$settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails', 'autoRefundEnabled'];
$settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
$suffix = billingValidationMakeRunSuffix();
$userId = '';
$planId = null;
$customerId = '';
$clockId = '';
$subscriptionId = '';
$offerId = '';
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
    billingValidationUpsertSystemSetting($db, 'autoRefundEnabled', '0');
    $planId = billingValidationCreateTestPlan($db, 'Wave 3B refund benefit ' . strtoupper($suffix), 18.00, 2);
    $user = billingValidationCreateTestUser($db, 'refund-benefit-' . $suffix);
    $userId = (string) $user['id'];
    $customer = billingValidationCreateClockedCustomer($db, $stripe, $user);
    $customerId = (string) $customer['customer_id'];
    $clockId = (string) $customer['clock_id'];
    $scenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $userId, $planId);
    $subscriptionId = (string) ($scenario['creation']['subscription_id'] ?? '');
    $transaction = $scenario['transaction'] ?? null;
    billingValidationAssert(is_array($transaction), 'Assinatura nao materializou a transacao inicial.');
    $transactionId = (string) ($transaction['id'] ?? '');
    $before = $stripe->subscriptions->retrieve($subscriptionId, ['expand' => ['items.data.price']]);
    $beforeEnd = $periodEnd($before);

    $transactions->requestRefund($userId, [
        'transaction_id' => $transactionId,
        'reason' => 'Wave 3B refund benefit acceptance',
    ]);
    $offerResult = $transactions->sendRefundRetentionOffer([
        'transaction_id' => $transactionId,
        'actor_id' => 'wave3b-refund-admin-' . $suffix,
        'offered_days' => 2,
        'expires_at' => gmdate('Y-m-d H:i:s', time() + 300),
        'user_note' => 'Fixture sintetica de aceite.',
        'internal_note' => 'Wave 3B refund benefit interaction.',
    ]);
    $offerId = (string) ($offerResult['offer']['id'] ?? '');
    $definitionId = (string) ($offerResult['offer']['benefit_definition_id'] ?? '');
    $accepted = $transactions->decideRefundRetentionOffer($userId, ['offer_id' => $offerId, 'decision' => 'ACCEPT']);
    $grantId = (string) ($accepted['grant']['id'] ?? '');
    $after = $stripe->subscriptions->retrieve($subscriptionId, ['expand' => ['items.data.price']]);
    $afterEnd = $periodEnd($after);
    $stateQuery = $db->prepare('SELECT rro.status AS offer_status, t.status AS transaction_status, t.provider_refund_id FROM refund_retention_offers rro INNER JOIN transactions t ON t.id = rro.transaction_id WHERE rro.id = :id');
    $stateQuery->execute([':id' => $offerId]);
    $state = $stateQuery->fetch(PDO::FETCH_ASSOC) ?: [];
    $grantQuery = $db->prepare('SELECT COUNT(*) FROM benefit_grants WHERE id = :id AND status = \'APPLIED\' AND provider_status = \'CONFIRMED\'');
    $grantQuery->execute([':id' => $grantId]);
    $grantCount = (int) $grantQuery->fetchColumn();
    if (($state['offer_status'] ?? '') !== 'CLOSED_RETAINED' || ($state['transaction_status'] ?? '') !== 'refund_retained' || trim((string) ($state['provider_refund_id'] ?? '')) !== '' || $grantCount !== 1 || $afterEnd < $beforeEnd + 2 * 86400) {
        throw new RuntimeException('Aceite de refund-benefit nao manteve a assinatura com extensao confirmada.');
    }
    echo json_encode([
        'result' => 'PASS',
        'case_id' => 'REFUND-BENEFIT-INTERACTION',
        'status' => 'PASS',
        'offer_status' => $state['offer_status'],
        'transaction_status' => $state['transaction_status'],
        'provider_refund' => 0,
        'confirmed_grants' => $grantCount,
        'provider_extension_seconds' => $afterEnd - $beforeEnd,
        'evidence_reference' => 'M20F03Wave3BRefundBenefitInteractionValidationTest.php',
    ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
} finally {
    if ($offerId !== '') {
        $db->prepare('DELETE FROM refund_retention_offers WHERE id = :id')->execute([':id' => $offerId]);
    }
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
            error_log('[wave3b_refund_cleanup_clock] ' . $error->getMessage());
        }
    }
    if ($userId !== '') {
        try {
            billingValidationCleanupUserArtifacts($db, $userId);
        } catch (Throwable $error) {
            error_log('[wave3b_refund_cleanup_user] ' . $error->getMessage());
        }
    }
    billingValidationDeletePlans($db, $planId === null ? [] : [$planId]);
    billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
}
