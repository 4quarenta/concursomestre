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

require_once __DIR__ . '/support/BillingStripeValidationSupport.php';

/**
 * Lê uma opção simples da CLI no formato --chave=valor.
 *
 * @since 1.0.0
 */
function billingValidationCliOption(string $name, ?string $default = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') !== 0) {
            continue;
        }

        return substr($argument, strlen($name) + 3);
    }

    return $default;
}

/**
 * Marca uma falha operacional sem interromper a consolidacao da suite.
 *
 * @since 1.0.0
 */
function billingValidationFailureResult(
    string $id,
    string $name,
    string $objective,
    string $method,
    array $files,
    Throwable $error
): array {
    return billingValidationResult(
        $id,
        $name,
        $objective,
        $method,
        [$error->getMessage()],
        $files,
        'CRITICO',
        'Corrigir o fluxo antes de usar o billing em producao.',
        [
            'error' => $error->getMessage(),
        ]
    );
}

/**
 * Executa os cenarios reais de renovacao e auto renew.
 *
 * @since 1.0.0
 */
function billingValidationRunRenewalScenarios(PDO $db, SubscriptionsService $service): array
{
    $stripe = getStripeClient();
    $settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails'];
    $settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
    $planIds = [];
    $userId = null;
    $customerId = null;
    $clockId = null;
    $providerSubscriptionId = null;
    $results = [];

    try {
        billingValidationEnsureStripeSettings($db);
        $suffix = billingValidationMakeRunSuffix();
        $planId = billingValidationCreateTestPlan($db, 'Pro E2E Renovacao ' . strtoupper($suffix), 19.90, 3);
        $planIds[] = $planId;

        $user = billingValidationCreateTestUser($db, $suffix);
        $userId = (string) $user['id'];
        $customer = billingValidationCreateClockedCustomer($db, $stripe, $user);
        $customerId = $customer['customer_id'];
        $clockId = $customer['clock_id'];

        $scenario = billingValidationCreateActiveInlineSubscription($db, $service, $stripe, $userId, $planId);
        $providerSubscriptionId = (string) ($scenario['creation']['subscription_id'] ?? '');
        $initialLocalSubscription = $scenario['local_subscription'];
        $initialInvoice = $scenario['latest_invoice'];
        $initialTransactions = billingValidationFindPlanTransactions($db, $userId);
        $initialLocalPeriodEnd = (string) ($initialLocalSubscription['current_period_end'] ?? '');
        $initialProviderPeriodEnd = (string) ($initialLocalSubscription['provider_current_period_end'] ?? '');
        $initialPaymentMethodId = (string) ($scenario['creation']['payment_method_id'] ?? 'pm_card_visa');

        billingValidationAssert($providerSubscriptionId !== '', 'A assinatura inicial nao foi criada no Stripe.');
        billingValidationAssert(count($initialTransactions) >= 1, 'A assinatura inicial deve gerar ao menos uma transacao local de plano.');
        billingValidationAssert($initialLocalPeriodEnd !== '' && $initialProviderPeriodEnd !== '', 'A assinatura inicial precisa persistir os periodos locais e remotos.');

        $initialInvoiceId = is_object($initialInvoice) ? trim((string) ($initialInvoice->id ?? '')) : '';
        $advanceTarget = strtotime($initialProviderPeriodEnd) + 3600;
        billingValidationAssert($advanceTarget > time(), 'Nao foi possivel calcular o proximo ciclo remoto da assinatura.');

        billingValidationAdvanceTestClock($stripe, $clockId, $advanceTarget);
        $renewedRemoteSubscription = billingValidationWaitForRenewalInvoice($stripe, $providerSubscriptionId, $initialInvoiceId);
        $renewalInvoice = $renewedRemoteSubscription->latest_invoice ?? null;
        $renewalInvoiceId = is_object($renewalInvoice) ? trim((string) ($renewalInvoice->id ?? '')) : '';
        $renewalInvoiceStatus = is_object($renewalInvoice) ? trim((string) ($renewalInvoice->status ?? '')) : '';
        if ($renewalInvoiceId !== '' && $renewalInvoiceStatus !== 'paid') {
            $paidRenewalInvoice = $stripe->invoices->pay($renewalInvoiceId, [
                'payment_method' => $initialPaymentMethodId,
                'expand' => ['payment_intent'],
            ]);
            $renewalPaymentIntentId = getStripeInvoicePaymentIntentId($paidRenewalInvoice);
            if ($renewalPaymentIntentId !== '') {
                billingValidationEnsurePaymentIntentSucceeded($stripe, $renewalPaymentIntentId, $initialPaymentMethodId);
            }
            $renewedRemoteSubscription = $stripe->subscriptions->retrieve($providerSubscriptionId, [
                'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'customer', 'default_payment_method'],
            ]);
            $renewalInvoice = $renewedRemoteSubscription->latest_invoice ?? null;
            $renewalInvoiceId = is_object($renewalInvoice) ? trim((string) ($renewalInvoice->id ?? '')) : $renewalInvoiceId;
        }
        $renewedRemoteSubscription = billingValidationWaitForInvoicePaid($stripe, $providerSubscriptionId, $renewalInvoiceId);
        $remoteRenewedPeriod = (string) (billingValidationExtractRemoteSubscriptionPeriod($renewedRemoteSubscription)['end'] ?? '');

        billingValidationAssert($renewalInvoiceId !== '' && $renewalInvoiceId !== $initialInvoiceId, 'A renovacao Stripe nao gerou uma nova invoice remota.');
        billingValidationAssert($remoteRenewedPeriod !== '', 'Nao foi possivel extrair o periodo remoto renovado da Stripe.');

        $localBeforeReconciliation = billingValidationFindLatestSubscriptionByUser($db, $userId);
        $staleProviderPeriod = date('Y-m-d H:i:s', max(1, strtotime($remoteRenewedPeriod) - 86400));
        if ((string) ($localBeforeReconciliation['provider_current_period_end'] ?? '') === $remoteRenewedPeriod) {
            $db->prepare("
                UPDATE user_subscriptions
                SET provider_current_period_end = :provider_current_period_end
                WHERE id = :id
            ")->execute([
                ':provider_current_period_end' => $staleProviderPeriod,
                ':id' => (int) ($localBeforeReconciliation['id'] ?? 0),
            ]);
        }

        $existingRenewalTransaction = billingValidationFindPlanTransactionByInvoice($db, $renewalInvoiceId);
        if (is_array($existingRenewalTransaction) && isset($existingRenewalTransaction['id'])) {
            $db->prepare('DELETE FROM transactions WHERE id = :id')
                ->execute([':id' => (int) $existingRenewalTransaction['id']]);
        }

        $localBeforeReconciliation = billingValidationFindLatestSubscriptionByUser($db, $userId);
        $transactionsBeforeReconciliation = billingValidationFindPlanTransactions($db, $userId);
        billingValidationAssert(
            (string) ($localBeforeReconciliation['provider_current_period_end'] ?? '') !== $remoteRenewedPeriod,
            'O periodo local ja estava igual ao remoto antes da reconciliacao, impedindo o cenario atrasado.'
        );

        $reconciliation = $service->runStripeReconciliationCron();
        $localAfterReconciliation = billingValidationFindLatestSubscriptionByUser($db, $userId);
        $transactionsAfterReconciliation = billingValidationFindPlanTransactions($db, $userId);
        $renewalTransaction = billingValidationFindPlanTransactionByInvoice($db, $renewalInvoiceId);

        billingValidationAssert(
            (string) ($localAfterReconciliation['provider_current_period_end'] ?? '') === $remoteRenewedPeriod,
            'A reconciliacao nao atualizou o periodo remoto local apos a renovacao.'
        );
        billingValidationAssert(
            count($transactionsAfterReconciliation) === count($transactionsBeforeReconciliation) + 1,
            'A reconciliacao nao materializou a transacao da renovacao perdida.'
        );
        billingValidationAssert($renewalTransaction !== null, 'A invoice renovada nao foi gravada na tabela de transacoes.');
        $totalInstallmentsAfterReconciliation = max(1, (int) ($localAfterReconciliation['total_installments'] ?? 1));
        $paidInstallmentsAfterReconciliation = max(0, (int) ($localAfterReconciliation['paid_installments'] ?? 0));
        $renewalIterationAfterReconciliation = max(0, (int) ($localAfterReconciliation['renewal_iteration'] ?? 0));
        $billingProgressOk = $totalInstallmentsAfterReconciliation <= 1
            ? ($paidInstallmentsAfterReconciliation === 1 && $renewalIterationAfterReconciliation >= 1)
            : ($paidInstallmentsAfterReconciliation >= 2);

        billingValidationAssert(
            $billingProgressOk,
            'A reconciliacao nao avancou o progresso de cobranca da assinatura. '
                . 'paid_installments=' . (string) ($localAfterReconciliation['paid_installments'] ?? 'null')
                . '; total_installments=' . (string) ($localAfterReconciliation['total_installments'] ?? 'null')
                . '; renewal_iteration=' . (string) ($localAfterReconciliation['renewal_iteration'] ?? 'null')
                . '; renewal_transaction_id=' . (string) ($renewalTransaction['id'] ?? 'null')
                . '; renewal_invoice=' . $renewalInvoiceId
                . '; local_subscription_id=' . (string) ($localAfterReconciliation['id'] ?? 'null')
        );

        $service->runStripeReconciliationCron();
        $transactionsAfterSecondReconciliation = billingValidationFindPlanTransactions($db, $userId);
        billingValidationAssert(
            count($transactionsAfterSecondReconciliation) === count($transactionsAfterReconciliation),
            'A segunda reconciliacao duplicou a transacao da renovacao.'
        );

        $results[] = billingValidationResult(
            'renewal_e2e',
            'Renovacao Stripe ponta a ponta',
            'Provar criacao, renovacao remota e persistencia local com Stripe real em modo teste.',
            'Stripe Test Clock + createStripeInlineSubscription + finalizeStripeSubscription + runStripeReconciliationCron.',
            [
                'subscription=' . $providerSubscriptionId,
                'initial_invoice=' . $initialInvoiceId,
                'renewal_invoice=' . $renewalInvoiceId,
                'transactions_after=' . count($transactionsAfterReconciliation),
                'synced_period_end=' . (string) ($localAfterReconciliation['provider_current_period_end'] ?? ''),
            ],
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
            ],
            'OK',
            'Manter este cenario no pre-deploy para validar renovacao real em modo teste.',
            [
                'summary' => $reconciliation,
            ]
        );

        $offState = $service->updateRenewal($userId, ['auto_renew' => false]);
        $remoteAfterOff = $stripe->subscriptions->retrieve($providerSubscriptionId, [
            'expand' => ['default_payment_method', 'customer.invoice_settings.default_payment_method'],
        ]);
        $localAfterOff = billingValidationFindLatestSubscriptionByUser($db, $userId);

        billingValidationAssert(($offState['auto_renew'] ?? true) === false, 'O backend nao confirmou o desligamento da renovacao automatica.');
        billingValidationAssert(!empty($remoteAfterOff->cancel_at_period_end), 'A Stripe nao recebeu cancel_at_period_end = true ao desligar a renovacao.');
        billingValidationAssert((int) ($localAfterOff['auto_renew'] ?? 1) === 0, 'O banco local nao persistiu auto_renew = 0.');

        $stripe->subscriptions->update($providerSubscriptionId, ['default_payment_method' => '']);
        $stripe->customers->update($customerId, [
            'invoice_settings' => [
                'default_payment_method' => '',
            ],
        ]);
        $db->prepare("UPDATE user_cards SET is_default = 0 WHERE user_id = :user_id")
            ->execute([':user_id' => $userId]);

        $missingCardError = '';
        try {
            $service->updateRenewal($userId, ['auto_renew' => true]);
        } catch (Throwable $renewalError) {
            $missingCardError = $renewalError->getMessage();
        }

        billingValidationAssert(
            str_contains($missingCardError, 'Nenhum cartão padrão'),
            'Religar a renovacao sem cartao valido deveria falhar no backend Stripe.'
        );

        $stripe->subscriptions->update($providerSubscriptionId, ['default_payment_method' => $initialPaymentMethodId]);
        $stripe->customers->update($customerId, [
            'invoice_settings' => [
                'default_payment_method' => $initialPaymentMethodId,
            ],
        ]);
        $db->prepare("
            UPDATE user_cards
            SET is_default = CASE
                WHEN stripe_payment_method_id = :payment_method_id THEN 1
                ELSE 0
            END
            WHERE user_id = :user_id
        ")->execute([
            ':payment_method_id' => $initialPaymentMethodId,
            ':user_id' => $userId,
        ]);

        $onState = $service->updateRenewal($userId, ['auto_renew' => true]);
        $remoteAfterOn = $stripe->subscriptions->retrieve($providerSubscriptionId, [
            'expand' => ['default_payment_method', 'customer.invoice_settings.default_payment_method'],
        ]);
        $localAfterOn = billingValidationFindLatestSubscriptionByUser($db, $userId);

        billingValidationAssert(($onState['auto_renew'] ?? false) === true, 'O backend nao confirmou o religamento da renovacao automatica.');
        billingValidationAssert(empty($remoteAfterOn->cancel_at_period_end), 'A Stripe nao removeu cancel_at_period_end ao religar a renovacao.');
        billingValidationAssert((int) ($localAfterOn['auto_renew'] ?? 0) === 1, 'O banco local nao persistiu auto_renew = 1.');

        $results[] = billingValidationResult(
            'auto_renew_cycle',
            'Auto renew off/on com backend como fonte final',
            'Provar desligamento remoto, bloqueio sem cartao padrao e religamento consistente.',
            'SubscriptionsService::updateRenewal + leitura remota da Stripe + verificacao de banco local.',
            [
                'off_message=' . (string) ($offState['message'] ?? ''),
                'missing_card_error=' . $missingCardError,
                'on_message=' . (string) ($onState['message'] ?? ''),
                'payment_method=' . $initialPaymentMethodId,
            ],
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsBillingSupport.php',
            ],
            'OK',
            'Persistir a checagem remota de payment method antes de liberar o toggle no frontend.',
            [
                'local_auto_renew' => (int) ($localAfterOn['auto_renew'] ?? 0),
                'remote_cancel_at_period_end' => (bool) ($remoteAfterOn->cancel_at_period_end ?? false),
            ]
        );
    } catch (Throwable $error) {
        $results[] = billingValidationFailureResult(
            'renewal_suite',
            'Renovacao e auto renew',
            'Cobrir renovacao real, reconciliacao e toggle remoto da Stripe.',
            'Stripe real em modo teste, backend oficial e banco local.',
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
            ],
            $error
        );
    } finally {
        if ($providerSubscriptionId !== null) {
            billingValidationCancelRemoteSubscription($stripe, $providerSubscriptionId);
        }
        if ($customerId !== null) {
            billingValidationDeleteRemoteCustomer($stripe, $customerId);
        }
        if ($userId !== null) {
            billingValidationCleanupUserArtifacts($db, $userId);
        }
        billingValidationDeletePlans($db, $planIds);
        billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
    }

    return $results;
}

