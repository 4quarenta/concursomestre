<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsBillingSupport.php';

function currentSubscriptionSnapshotAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $snapshot = buildCurrentSubscriptionBillingSnapshot([
        'id' => 104,
        'plan_id' => 134,
        'status' => 'active',
        'payment_provider' => 'stripe',
        'auto_renew' => 1,
        'cancel_at_period_end' => 0,
        'created_at' => '2026-06-28 08:15:29',
        'current_period_start' => '2026-07-18 08:15:28',
        'current_period_end' => '2026-07-20 08:15:28',
        'provider_current_period_start' => '2026-07-18 08:15:28',
        'provider_current_period_end' => '2026-07-20 08:15:28',
        'total_installments' => 1,
        'paid_installments' => 1,
        'recurring_amount' => '10.00',
        'next_renewal_amount' => '10.00',
        'next_renewal_date' => '2026-07-20 08:15:28',
        'plan_name' => 'Elite - Teste 2 dias',
        'price' => '10.00',
        'interval_unit' => 'day',
        'interval_count' => 2,
        'tier' => 4,
    ]);

    currentSubscriptionSnapshotAssert($snapshot['id'] === 104, 'Snapshot deve preservar o ID local da assinatura.');
    currentSubscriptionSnapshotAssert($snapshot['plan']['displayName'] === 'Elite - Teste 2 dias', 'Snapshot deve preservar o plano real.');
    currentSubscriptionSnapshotAssert($snapshot['plan']['intervalUnit'] === 'day', 'Snapshot deve preservar a unidade diaria.');
    currentSubscriptionSnapshotAssert($snapshot['plan']['intervalCount'] === 2, 'Snapshot deve preservar o ciclo de 2 dias.');
    currentSubscriptionSnapshotAssert(abs($snapshot['billing']['chargeAmount'] - 10.00) < 0.001, 'Snapshot deve exibir o valor contratado de 10 reais.');
    currentSubscriptionSnapshotAssert(abs($snapshot['billing']['nextRenewal']['amount'] - 10.00) < 0.001, 'Snapshot deve exibir a renovacao de 10 reais.');
    currentSubscriptionSnapshotAssert($snapshot['billing']['nextRenewal']['date'] === '2026-07-20 08:15:28', 'Snapshot deve exibir a proxima renovacao real.');
    currentSubscriptionSnapshotAssert($snapshot['billing']['nextRenewal']['cycleLabel'] === '2 dias', 'Snapshot nao pode converter ciclo diario em mensal.');
    currentSubscriptionSnapshotAssert($snapshot['autoRenew'] === true, 'Snapshot deve preservar renovacao automatica ativa.');

    $encodedSnapshot = json_encode($snapshot, JSON_UNESCAPED_UNICODE);
    currentSubscriptionSnapshotAssert(strpos((string) $encodedSnapshot, 'provider_subscription_id') === false, 'Snapshot publico nao pode expor ID remoto da assinatura.');
    currentSubscriptionSnapshotAssert(strpos((string) $encodedSnapshot, 'provider_customer_id') === false, 'Snapshot publico nao pode expor ID remoto do cliente.');

    $manualSnapshot = buildCurrentSubscriptionBillingSnapshot([
        'id' => 105,
        'plan_id' => 134,
        'status' => 'active',
        'payment_provider' => 'manual_admin',
        'auto_renew' => 0,
        'plan_name' => 'Elite Cortesia',
        'price' => '99.00',
        'interval_unit' => 'month',
        'interval_count' => 1,
    ]);
    currentSubscriptionSnapshotAssert($manualSnapshot['billing']['chargeAmount'] === 0.0, 'Concessao manual nao pode exibir cobranca do catalogo.');
    currentSubscriptionSnapshotAssert($manualSnapshot['billing']['nextRenewal']['amount'] === 0.0, 'Concessao manual nao pode projetar renovacao paga.');

    $route = file_get_contents(__DIR__ . '/../modules/subscriptions/routes.php');
    currentSubscriptionSnapshotAssert(
        is_string($route) && strpos($route, "verifyAuthenticatedUserPayload(true)") !== false,
        'Endpoint deve obter o usuario exclusivamente da sessao autenticada.'
    );

    echo "CurrentSubscriptionBillingSnapshotTest: PASS\n";
} catch (Throwable $e) {
    fwrite(STDERR, "CurrentSubscriptionBillingSnapshotTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}
