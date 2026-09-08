<?php

declare(strict_types=1);

require_once __DIR__ . '/support/BillingStripeValidationSupport.php';

if (getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
    throw new RuntimeException('A integracao exige CM_SYNTHETIC_EMAIL_SINK=1 para impedir entrega externa.');
}

$db = billingValidationConnectDb();
$stripe = getStripeClient();
$service = billingValidationCreateSubscriptionsService($db);
$transactions = billingValidationCreateTransactionsService($db);
$settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails', 'autoRefundEnabled'];
$settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
$suffix = billingValidationMakeRunSuffix();
$userId = '';
$planId = null;
$customerId = null;
$subscriptionId = null;
$offerId = null;
$definitionId = null;

try {
    billingValidationEnsureStripeSettings($db);
    billingValidationUpsertSystemSetting($db, 'autoRefundEnabled', '0');
    $planId = billingValidationCreateTestPlan($db, 'Retention decline ' . strtoupper($suffix), 18.00, 3);
    $user = billingValidationCreateTestUser($db, $suffix . 'decline');
    $userId = (string) $user['id'];
    $customer = billingValidationCreateClockedCustomer($db, $stripe, $user);
    $customerId = (string) $customer['customer_id'];

    $scenario = billingValidationCreateActiveInlineSubscription($db, $service, $stripe, $userId, $planId);
    $subscriptionId = (string) ($scenario['creation']['subscription_id'] ?? '');
    $transaction = $scenario['transaction'] ?? null;
    billingValidationAssert(is_array($transaction), 'Assinatura sintetica nao materializou a transacao inicial.');
    $transactionId = (string) ($transaction['id'] ?? '');
    billingValidationAssert($transactionId !== '', 'Transacao sintetica sem identidade.');

    $transactions->requestRefund($userId, [
        'transaction_id' => $transactionId,
        'reason' => 'Fixture sintetica de declinio de retencao Macro20F03',
    ]);
    $offerResult = $transactions->sendRefundRetentionOffer([
        'transaction_id' => $transactionId,
        'actor_id' => 'billing-retention-admin-' . $suffix,
        'offered_days' => 13,
        'expires_at' => gmdate('Y-m-d H:i:s', time() + 300),
        'user_note' => 'Fixture sintetica de declinio.',
        'internal_note' => 'Macro20F03 retention decline integration.',
    ]);
    $offerId = (string) ($offerResult['offer']['id'] ?? '');
    $definitionId = (string) ($offerResult['offer']['benefit_definition_id'] ?? '');
    billingValidationAssert($offerId !== '' && $definitionId !== '', 'Oferta sintetica nao foi persistida.');

    $first = $transactions->decideRefundRetentionOffer($userId, [
        'offer_id' => $offerId,
        'decision' => 'DECLINE',
    ]);
    $stateQuery = $db->prepare('SELECT rro.status AS offer_status, t.status AS transaction_status, t.provider_refund_id FROM refund_retention_offers rro INNER JOIN transactions t ON t.id = rro.transaction_id WHERE rro.id = :id');
    $stateQuery->execute([':id' => $offerId]);
    $state = $stateQuery->fetch(PDO::FETCH_ASSOC) ?: [];
    billingValidationAssert(($state['offer_status'] ?? '') === 'RETENTION_OFFER_REJECTED', 'Declinio nao terminou no estado canonico da oferta.');
    billingValidationAssert(($state['transaction_status'] ?? '') === 'refunded', 'Declinio nao terminou em refunded.');
    billingValidationAssert(trim((string) ($state['provider_refund_id'] ?? '')) !== '', 'Declinio nao recebeu confirmacao do reembolso.');

    $grantQuery = $db->prepare('SELECT COUNT(*) FROM benefit_grants WHERE source_type = :source_type AND source_reference = :source_reference');
    $grantQuery->execute([':source_type' => 'REFUND_RETENTION_OFFER', ':source_reference' => $offerId]);
    $grantCount = (int) $grantQuery->fetchColumn();
    billingValidationAssert($grantCount === 0, 'Declinio nao pode conceder Benefit.');

    $refundEventQuery = $db->prepare('SELECT COUNT(*) FROM benefit_domain_events WHERE source_reference = :source_reference AND event_type = :event_type');
    $refundEventQuery->execute([':source_reference' => $offerId, ':event_type' => 'REFUND_RETENTION_DECLINED']);
    $declineEvents = (int) $refundEventQuery->fetchColumn();
    billingValidationAssert($declineEvents === 1, 'Declinio nao emitiu exatamente um evento de dominio.');

    $replay = $transactions->decideRefundRetentionOffer($userId, [
        'offer_id' => $offerId,
        'decision' => 'DECLINE',
    ]);
    billingValidationAssert(($replay['offer']['status'] ?? '') === 'RETENTION_OFFER_REJECTED', 'Replay de declinio nao foi idempotente.');
    $refundEventQuery->execute([':source_reference' => $offerId, ':event_type' => 'REFUND_RETENTION_DECLINED']);
    billingValidationAssert((int) $refundEventQuery->fetchColumn() === 1, 'Replay duplicou o evento de declinio.');

    echo json_encode([
        'result' => 'PASS',
        'selected_days' => 13,
        'offer_status' => $state['offer_status'],
        'transaction_status' => $state['transaction_status'],
        'refund_count' => 1,
        'benefit_count' => $grantCount,
        'provider_extension_count' => 0,
        'decline_events' => $declineEvents,
        'replay' => 'IDEMPOTENT',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} finally {
    if ($subscriptionId !== null && $subscriptionId !== '') {
        billingValidationCancelRemoteSubscription($stripe, $subscriptionId);
    }
    if ($customerId !== null && $customerId !== '') {
        billingValidationDeleteRemoteCustomer($stripe, $customerId);
    }
    if ($offerId !== null && $offerId !== '') {
        $db->prepare('DELETE FROM refund_retention_offers WHERE id = :id')->execute([':id' => $offerId]);
    }
    if ($definitionId !== null && $definitionId !== '') {
        $db->prepare('DELETE FROM benefit_definitions WHERE id = :id AND definition_key LIKE :definition_key')
            ->execute([':id' => $definitionId, ':definition_key' => 'refund-retention-%']);
    }
    if ($userId !== '') {
        billingValidationCleanupUserArtifacts($db, $userId);
    }
    billingValidationDeletePlans($db, $planId === null ? [] : [$planId]);
    billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
}