/**
 * Executa os cenarios de simulacao de webhook com fixtures.
 *
 * @since 1.0.0
 */
function billingValidationRunWebhookScenarios(PDO $db, SubscriptionsService $service, string $fixturesDir): array
{
    $stripe = getStripeClient();
    $settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails'];
    $settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
    $planIds = [];
    $userId = null;
    $customerId = null;
    $clockId = null;
    $providerSubscriptionId = null;
    $results = [];

    try {
        billingValidationEnsureStripeSettings($db);
        $suffix = billingValidationMakeRunSuffix();
        $planId = billingValidationCreateTestPlan($db, 'Pro E2E Webhook ' . strtoupper($suffix), 17.90, 3);
        $planIds[] = $planId;

        $user = billingValidationCreateTestUser($db, $suffix);
        $userId = (string) $user['id'];
        $customer = billingValidationCreateClockedCustomer($db, $stripe, $user);
        $customerId = $customer['customer_id'];
        $clockId = $customer['clock_id'];

        $scenario = billingValidationCreateActiveInlineSubscription($db, $service, $stripe, $userId, $planId);
        $providerSubscriptionId = (string) ($scenario['creation']['subscription_id'] ?? '');
        $initialInvoice = $scenario['latest_invoice'];
        $initialInvoiceId = is_object($initialInvoice) ? trim((string) ($initialInvoice->id ?? '')) : '';
        $initialTxCount = count(billingValidationFindPlanTransactions($db, $userId));

        $invoicePaidFixture = billingValidationLoadFixture($fixturesDir, 'invoice.paid.json');
        $updatedFixture = billingValidationLoadFixture($fixturesDir, 'customer.subscription.updated.json');
        $deletedFixture = billingValidationLoadFixture($fixturesDir, 'customer.subscription.deleted.json');

        $duplicateEventId = 'evt_dup_' . $suffix;
        $duplicateEvent = billingValidationBuildEventFromFixture(
            $invoicePaidFixture,
            $duplicateEventId,
            time(),
            'invoice.paid',
            $initialInvoice
        );
        $duplicateHash = hash('sha256', json_encode($duplicateEvent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $firstDuplicateRun = $service->processStripeWebhookEventObject($duplicateEvent, $duplicateHash, $stripe);
        $txCountAfterFirstRun = count(billingValidationFindPlanTransactions($db, $userId));
        $secondDuplicateRun = $service->processStripeWebhookEventObject($duplicateEvent, $duplicateHash, $stripe);
        $duplicateWebhookRow = billingValidationFindWebhookEvent($db, $duplicateEventId);

        billingValidationAssert(empty($firstDuplicateRun['duplicate']), 'A primeira entrega do evento nao pode ser tratada como duplicada.');
        billingValidationAssert(($secondDuplicateRun['duplicate'] ?? false) === true, 'A segunda entrega do mesmo event_id deveria ser rejeitada como duplicada.');
        billingValidationAssert($txCountAfterFirstRun === $initialTxCount, 'O replay do invoice.paid nao deveria criar nova transacao local.');
        billingValidationAssert((string) ($duplicateWebhookRow['status'] ?? '') === 'processed', 'O evento duplicado deveria manter a primeira execucao como processed.');

        $results[] = billingValidationResult(
            'webhook_duplicate',
            'Webhook duplicado',
            'Garantir que o mesmo event_id nao gere efeito financeiro duplicado.',
            'Fixture invoice.paid + processStripeWebhookEventObject com Stripe real e banco local.',
            [
                'event_id=' . $duplicateEventId,
                'first_duplicate=' . json_encode($firstDuplicateRun, JSON_UNESCAPED_UNICODE),
                'second_duplicate=' . json_encode($secondDuplicateRun, JSON_UNESCAPED_UNICODE),
                'transactions=' . $txCountAfterFirstRun,
            ],
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
            ],
            'OK',
            'Manter provider + event_id como chave forte de idempotencia.'
        );

        $remoteSubscription = $stripe->subscriptions->retrieve($providerSubscriptionId, [
            'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'customer', 'default_payment_method'],
        ]);
        $updatedEvent = billingValidationBuildEventFromFixture(
            $updatedFixture,
            'evt_updated_' . $suffix,
            time() + 120,
            'customer.subscription.updated',
            $remoteSubscription
        );
        $deletedSubscriptionPayload = json_decode(
            json_encode($remoteSubscription, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            true
        );
        $deletedSubscriptionPayload['status'] = 'canceled';
        $deletedSubscriptionPayload['cancel_at_period_end'] = true;

        $deletedEvent = billingValidationBuildEventFromFixture(
            $deletedFixture,
            'evt_deleted_' . $suffix,
            time() + 60,
            'customer.subscription.deleted',
            billingValidationToObject($deletedSubscriptionPayload)
        );

        $service->processStripeWebhookEventObject(
            $updatedEvent,
            hash('sha256', json_encode($updatedEvent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            $stripe
        );
        $deletedResult = $service->processStripeWebhookEventObject(
            $deletedEvent,
            hash('sha256', json_encode($deletedEvent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            $stripe
        );
        $localAfterOutOfOrder = billingValidationFindLatestSubscriptionByUser($db, $userId);
        $deletedWebhookRow = billingValidationFindWebhookEvent($db, 'evt_deleted_' . $suffix);

        billingValidationAssert(($deletedResult['ignored'] ?? false) === true, 'O evento fora de ordem deveria ser marcado como ignorado.');
        billingValidationAssert((string) ($localAfterOutOfOrder['status'] ?? '') !== 'canceled', 'O evento antigo nao deveria cancelar a assinatura local.');
        billingValidationAssert((string) ($deletedWebhookRow['status'] ?? '') === 'ignored', 'O webhook fora de ordem precisa ser auditado como ignored.');

        $results[] = billingValidationResult(
            'webhook_out_of_order',
            'Webhook fora de ordem',
            'Garantir que eventos antigos nao revertam um estado mais novo vindo da Stripe.',
            'Fixtures customer.subscription.updated/deleted com created invertido e auditoria em provider_webhook_events.',
            [
                'ignored_result=' . json_encode($deletedResult, JSON_UNESCAPED_UNICODE),
                'subscription_status=' . (string) ($localAfterOutOfOrder['status'] ?? ''),
                'webhook_status=' . (string) ($deletedWebhookRow['status'] ?? ''),
            ],
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
            ],
            'OK',
            'Continuar auditando eventos ignored para detectar reorderings frequentes.'
        );

        $providerCurrentEnd = (string) ($scenario['local_subscription']['provider_current_period_end'] ?? '');
        $advanceTarget = strtotime($providerCurrentEnd) + 3600;
        billingValidationAdvanceTestClock($stripe, $clockId, $advanceTarget);
        $renewedRemoteSubscription = billingValidationWaitForRenewalInvoice($stripe, $providerSubscriptionId, $initialInvoiceId);
        $renewalInvoice = $renewedRemoteSubscription->latest_invoice ?? null;
        $renewalInvoiceId = is_object($renewalInvoice) ? trim((string) ($renewalInvoice->id ?? '')) : '';
        $renewalInvoiceStatus = is_object($renewalInvoice) ? trim((string) ($renewalInvoice->status ?? '')) : '';
        if ($renewalInvoiceId !== '' && $renewalInvoiceStatus !== 'paid') {
            $stripe->invoices->pay($renewalInvoiceId, [
                'payment_method' => (string) ($scenario['creation']['payment_method_id'] ?? ''),
                'expand' => ['payment_intent'],
            ]);
        }
        $renewedRemoteSubscription = billingValidationWaitForInvoicePaid($stripe, $providerSubscriptionId, $renewalInvoiceId);
        $renewalInvoice = $renewedRemoteSubscription->latest_invoice ?? null;
        $renewalInvoiceId = is_object($renewalInvoice) ? trim((string) ($renewalInvoice->id ?? '')) : $renewalInvoiceId;

        $transactionsBeforeRecovery = billingValidationFindPlanTransactions($db, $userId);
        $service->runStripeReconciliationCron();
        $transactionsAfterRecovery = billingValidationFindPlanTransactions($db, $userId);

        $delayedEvent = billingValidationBuildEventFromFixture(
            $invoicePaidFixture,
            'evt_delayed_' . $suffix,
            time() + 180,
            'invoice.paid',
            $renewalInvoice
        );
        $delayedResult = $service->processStripeWebhookEventObject(
            $delayedEvent,
            hash('sha256', json_encode($delayedEvent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            $stripe
        );
        $transactionsAfterDelayedWebhook = billingValidationFindPlanTransactions($db, $userId);

        billingValidationAssert(
            count($transactionsAfterRecovery) === count($transactionsBeforeRecovery) + 1,
            'A reconciliacao nao recuperou a renovacao antes do webhook atrasado.'
        );
        billingValidationAssert(
            count($transactionsAfterDelayedWebhook) === count($transactionsAfterRecovery),
            'O webhook atrasado nao deveria duplicar a invoice ja recuperada pela reconciliacao.'
        );

        $results[] = billingValidationResult(
            'webhook_delayed_recovery',
            'Webhook atrasado + reconciliacao',
            'Garantir que o cron recupere a renovacao perdida e que o webhook tardio nao duplique efeitos.',
            'Stripe Test Clock + runStripeReconciliationCron + fixture invoice.paid atrasado.',
            [
                'renewal_invoice=' . $renewalInvoiceId,
                'recovery_transactions=' . count($transactionsAfterRecovery),
                'delayed_result=' . json_encode($delayedResult, JSON_UNESCAPED_UNICODE),
            ],
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
            ],
            'OK',
            'Executar reconciliacao periodica continua sendo obrigatorio para atrasos reais.'
        );
    } catch (Throwable $error) {
        $results[] = billingValidationFailureResult(
            'webhook_suite',
            'Simulacao operacional de webhook',
            'Cobrir duplicidade, atraso e fora de ordem com fixtures e service real.',
            'Fixtures Stripe + processStripeWebhookEventObject + Stripe real em modo teste.',
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
            ],
            $error
        );
    } finally {
        if ($providerSubscriptionId !== null) {
            billingValidationCancelRemoteSubscription($stripe, $providerSubscriptionId);
        }
        if ($customerId !== null) {
            billingValidationDeleteRemoteCustomer($stripe, $customerId);
        }
        if ($userId !== null) {
            billingValidationCleanupUserArtifacts($db, $userId);
        }
        billingValidationDeletePlans($db, $planIds);
        billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
    }

    return $results;
}

/**
 * Executa os cenarios de upgrade, credito local e refund concorrente.
 *
 * @since 1.0.0
 */
function billingValidationRunBillingStrategyScenarios(PDO $db, SubscriptionsService $service, string $fixturesDir): array
{
    $stripe = getStripeClient();
    $transactionsService = billingValidationCreateTransactionsService($db);
    $settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails', 'autoRefundEnabled', 'coupons'];
    $settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
    $planIds = [];
    $managedUsers = [];
    $managedCustomers = [];
    $managedSubscriptions = [];
    $results = [];

    try {
        billingValidationEnsureStripeSettings($db);
        billingValidationUpsertSystemSetting($db, 'autoRefundEnabled', '0');

        $suffix = billingValidationMakeRunSuffix();
        $basePlanId = billingValidationCreateTestPlan($db, 'Base E2E ' . strtoupper($suffix), 20.00, 1);
        $upgradePlanId = billingValidationCreateTestPlan($db, 'Upgrade E2E ' . strtoupper($suffix), 30.00, 1);
        $creditPlanId = billingValidationCreateTestPlan($db, 'Credito E2E ' . strtoupper($suffix), 5.00, 1);
        $planIds = [$basePlanId, $upgradePlanId, $creditPlanId];

        $couponPayload = [[
            'code' => 'E2EUP5' . strtoupper(substr($suffix, -4)),
            'discountAmount' => 5,
            'discountType' => 'fixed',
            'maxUses' => 20,
            'uses' => 0,
            'expiresAt' => date('c', strtotime('+30 days')),
            'active' => true,
            'allowedPlanIds' => [$upgradePlanId],
        ], [
            'code' => 'E2EZERO' . strtoupper(substr($suffix, -4)),
            'discountAmount' => 500,
            'discountType' => 'fixed',
            'maxUses' => 20,
            'uses' => 0,
            'expiresAt' => date('c', strtotime('+30 days')),
            'active' => true,
            'allowedPlanIds' => [$creditPlanId],
        ]];
        billingValidationUpsertSystemSetting($db, 'coupons', $couponPayload);

        $upgradeUser = billingValidationCreateTestUser($db, $suffix . 'up');
        $upgradeUserId = (string) $upgradeUser['id'];
        $managedUsers[] = $upgradeUserId;
        $upgradeCustomer = billingValidationCreateClockedCustomer($db, $stripe, $upgradeUser);
        $managedCustomers[] = $upgradeCustomer['customer_id'];

        $seedStart = date('Y-m-d H:i:s', strtotime('-1 day'));
        $seedEnd = date('Y-m-d H:i:s', strtotime('+29 days'));
        billingValidationSeedActiveLocalSubscription(
            $db,
            $upgradeUserId,
            $basePlanId,
            'Essencial',
            20.00,
            $seedStart,
            $seedEnd
        );

        $expectedCredit = round(calculateSafeProratedCredit($db, $upgradeUserId), 2);
        $couponCode = (string) $couponPayload[0]['code'];
        $upgradeScenario = billingValidationCreateActiveInlineSubscription($db, $service, $stripe, $upgradeUserId, $upgradePlanId, [
            'coupon_code' => $couponCode,
        ]);
        $upgradeCreation = $upgradeScenario['creation'];
        $managedSubscriptions[] = (string) ($upgradeCreation['subscription_id'] ?? '');

        $expectedFinal = max(0, round(30.00 - $expectedCredit - 5.00, 2));
        billingValidationAssert(
            round((float) ($upgradeCreation['term_total_amount'] ?? -1), 2) === $expectedFinal,
            'O backend nao recalculou o total final esperado para upgrade + cupom.'
        );
        billingValidationAssert(
            trim((string) ($upgradeCreation['subscription_id'] ?? '')) !== '',
            'O upgrade com saldo parcial deveria gerar uma assinatura Stripe remota.'
        );

        $upgradeTransaction = $upgradeScenario['transaction'];
        billingValidationAssert($upgradeTransaction !== null, 'A transacao do upgrade nao foi persistida.');
        billingValidationAssert(
            round((float) ($upgradeTransaction['amount'] ?? -1), 2) === $expectedFinal,
            'O valor persistido da transacao do upgrade diverge do total final calculado.'
        );

        $localCreditPaymentMethodId = billingValidationCreateAttachedPaymentMethod($stripe, $upgradeCustomer['customer_id']);
        $localCreditCreation = $service->createStripeInlineSubscription($upgradeUserId, [
            'plan_id' => $creditPlanId,
            'payment_method_id' => $localCreditPaymentMethodId,
            'save_card' => true,
            'billing_mode' => 'monthly',
            'installment_count' => 1,
            'coupon_code' => (string) ($couponPayload[1]['code'] ?? ''),
            'checkout_attempt_id' => 'billing_validation_' . billingValidationMakeRunSuffix(),
            'checkout_adhesion_terms_accepted' => true,
            'checkout_adhesion_terms_version' => LegalDocumentVersion::version('checkout_adhesion_terms'),
        ]);
        $latestLocalSubscription = billingValidationFindLatestSubscriptionByUser($db, $upgradeUserId);
        $localCreditTransactions = billingValidationFindPlanTransactions($db, $upgradeUserId);
        $lastLocalCreditTransaction = end($localCreditTransactions);

        billingValidationAssert(
            (string) ($localCreditCreation['mode'] ?? '') === 'local_credit',
            'Quando o total final zera, o fluxo oficial deve cair em local_credit.'
        );
        billingValidationAssert(
            round((float) ($localCreditCreation['term_total_amount'] ?? -1), 2) === 0.0,
            'O fluxo local_credit precisa registrar term_total_amount igual a zero.'
        );
        billingValidationAssert(
            (int) ($latestLocalSubscription['plan_id'] ?? 0) === $creditPlanId,
            'O fluxo local_credit nao promoveu o usuario para o plano de destino.'
        );
        billingValidationAssert(
            round((float) ($lastLocalCreditTransaction['amount'] ?? -1), 2) === 0.0,
            'O fluxo local_credit deveria persistir transacao local zerada.'
        );

        $results[] = billingValidationResult(
            'upgrade_proration_strategy',
            'Upgrade e pro-rata canonico',
            'Provar que a estrategia oficial segue credito proporcional local no backend, com piso zero e cupom. ',
            'createStripeInlineSubscription + calculateSafeProratedCredit + persistencia de transacoes locais.',
            [
                'credit=' . number_format($expectedCredit, 2, '.', ''),
                'coupon=' . $couponCode,
                'upgrade_final=' . number_format($expectedFinal, 2, '.', ''),
                'local_credit_mode=' . (string) ($localCreditCreation['mode'] ?? ''),
            ],
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsBillingSupport.php',
            ],
            'OK',
            'A estrategia oficial permanece como credito proporcional local. Nao usar prorata nativo Stripe sem migracao explicita.',
            [
                'strategy' => 'local_credit',
                'upgrade_invoice_id' => (string) ($upgradeCreation['invoice_id'] ?? ''),
            ]
        );

        $refundUser = billingValidationCreateTestUser($db, $suffix . 'rf');
        $refundUserId = (string) $refundUser['id'];
        $managedUsers[] = $refundUserId;
        $refundCustomer = billingValidationCreateClockedCustomer($db, $stripe, $refundUser);
        $managedCustomers[] = $refundCustomer['customer_id'];

        $refundScenario = billingValidationCreateActiveInlineSubscription($db, $service, $stripe, $refundUserId, $upgradePlanId);
        $refundProviderSubscriptionId = (string) ($refundScenario['creation']['subscription_id'] ?? '');
        $managedSubscriptions[] = $refundProviderSubscriptionId;

        $refundTransactions = billingValidationFindPlanTransactions($db, $refundUserId);
        $refundTransaction = end($refundTransactions);
        billingValidationAssert(is_array($refundTransaction), 'Nao foi encontrada transacao valida para o fluxo de refund.');
        $refundTransactionId = (int) ($refundTransaction['id'] ?? 0);

        $requestResult = $transactionsService->requestRefund($refundUserId, [
            'transaction_id' => $refundTransactionId,
            'reason' => 'Suite E2E cancelamento',
        ]);
        $transactionAfterRequest = billingValidationFindPlanTransactions($db, $refundUserId);
        $transactionAfterRequest = end($transactionAfterRequest);
        $subscriptionAfterRequest = billingValidationFindLatestSubscriptionByUser($db, $refundUserId);

        billingValidationAssert(
            (string) ($transactionAfterRequest['status'] ?? '') === 'refund_requested',
            'Solicitar reembolso deveria marcar a transacao como refund_requested.'
        );
        billingValidationAssert(
            (string) ($subscriptionAfterRequest['status'] ?? '') === 'active',
            'Solicitacao de refund nao deveria cortar acesso antes da decisao financeira final.'
        );

        $service->cancelRefundRequest($refundUserId);
        $transactionAfterCancel = billingValidationFindPlanTransactions($db, $refundUserId);
        $transactionAfterCancel = end($transactionAfterCancel);
        $subscriptionAfterCancel = billingValidationFindLatestSubscriptionByUser($db, $refundUserId);

        billingValidationAssert(
            (string) ($transactionAfterCancel['status'] ?? '') === 'approved',
            'cancelRefundRequest deveria recompor a transacao para approved.'
        );
        billingValidationAssert(
            (string) ($subscriptionAfterCancel['status'] ?? '') === 'active',
            'cancelRefundRequest deveria manter a assinatura recomposta como ativa.'
        );

        $transactionsService->requestRefund($refundUserId, [
            'transaction_id' => $refundTransactionId,
            'reason' => 'Suite E2E aprovacao admin',
        ]);
        $approvalResult = $transactionsService->approveRefund([
            'transaction_id' => $refundTransactionId,
            'reason' => 'Suite E2E aprovacao admin',
        ]);

        $transactionAfterApproval = billingValidationFindPlanTransactions($db, $refundUserId);
        $transactionAfterApproval = end($transactionAfterApproval);
        $subscriptionAfterApproval = billingValidationFindLatestSubscriptionByUser($db, $refundUserId);
        $userRow = $db->prepare('SELECT plan, current_plan_id FROM users WHERE id = :id');
        $userRow->execute([':id' => $refundUserId]);
        $userAfterApproval = $userRow->fetch(PDO::FETCH_ASSOC) ?: [];

        billingValidationAssert(
            (string) ($transactionAfterApproval['status'] ?? '') === 'refunded',
            'A aprovacao administrativa deveria finalizar o estorno como refunded.'
        );
        billingValidationAssert(
            ((string) ($userAfterApproval['plan'] ?? '')) === 'Gratuito',
            'A aprovacao do refund deveria resetar o usuario para o plano gratuito.'
        );
        billingValidationAssert(
            $subscriptionAfterApproval === null || (string) ($subscriptionAfterApproval['status'] ?? '') === 'canceled',
            'A aprovacao do refund deveria encerrar a assinatura ativa local.'
        );

        $doubleApprovalError = '';
        try {
            $transactionsService->approveRefund([
                'transaction_id' => $refundTransactionId,
                'reason' => 'Suite E2E duplicidade',
            ]);
        } catch (Throwable $approvalError) {
            $doubleApprovalError = $approvalError->getMessage();
        }

        billingValidationAssert(
            str_contains($doubleApprovalError, 'já foi reembolsada'),
            'A segunda aprovacao administrativa deveria ser bloqueada como duplicada.'
        );

        $paymentIntentId = resolveStripePaymentIntentIdForTransaction($db, $transactionAfterApproval, $stripe);
        $paymentIntent = $stripe->paymentIntents->retrieve($paymentIntentId, ['expand' => ['latest_charge']]);
        $chargeId = trim((string) ($paymentIntent->latest_charge->id ?? $paymentIntent->latest_charge ?? ''));
        billingValidationAssert($chargeId !== '', 'Nao foi possivel localizar a charge para o webhook de refund.');

        $chargeRefundedEvent = billingValidationBuildEventFromFixture(
            billingValidationLoadFixture($fixturesDir, 'charge.refunded.json'),
            'evt_refund_' . $suffix,
            time() + 240,
            'charge.refunded',
            $stripe->charges->retrieve($chargeId)
        );
        $refundWebhookResult = $service->processStripeWebhookEventObject(
            $chargeRefundedEvent,
            hash('sha256', json_encode($chargeRefundedEvent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            $stripe
        );
        $transactionAfterWebhook = billingValidationFindPlanTransactions($db, $refundUserId);
        $transactionAfterWebhook = end($transactionAfterWebhook);
        $userRow->execute([':id' => $refundUserId]);
        $userAfterWebhook = $userRow->fetch(PDO::FETCH_ASSOC) ?: [];

        billingValidationAssert(
            (string) ($transactionAfterWebhook['status'] ?? '') === 'refunded',
            'O webhook charge.refunded nao deveria reabrir o estorno ja concluido.'
        );
        billingValidationAssert(
            ((string) ($userAfterWebhook['plan'] ?? '')) === 'Gratuito',
            'O webhook concorrente nao deveria restaurar acesso apos refund aprovado.'
        );

        $results[] = billingValidationResult(
            'refund_concurrency',
            'Refund concorrente',
            'Cobrir solicitacao, cancelamento, aprovacao duplicada e charge.refunded concorrendo com o fluxo manual.',
            'TransactionsService::requestRefund/approveRefund + cancelRefundRequest + webhook charge.refunded.',
            [
                'request=' . (string) ($requestResult['message'] ?? ''),
                'approval=' . (string) ($approvalResult['message'] ?? ''),
                'duplicate_error=' . $doubleApprovalError,
                'webhook=' . json_encode($refundWebhookResult, JSON_UNESCAPED_UNICODE),
            ],
            [
                dirname(__DIR__) . '/modules/transactions/services/TransactionsService.php',
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
            ],
            'OK',
            'Manter approveRefund idempotente e reprocessar webhooks apenas como confirmacao final.',
            [
                'transaction_id' => $refundTransactionId,
                'payment_intent_id' => $paymentIntentId,
            ]
        );
    } catch (Throwable $error) {
        $results[] = billingValidationFailureResult(
            'billing_strategy_suite',
            'Upgrade e refund concorrente',
            'Cobrir estrategia canonica de credito proporcional local e concorrencia de refund.',
            'Services oficiais com Stripe real em modo teste e banco local.',
            [
                dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php',
                dirname(__DIR__) . '/modules/transactions/services/TransactionsService.php',
            ],
            $error
        );
    } finally {
        foreach (array_unique(array_filter($managedSubscriptions)) as $subscriptionId) {
            billingValidationCancelRemoteSubscription($stripe, $subscriptionId);
        }
        foreach (array_unique(array_filter($managedCustomers)) as $customerId) {
            billingValidationDeleteRemoteCustomer($stripe, $customerId);
        }
        foreach (array_unique(array_filter($managedUsers)) as $managedUserId) {
            billingValidationCleanupUserArtifacts($db, $managedUserId);
        }
        billingValidationDeletePlans($db, $planIds);
        billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
    }

    return $results;
}

/**
 * Consolida a contagem por status e o veredito final.
 *
 * @since 1.0.0
 */
function billingValidationFinalizeReport(array $results): array
{
    $counts = [
        'OK' => 0,
        'RISCO' => 0,
        'CRITICO' => 0,
        'NAO_COMPROVADO' => 0,
    ];

    foreach ($results as $result) {
        $status = (string) ($result['status'] ?? 'RISCO');
        if (!array_key_exists($status, $counts)) {
            $counts[$status] = 0;
        }
        $counts[$status]++;
    }

    $verdict = ($counts['CRITICO'] === 0 && $counts['NAO_COMPROVADO'] === 0) ? 'GO' : 'NO-GO';

    return [
        'generated_at' => gmdate('c'),
        'verdict' => $verdict,
        'counts' => $counts,
        'results' => $results,
    ];
}

/**
 * Bootstrap CLI da suite operacional.
 *
 * @since 1.0.0
 */
$scenario = billingValidationCliOption('scenario', 'all');
$fixturesDir = billingValidationCliOption('fixtures-dir', __DIR__ . '/fixtures/stripe');
$jsonMode = in_array('--json', $argv ?? [], true);

try {
    if (
        isProductionEnv()
        && billingValidationCliOption('allow-production') !== 'I_UNDERSTAND_THIS_MUTATES_BILLING'
    ) {
        throw new RuntimeException(
            'Suite operacional bloqueada em producao. Execute em banco isolado ou informe '
            . '--allow-production=I_UNDERSTAND_THIS_MUTATES_BILLING conscientemente.'
        );
    }

    $db = billingValidationConnectDb();
    $service = billingValidationCreateSubscriptionsService($db);
    $results = [];

    if ($scenario === 'all' || $scenario === 'lifecycle') {
        $results = array_merge($results, billingValidationRunRenewalScenarios($db, $service));
        $results = array_merge($results, billingValidationRunBillingStrategyScenarios($db, $service, $fixturesDir));
    }

    if ($scenario === 'all' || $scenario === 'webhook') {
        $results = array_merge($results, billingValidationRunWebhookScenarios($db, $service, $fixturesDir));
    }

    $payload = billingValidationFinalizeReport($results);

    if ($jsonMode) {
        echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    echo 'Billing Stripe Operational Validation: ' . $payload['verdict'] . PHP_EOL;
    foreach ($payload['results'] as $result) {
        echo '- [' . $result['status'] . '] ' . $result['name'] . PHP_EOL;
    }
    exit(0);
} catch (Throwable $error) {
    $payload = billingValidationFinalizeReport([
        billingValidationFailureResult(
            'billing_validation_bootstrap',
            'Bootstrap da suite operacional',
            'Inicializar dependencias da validacao operacional do billing Stripe.',
            'CLI PHP + bootstrap de banco, Stripe e services oficiais.',
            [
                dirname(__DIR__) . '/tests/BillingStripeOperationalValidationTest.php',
                dirname(__DIR__) . '/tests/support/BillingStripeValidationSupport.php',
            ],
            $error
        ),
    ]);

    if ($jsonMode) {
        echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(1);
    }

    fwrite(STDERR, 'Billing Stripe Operational Validation: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
