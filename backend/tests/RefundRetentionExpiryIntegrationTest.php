<?php

declare(strict_types=1);

require_once __DIR__ . '/support/BillingStripeValidationSupport.php';

if (getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
    throw new RuntimeException('A integração exige CM_SYNTHETIC_EMAIL_SINK=1 para impedir entrega externa.');
}

$db = billingValidationConnectDb();
$stripe = getStripeClient();
$service = billingValidationCreateSubscriptionsService($db);
$transactions = billingValidationCreateTransactionsService($db);
$settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails', 'autoRefundEnabled'];
$settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
$suffix = billingValidationMakeRunSuffix();
$userId = 'billing-retention-expiry-' . $suffix;
$actorId = 'billing-retention-admin-' . $suffix;
$planId = null;
$customerId = null;
$subscriptionId = null;
$offerId = null;
$definitionId = null;
$beforeEvents = 0;

try {
    billingValidationEnsureStripeSettings($db);
    billingValidationUpsertSystemSetting($db, 'autoRefundEnabled', '0');
    $planId = billingValidationCreateTestPlan($db, 'Retention expiry ' . strtoupper($suffix), 18.00, 3);
    $user = billingValidationCreateTestUser($db, $suffix . 'ret');
    $userId = (string) $user['id'];
    $customer = billingValidationCreateClockedCustomer($db, $stripe, $user);
    $customerId = (string) $customer['customer_id'];

    $scenario = billingValidationCreateActiveInlineSubscription($db, $service, $stripe, $userId, $planId);
    $subscriptionId = (string) ($scenario['creation']['subscription_id'] ?? '');
    $transaction = $scenario['transaction'] ?? null;
    billingValidationAssert(is_array($transaction), 'Assinatura de teste não materializou a transação inicial.');
    $transactionId = (string) ($transaction['id'] ?? '');
    billingValidationAssert($transactionId !== '', 'Transação de teste sem identidade.');

    $transactions->requestRefund($userId, [
        'transaction_id' => $transactionId,
        'reason' => 'Fixture de expiração automática Macro20F03',
    ]);
    $requestedQuery = $db->prepare('SELECT status FROM transactions WHERE id = :id');
    $requestedQuery->execute([':id' => $transactionId]);
    $requestedStatus = (string) $requestedQuery->fetchColumn();
    billingValidationAssert($requestedStatus === 'refund_requested', 'Fixture de refund ficou em estado inesperado: ' . $requestedStatus);

    $offerResult = $transactions->sendRefundRetentionOffer([
        'transaction_id' => $transactionId,
        'actor_id' => $actorId,
        'offered_days' => 11,
        'expires_at' => gmdate('Y-m-d H:i:s', time() + 300),
        'user_note' => 'Fixture sintética de aceitação da expiração.',
        'internal_note' => 'Macro20F03 retention expiry integration.',
    ]);
    $offerId = (string) ($offerResult['offer']['id'] ?? '');
    $definitionId = (string) ($offerResult['offer']['benefit_definition_id'] ?? '');
    billingValidationAssert($offerId !== '' && $definitionId !== '', 'Oferta de retenção não foi persistida.');

    $eventCountQuery = $db->query("SELECT COUNT(*) FROM benefit_domain_events WHERE source_reference = " . $db->quote($offerId));
    $beforeEvents = (int) $eventCountQuery->fetchColumn();

    $db->prepare('UPDATE refund_retention_offers SET expires_at = UTC_TIMESTAMP(6) - INTERVAL 1 SECOND WHERE id = :id')
        ->execute([':id' => $offerId]);
    $candidateQuery = $db->prepare('SELECT rro.status, rro.expires_at, UTC_TIMESTAMP(6) AS db_now, t.status AS transaction_status FROM refund_retention_offers rro INNER JOIN transactions t ON t.id = rro.transaction_id WHERE rro.id = :id');
    $candidateQuery->execute([':id' => $offerId]);
    $candidate = $candidateQuery->fetch(PDO::FETCH_ASSOC) ?: [];
    billingValidationAssert(
        ($candidate['status'] ?? '') === 'PENDING'
            && (string) ($candidate['transaction_status'] ?? '') === 'refund_requested'
            && strcmp((string) ($candidate['expires_at'] ?? ''), (string) ($candidate['db_now'] ?? '')) <= 0,
        'Fixture não ficou vencida/elegível: ' . json_encode($candidate, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );

    $firstRun = $transactions->processExpiredRefundRetentionOffers(10);
    $offerQuery = $db->prepare('SELECT status, offered_days FROM refund_retention_offers WHERE id = :id');
    $offerQuery->execute([':id' => $offerId]);
    $offer = $offerQuery->fetch(PDO::FETCH_ASSOC) ?: [];
    $transactionQuery = $db->prepare('SELECT status, provider_refund_id FROM transactions WHERE id = :id');
    $transactionQuery->execute([':id' => $transactionId]);
    $transactionAfter = $transactionQuery->fetch(PDO::FETCH_ASSOC) ?: [];

    billingValidationAssert(
        ($firstRun['expired'] ?? 0) === 1,
        'Worker não marcou a oferta vencida como expirada: ' . json_encode($firstRun, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
    billingValidationAssert(($firstRun['refunds_processed'] ?? 0) === 1, 'Worker não encaminhou um refund canônico.');
    billingValidationAssert((string) ($offer['status'] ?? '') === 'EXPIRED', 'Oferta vencida não ficou em EXPIRED.');
    billingValidationAssert((int) ($offer['offered_days'] ?? 0) === 11, 'Dias escolhidos pelo Admin não foram preservados.');
    billingValidationAssert((string) ($transactionAfter['status'] ?? '') === 'refunded', 'Refund canônico não terminou em refunded.');
    billingValidationAssert(trim((string) ($transactionAfter['provider_refund_id'] ?? '')) !== '', 'Refund não recebeu confirmação do provedor.');

    $secondRun = $transactions->processExpiredRefundRetentionOffers(10);
    billingValidationAssert(($secondRun['expired'] ?? 0) === 0, 'Reexecução duplicou a transição de expiração.');
    billingValidationAssert(($secondRun['refunds_processed'] ?? 0) === 0, 'Reexecução duplicou o refund.');
    $eventCountQuery = $db->prepare('SELECT COUNT(*) FROM benefit_domain_events WHERE source_reference = :source_reference AND event_type = :event_type');
    $eventCountQuery->execute([
        ':source_reference' => $offerId,
        ':event_type' => 'REFUND_RETENTION_EXPIRED',
    ]);
    $expirationEvents = (int) $eventCountQuery->fetchColumn();
    billingValidationAssert($expirationEvents === 1, 'Transição de expiração não é idempotente.');

    echo json_encode([
        'result' => 'PASS',
        'email_isolation' => 'PASS',
        'selected_days' => 11,
        'first_run' => [
            'expired' => (int) ($firstRun['expired'] ?? 0),
            'refunds_processed' => (int) ($firstRun['refunds_processed'] ?? 0),
            'refund_failures' => (int) ($firstRun['refund_failures'] ?? 0),
        ],
        'second_run' => [
            'expired' => (int) ($secondRun['expired'] ?? 0),
            'refunds_processed' => (int) ($secondRun['refunds_processed'] ?? 0),
            'refund_failures' => (int) ($secondRun['refund_failures'] ?? 0),
        ],
        'expiration_events' => $expirationEvents,
        'preserved_domain_events_before_cleanup' => $beforeEvents,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} finally {
    if ($subscriptionId !== null) {
        billingValidationCancelRemoteSubscription($stripe, $subscriptionId);
    }
    if ($customerId !== null) {
        billingValidationDeleteRemoteCustomer($stripe, $customerId);
    }
    if ($offerId !== null) {
        $db->prepare('DELETE FROM refund_retention_offers WHERE id = :id')->execute([':id' => $offerId]);
    }
    if ($definitionId !== null) {
        $db->prepare('DELETE FROM benefit_definitions WHERE id = :id AND definition_key LIKE :definition_key')
            ->execute([':id' => $definitionId, ':definition_key' => 'refund-retention-%']);
    }
    if ($userId !== '') {
        billingValidationCleanupUserArtifacts($db, $userId);
    }
    billingValidationDeletePlans($db, $planId === null ? [] : [$planId]);
    billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
}
