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

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/payment_provider.php';
require_once __DIR__ . '/../../config/stripe.php';
require_once __DIR__ . '/../../modules/subscriptions/repositories/SubscriptionsRepository.php';
require_once __DIR__ . '/../../modules/subscriptions/validators/SubscriptionsValidator.php';
require_once __DIR__ . '/../../modules/subscriptions/services/SubscriptionsService.php';
require_once __DIR__ . '/../../modules/transactions/repositories/TransactionsRepository.php';
require_once __DIR__ . '/../../modules/transactions/validators/TransactionsValidator.php';
require_once __DIR__ . '/../../modules/transactions/services/TransactionsService.php';
require_once __DIR__ . '/../../modules/subscriptions/services/SubscriptionsBillingSupport.php';

/**
 * Lanca erro padronizado quando a validacao operacional falha.
 *
 * @since 1.0.0
 */
function billingValidationAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * Abre a conexao principal do backend para a suite operacional.
 *
 * @since 1.0.0
 */
function billingValidationConnectDb(): PDO
{
    return (new Database())->getConnection();
}

/**
 * Instancia o servico oficial de assinaturas.
 *
 * @since 1.0.0
 */
function billingValidationCreateSubscriptionsService(PDO $db): SubscriptionsService
{
    return new SubscriptionsService(
        $db,
        new SubscriptionsRepository($db),
        new SubscriptionsValidator()
    );
}

/**
 * Instancia o servico oficial de transacoes.
 *
 * @since 1.0.0
 */
function billingValidationCreateTransactionsService(PDO $db): TransactionsService
{
    return new TransactionsService(
        $db,
        new TransactionsRepository($db),
        new TransactionsValidator()
    );
}

/**
 * Persiste uma configuracao de sistema durante a validacao.
 *
 * @since 1.0.0
 */
function billingValidationUpsertSystemSetting(PDO $db, string $key, $value): void
{
    $db->prepare("
        INSERT INTO system_settings (key_name, value_json)
        VALUES (:key_name, :value_json)
        ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)
    ")->execute([
        ':key_name' => $key,
        ':value_json' => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

/**
 * Captura um snapshot de configuracoes para restaurar ao final.
 *
 * @since 1.0.0
 */
function billingValidationSnapshotSystemSettings(PDO $db, array $keys): array
{
    if ($keys === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $stmt = $db->prepare("SELECT key_name, value_json FROM system_settings WHERE key_name IN ({$placeholders})");
    $stmt->execute(array_values($keys));

    $snapshot = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $snapshot[(string) $row['key_name']] = $row['value_json'];
    }

    return $snapshot;
}

/**
 * Restaura configuracoes alteradas pela suite.
 *
 * @since 1.0.0
 */
function billingValidationRestoreSystemSettings(PDO $db, array $snapshot, array $touchedKeys): void
{
    foreach ($touchedKeys as $key) {
        if (array_key_exists($key, $snapshot)) {
            $db->prepare("
                INSERT INTO system_settings (key_name, value_json)
                VALUES (:key_name, :value_json)
                ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)
            ")->execute([
                ':key_name' => $key,
                ':value_json' => $snapshot[$key],
            ]);
            continue;
        }

        $db->prepare("DELETE FROM system_settings WHERE key_name = :key_name")
            ->execute([':key_name' => $key]);
    }
}

/**
 * Garante que a suite rode em Stripe-only com checkout interno.
 *
 * @since 1.0.0
 */
function billingValidationEnsureStripeSettings(PDO $db): void
{
    billingValidationUpsertSystemSetting($db, 'paymentProvider', 'stripe');
    billingValidationUpsertSystemSetting($db, 'paymentCheckoutMode', 'internal');
    billingValidationUpsertSystemSetting($db, 'planDetails', [
        'Gratuito' => ['enabled' => true],
        'Essencial' => ['enabled' => true],
        'Pro' => ['enabled' => true],
        'Elite' => ['enabled' => true],
    ]);
}

/**
 * Gera um id curto para isolar artefatos da rodada.
 *
 * @since 1.0.0
 */
function billingValidationMakeRunSuffix(): string
{
    return strtolower(bin2hex(random_bytes(4)));
}

/**
 * Cria um plano temporario para a suite.
 *
 * @since 1.0.0
 */
function billingValidationCreateTestPlan(
    PDO $db,
    string $name,
    float $price,
    int $tier,
    string $intervalUnit = 'month',
    int $intervalCount = 1
): int {
    $db->prepare("
        INSERT INTO plans (name, description, price, interval_count, interval_unit, features, tier)
        VALUES (:name, :description, :price, :interval_count, :interval_unit, :features, :tier)
    ")->execute([
        ':name' => $name,
        ':description' => 'Plano temporario da suite E2E de billing.',
        ':price' => round($price, 2),
        ':interval_count' => max(1, $intervalCount),
        ':interval_unit' => $intervalUnit,
        ':features' => json_encode(['suite' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':tier' => $tier,
    ]);

    return (int) $db->lastInsertId();
}

/**
 * Cria um usuario temporario com perfil apto para checkout Stripe.
 *
 * @since 1.0.0
 */
function billingValidationCreateTestUser(PDO $db, string $suffix): array
{
    $userId = 'billing-e2e-' . $suffix;
    $testMailbox = trim((string) getenv('BILLING_E2E_TEST_EMAIL'));
    if ($testMailbox === '') {
        $testMailbox = trim((string) getenv('SMOKE_AUTH_EMAIL'));
    }
    if (filter_var($testMailbox, FILTER_VALIDATE_EMAIL)) {
        [$mailboxLocal, $mailboxDomain] = explode('@', $testMailbox, 2);
        $email = $mailboxLocal . '+billing-e2e-' . $suffix . '@' . $mailboxDomain;
    } else {
        $email = "billing-e2e-{$suffix}@concursomestre.com";
    }
    $name = 'Billing E2E ' . strtoupper($suffix);
    $cpfDigits = substr(str_pad((string) (abs(crc32($suffix)) % 100000000000), 11, '0', STR_PAD_LEFT), 0, 11);
    $cpf = substr($cpfDigits, 0, 3) . '.'
        . substr($cpfDigits, 3, 3) . '.'
        . substr($cpfDigits, 6, 3) . '-'
        . substr($cpfDigits, 9, 2);

    $db->prepare("
        INSERT INTO users (
            id, name, email, email_verified, cpf, role, status, plan,
            billing_cycle, current_plan_id, subscription_end, has_saved_card
        ) VALUES (
            :id, :name, :email, 1, :cpf, 'user', 'active', 'Gratuito',
            'monthly', NULL, NULL, 0
        )
    ")->execute([
        ':id' => $userId,
        ':name' => $name,
        ':email' => $email,
        ':cpf' => $cpf,
    ]);

    $db->prepare("
        INSERT INTO addresses (
            user_id, zip_code, street, number, complement, neighborhood, city, state
        ) VALUES (
            :user_id, '01001-000', 'Rua Billing Teste', '100', 'Sala 1', 'Centro', 'Sao Paulo', 'SP'
        )
    ")->execute([
        ':user_id' => $userId,
    ]);

    return [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
    ];
}

/**
 * Cria um PaymentMethod de teste, anexa ao customer e define como padrao.
 *
 * @since 1.0.0
 */
function billingValidationCreateAttachedPaymentMethod($stripe, string $customerId): string
{
    $paymentMethod = $stripe->paymentMethods->create([
        'type' => 'card',
        'card' => [
            'token' => 'tok_visa',
        ],
    ]);

    $stripe->paymentMethods->attach((string) $paymentMethod->id, [
        'customer' => $customerId,
    ]);
    $stripe->customers->update($customerId, [
        'invoice_settings' => [
            'default_payment_method' => (string) $paymentMethod->id,
        ],
    ]);

    return (string) $paymentMethod->id;
}

/**
 * Semeia uma assinatura local ativa para cenarios de upgrade com credito proporcional.
 *
 * @since 1.0.0
 */
function billingValidationSeedActiveLocalSubscription(
    PDO $db,
    string $userId,
    int $planId,
    string $planName,
    float $recurringAmount,
    string $currentPeriodStart,
    string $currentPeriodEnd
): void {
    $db->prepare("
        INSERT INTO user_subscriptions (
            user_id, plan_id, payment_provider, status, current_period_start, current_period_end,
            external_subscription_id, auto_renew, cancel_at_period_end, is_recurring, recurring_amount,
            total_installments, paid_installments
        ) VALUES (
            :user_id, :plan_id, 'stripe', 'active', :current_period_start, :current_period_end,
            :external_subscription_id, 1, 0, 1, :recurring_amount, 1, 1
        )
    ")->execute([
        ':user_id' => $userId,
        ':plan_id' => $planId,
        ':current_period_start' => $currentPeriodStart,
        ':current_period_end' => $currentPeriodEnd,
        ':external_subscription_id' => 'seed-' . $userId,
        ':recurring_amount' => round($recurringAmount, 2),
    ]);

    $db->prepare("
        UPDATE users
        SET plan = :plan_name,
            current_plan_id = :plan_id,
            subscription_end = :subscription_end
        WHERE id = :user_id
    ")->execute([
        ':plan_name' => canonicalUserPlanValue($planName),
        ':plan_id' => $planId,
        ':subscription_end' => $currentPeriodEnd,
        ':user_id' => $userId,
    ]);
}

/**
 * Cria um Test Clock e um customer Stripe de teste vinculado ao usuario local.
 *
 * @since 1.0.0
 */
function billingValidationCreateClockedCustomer(PDO $db, $stripe, array $user): array
{
    $clock = $stripe->testHelpers->testClocks->create([
        'frozen_time' => time(),
        'name' => 'billing-e2e-' . $user['id'],
    ]);

    $customer = $stripe->customers->create([
        'name' => $user['name'],
        'email' => $user['email'],
        'test_clock' => $clock->id,
        'metadata' => [
            'user_id' => $user['id'],
            'suite' => 'billing_e2e',
        ],
    ]);

    $db->prepare("UPDATE users SET stripe_customer_id = :stripe_customer_id WHERE id = :id")
        ->execute([
            ':stripe_customer_id' => (string) $customer->id,
            ':id' => (string) $user['id'],
        ]);

    return [
        'clock_id' => (string) $clock->id,
        'customer_id' => (string) $customer->id,
    ];
}

/**
 * Aguarda o Test Clock voltar ao estado pronto.
 *
 * @since 1.0.0
 */
function billingValidationWaitForTestClockReady($stripe, string $clockId, int $timeoutSeconds = 90): object
{
    $deadline = time() + max(10, $timeoutSeconds);
    $clock = null;

    do {
        $clock = $stripe->testHelpers->testClocks->retrieve($clockId, []);
        if (($clock->status ?? '') === 'ready') {
            return $clock;
        }

        usleep(500000);
    } while (time() < $deadline);

    throw new RuntimeException('O Test Clock da Stripe nao ficou pronto dentro do tempo esperado.');
}

/**
 * Avanca o relogio de teste da Stripe e aguarda a estabilizacao.
 *
 * @since 1.0.0
 */
function billingValidationAdvanceTestClock($stripe, string $clockId, int $nextTimestamp): object
{
    $stripe->testHelpers->testClocks->advance($clockId, [
        'frozen_time' => $nextTimestamp,
    ]);

    return billingValidationWaitForTestClockReady($stripe, $clockId);
}

/**
 * Confirma o PaymentIntent ate status final de sucesso.
 *
 * @since 1.0.0
 */
function billingValidationEnsurePaymentIntentSucceeded($stripe, string $paymentIntentId, string $paymentMethodId = 'pm_card_visa'): object
{
    $paymentIntent = $stripe->paymentIntents->retrieve($paymentIntentId, []);
    $status = (string) ($paymentIntent->status ?? '');

    if ($status === 'succeeded') {
        return $paymentIntent;
    }

    if (in_array($status, ['requires_confirmation', 'requires_payment_method'], true)) {
        $payload = [];
        if ($paymentMethodId !== '') {
            $payload['payment_method'] = $paymentMethodId;
        }

        $paymentIntent = $stripe->paymentIntents->confirm($paymentIntentId, $payload);
    }

    $deadline = time() + 30;
    do {
        if ((string) ($paymentIntent->status ?? '') === 'succeeded') {
            return $paymentIntent;
        }

        if (!in_array((string) ($paymentIntent->status ?? ''), ['processing', 'requires_action', 'requires_confirmation'], true)) {
            break;
        }

        usleep(500000);
        $paymentIntent = $stripe->paymentIntents->retrieve($paymentIntentId, []);
    } while (time() < $deadline);

    throw new RuntimeException('O PaymentIntent Stripe nao chegou a sucesso. Status final: ' . (string) ($paymentIntent->status ?? 'desconhecido'));
}

/**
 * Aguarda a cobranca Stripe ficar finalizavel com invoice paga e charge aprovada.
 *
 * @since 1.0.0
 */
function billingValidationWaitForFinalizableStripeSubscription(
    $stripe,
    string $subscriptionId,
    string $paymentIntentId,
    int $timeoutSeconds = 45
): array {
    $deadline = time() + max(10, $timeoutSeconds);

    do {
        $subscription = $stripe->subscriptions->retrieve($subscriptionId, [
            'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'default_payment_method', 'customer'],
        ]);
        $invoice = $subscription->latest_invoice ?? null;
        $invoiceStatus = is_object($invoice) ? trim((string) ($invoice->status ?? '')) : '';
        $paymentIntent = $stripe->paymentIntents->retrieve($paymentIntentId, [
            'expand' => ['latest_charge', 'payment_method'],
        ]);
        $paymentIntentStatus = trim((string) ($paymentIntent->status ?? ''));
        $charge = $paymentIntent->latest_charge ?? null;

        if (is_string($charge) && $charge !== '') {
            $charge = $stripe->charges->retrieve($charge, []);
        }

        $chargeStatus = is_object($charge) ? trim((string) ($charge->status ?? '')) : '';
        $chargePaid = is_object($charge) ? !empty($charge->paid) : false;

        if ($paymentIntentStatus === 'succeeded' && $chargeStatus === 'succeeded' && $chargePaid && in_array($invoiceStatus, ['paid', 'open'], true)) {
            return [
                'subscription' => $subscription,
                'invoice' => $invoice,
                'payment_intent' => $paymentIntent,
                'charge' => $charge,
            ];
        }

        usleep(750000);
    } while (time() < $deadline);

    throw new RuntimeException('A cobranca Stripe nao ficou pronta para finalize dentro do tempo esperado.');
}

/**
 * Cria, confirma e finaliza uma assinatura inline real no backend oficial.
 *
 * @since 1.0.0
 */
function billingValidationCreateActiveInlineSubscription(
    PDO $db,
    SubscriptionsService $service,
    $stripe,
    string $userId,
    int $planId,
    array $payloadOverrides = []
): array {
    $customerData = getStripeCustomerForUser($db, $userId);
    $paymentMethodId = trim((string) ($payloadOverrides['payment_method_id'] ?? ''));
    if ($paymentMethodId === '') {
        $paymentMethodId = billingValidationCreateAttachedPaymentMethod($stripe, (string) $customerData['customer_id']);
    }

    $payload = array_merge([
        'plan_id' => $planId,
        'payment_method_id' => $paymentMethodId,
        'saved_card_id' => '',
        'save_card' => true,
        'auto_renew' => true,
        'billing_mode' => 'single_installment',
        'installment_count' => 1,
        'checkout_attempt_id' => 'billing_validation_' . billingValidationMakeRunSuffix(),
        'checkout_adhesion_terms_accepted' => true,
        'checkout_adhesion_terms_version' => LegalDocumentVersion::version('checkout_adhesion_terms'),
    ], $payloadOverrides);

    $creation = $service->createStripeInlineSubscription($userId, $payload);
    $remoteSubscription = $stripe->subscriptions->retrieve((string) $creation['subscription_id'], [
        'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'default_payment_method', 'customer'],
    ]);
    $latestInvoice = $remoteSubscription->latest_invoice ?? null;
    $latestInvoiceId = is_object($latestInvoice) ? trim((string) ($latestInvoice->id ?? '')) : '';
    $resolvedPaymentIntentId = trim((string) ($creation['payment_intent_id'] ?? ''));

    if ($resolvedPaymentIntentId === '' && $latestInvoice) {
        $resolvedPaymentIntentId = getStripeInvoicePaymentIntentId($latestInvoice);
    }

    if ($resolvedPaymentIntentId === '' && $latestInvoiceId !== '') {
        $paidInvoice = $stripe->invoices->pay($latestInvoiceId, [
            'payment_method' => $paymentMethodId,
            'expand' => ['payment_intent'],
        ]);
        $latestInvoice = $paidInvoice;
        $resolvedPaymentIntentId = getStripeInvoicePaymentIntentId($paidInvoice);
    }

    if ($resolvedPaymentIntentId !== '') {
        billingValidationEnsurePaymentIntentSucceeded(
            $stripe,
            $resolvedPaymentIntentId,
            (string) ($creation['payment_method_id'] ?? $paymentMethodId)
        );
        billingValidationWaitForFinalizableStripeSubscription(
            $stripe,
            (string) $creation['subscription_id'],
            $resolvedPaymentIntentId
        );
    }

    $creation['payment_intent_id'] = $resolvedPaymentIntentId;

    $finalize = $service->finalizeStripeSubscription($userId, [
        'subscription_id' => $creation['subscription_id'],
        'plan_id' => $planId,
        'auto_renew' => (bool) ($payload['auto_renew'] ?? true),
        'payment_method_id' => (string) ($creation['payment_method_id'] ?? $payload['payment_method_id'] ?? ''),
        'payment_intent_id' => $resolvedPaymentIntentId,
        'saved_card_id' => (string) ($creation['saved_card_id'] ?? ''),
        'save_card' => (bool) ($creation['save_card'] ?? $payload['save_card'] ?? false),
    ]);

    $remoteSubscription = $stripe->subscriptions->retrieve((string) $creation['subscription_id'], [
        'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'default_payment_method', 'customer'],
    ]);
    $localSubscription = billingValidationFindLatestSubscriptionByUser($db, $userId);
    $latestInvoice = $remoteSubscription->latest_invoice ?? null;
    $transaction = is_object($latestInvoice)
        ? findStripeTransactionByInvoiceId($db, (string) ($latestInvoice->id ?? ''))
        : null;

    if ($transaction === null) {
        $invoiceStatus = is_object($latestInvoice) ? (string) ($latestInvoice->status ?? '') : '';
        $invoiceId = is_object($latestInvoice) ? (string) ($latestInvoice->id ?? '') : '';
        $subscriptionStatus = (string) ($remoteSubscription->status ?? '');
        $paymentIntentStatus = is_object($latestInvoice)
            ? getStripeInvoicePaymentIntentStatus($latestInvoice)
            : '';

        throw new RuntimeException(
            'A assinatura foi finalizada sem materializar a transacao inicial. '
            . 'subscription_status=' . $subscriptionStatus
            . '; invoice_status=' . $invoiceStatus
            . '; payment_intent_status=' . $paymentIntentStatus
            . '; invoice_id=' . $invoiceId
            . '; finalize_response_type=' . (string) ($finalize['response_type'] ?? 'success')
            . '; finalize=' . json_encode($finalize, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }

    return [
        'creation' => $creation,
        'finalize' => $finalize,
        'remote_subscription' => $remoteSubscription,
        'local_subscription' => $localSubscription,
        'latest_invoice' => $latestInvoice,
        'transaction' => $transaction,
    ];
}

/**
 * Busca a ultima assinatura local do usuario.
 *
 * @since 1.0.0
 */
function billingValidationFindLatestSubscriptionByUser(PDO $db, string $userId): ?array
{
    $stmt = $db->prepare("
        SELECT *
        FROM user_subscriptions
        WHERE user_id = :user_id
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([':user_id' => $userId]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Lista as transacoes de plano do usuario para comparar antes e depois.
 *
 * @since 1.0.0
 */
function billingValidationFindPlanTransactions(PDO $db, string $userId): array
{
    $stmt = $db->prepare("
        SELECT *
        FROM transactions
        WHERE user_id = :user_id
          AND type = 'plan'
        ORDER BY id ASC
    ");
    $stmt->execute([':user_id' => $userId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

/**
 * Localiza uma transacao de plano pela invoice Stripe.
 *
 * @since 1.0.0
 */
function billingValidationFindPlanTransactionByInvoice(PDO $db, string $invoiceId): ?array
{
    $stmt = $db->prepare("
        SELECT *
        FROM transactions
        WHERE provider_invoice_id = :provider_invoice_id
           OR external_id = :external_id
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([
        ':provider_invoice_id' => $invoiceId,
        ':external_id' => $invoiceId,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Busca a ultima referencia de webhook por id do evento.
 *
 * @since 1.0.0
 */
function billingValidationFindWebhookEvent(PDO $db, string $eventId): ?array
{
    $stmt = $db->prepare("
        SELECT *
        FROM provider_webhook_events
        WHERE event_id = :event_id
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([':event_id' => $eventId]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Extrai o periodo remoto mais confiavel do objeto Stripe usado na suite.
 *
 * @since 1.0.0
 */
function billingValidationExtractRemoteSubscriptionPeriod($subscription): array
{
    $timestamps = getStripeSubscriptionPeriodTimestamps($subscription);
    $start = !empty($timestamps['start']) ? formatStripeTimestampToDb((int) $timestamps['start']) : '';
    $end = !empty($timestamps['end']) ? formatStripeTimestampToDb((int) $timestamps['end']) : '';

    if ($start !== '' && $end !== '') {
        return [
            'start' => $start,
            'end' => $end,
        ];
    }

    $latestInvoice = is_object($subscription) ? ($subscription->latest_invoice ?? null) : null;
    if (is_object($latestInvoice) && isset($latestInvoice->lines->data) && is_iterable($latestInvoice->lines->data)) {
        foreach ($latestInvoice->lines->data as $lineItem) {
            $lineStart = isset($lineItem->period->start) ? formatStripeTimestampToDb((int) $lineItem->period->start) : '';
            $lineEnd = isset($lineItem->period->end) ? formatStripeTimestampToDb((int) $lineItem->period->end) : '';
            if ($lineStart !== '' && $lineEnd !== '') {
                return [
                    'start' => $lineStart,
                    'end' => $lineEnd,
                ];
            }
        }
    }

    return [
        'start' => $start,
        'end' => $end,
    ];
}

/**
 * Carrega um fixture JSON de evento Stripe.
 *
 * @since 1.0.0
 */
function billingValidationLoadFixture(string $fixturesDir, string $fileName): array
{
    $path = rtrim($fixturesDir, '/\\') . DIRECTORY_SEPARATOR . $fileName;
    if (!is_file($path)) {
        throw new RuntimeException('Fixture Stripe nao encontrado: ' . $path);
    }

    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Fixture Stripe invalido: ' . $path);
    }

    return $decoded;
}

/**
 * Converte um array em objeto recursivo para o servico de webhook.
 *
 * @since 1.0.0
 */
function billingValidationToObject($value)
{
    if (is_array($value)) {
        $isList = array_keys($value) === range(0, count($value) - 1);
        if ($isList) {
            return array_map('billingValidationToObject', $value);
        }

        $object = new stdClass();
        foreach ($value as $key => $item) {
            $object->{$key} = billingValidationToObject($item);
        }

        return $object;
    }

    return $value;
}

/**
 * Monta um evento Stripe a partir do fixture base e do objeto real do gateway.
 *
 * @since 1.0.0
 */
function billingValidationBuildEventFromFixture(
    array $fixture,
    string $eventId,
    int $createdAt,
    string $eventType,
    $eventObject
): object {
    $fixture['id'] = $eventId;
    $fixture['type'] = $eventType;
    $fixture['created'] = $createdAt;
    $fixture['data']['object'] = json_decode(json_encode($eventObject, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), true);

    return billingValidationToObject($fixture);
}

/**
 * Aguarda a renovacao remota aparecer na assinatura da Stripe.
 *
 * @since 1.0.0
 */
function billingValidationWaitForRenewalInvoice($stripe, string $subscriptionId, string $previousInvoiceId, int $timeoutSeconds = 90): object
{
    $deadline = time() + max(10, $timeoutSeconds);

    do {
        $subscription = $stripe->subscriptions->retrieve($subscriptionId, [
            'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'customer', 'default_payment_method'],
        ]);
        $latestInvoice = $subscription->latest_invoice ?? null;
        $latestInvoiceId = is_object($latestInvoice) ? trim((string) ($latestInvoice->id ?? '')) : '';
        $latestStatus = is_object($latestInvoice) ? trim((string) ($latestInvoice->status ?? '')) : '';

        if ($latestInvoiceId !== '' && $latestInvoiceId !== $previousInvoiceId && in_array($latestStatus, ['paid', 'open'], true)) {
            return $subscription;
        }

        usleep(750000);
    } while (time() < $deadline);

    throw new RuntimeException('A renovacao Stripe nao apareceu no tempo esperado.');
}

/**
 * Aguarda uma invoice especifica aparecer como paga no estado remoto da Stripe.
 *
 * @since 1.0.0
 */
function billingValidationWaitForInvoicePaid($stripe, string $subscriptionId, string $invoiceId, int $timeoutSeconds = 60): object
{
    $deadline = time() + max(10, $timeoutSeconds);

    do {
        $subscription = $stripe->subscriptions->retrieve($subscriptionId, [
            'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'customer', 'default_payment_method'],
        ]);
        $latestInvoice = $subscription->latest_invoice ?? null;
        $latestInvoiceId = is_object($latestInvoice) ? trim((string) ($latestInvoice->id ?? '')) : '';
        $latestInvoiceStatus = is_object($latestInvoice) ? trim((string) ($latestInvoice->status ?? '')) : '';

        if ($latestInvoiceId === $invoiceId && $latestInvoiceStatus === 'paid') {
            return $subscription;
        }

        usleep(750000);
    } while (time() < $deadline);

    throw new RuntimeException('A invoice Stripe nao chegou ao status paid no tempo esperado.');
}

/**
 * Limpa os artefatos locais do usuario temporario.
 *
 * @since 1.0.0
 */
function billingValidationCleanupUserArtifacts(PDO $db, string $userId): void
{
    foreach ([
        'DELETE FROM admin_audit_logs WHERE admin_user_id = :user_id',
        'DELETE FROM notifications WHERE user_id = :user_id',
        'DELETE FROM user_feedback WHERE user_id = :user_id',
        'DELETE FROM provider_webhook_events WHERE object_id IN (SELECT provider_subscription_id FROM user_subscriptions WHERE user_id = :user_id)',
        'DELETE FROM transactions WHERE user_id = :user_id',
        'DELETE FROM user_cards WHERE user_id = :user_id',
        'DELETE FROM user_subscriptions WHERE user_id = :user_id',
        'DELETE FROM legal_document_acceptances WHERE user_id = :user_id',
        'DELETE FROM addresses WHERE user_id = :user_id',
        'DELETE FROM users WHERE id = :user_id',
    ] as $sql) {
        $db->prepare($sql)->execute([':user_id' => $userId]);
    }
}

/**
 * Remove planos temporarios criados pela suite.
 *
 * @since 1.0.0
 */
function billingValidationDeletePlans(PDO $db, array $planIds): void
{
    $filtered = array_values(array_unique(array_filter(array_map('intval', $planIds))));
    if ($filtered === []) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($filtered), '?'));
    $db->prepare("DELETE FROM plans WHERE id IN ({$placeholders})")->execute($filtered);
}

/**
 * Cancela uma assinatura Stripe remota quando ela ainda esta ativa.
 *
 * @since 1.0.0
 */
function billingValidationCancelRemoteSubscription($stripe, ?string $subscriptionId): void
{
    $subscriptionId = trim((string) $subscriptionId);
    if ($subscriptionId === '') {
        return;
    }

    try {
        $subscription = $stripe->subscriptions->retrieve($subscriptionId, []);
        if (!empty($subscription->status) && !in_array((string) $subscription->status, ['canceled', 'incomplete_expired'], true)) {
            $stripe->subscriptions->cancel($subscriptionId, []);
        }
    } catch (Throwable $e) {
        error_log('[billing_validation] cleanup subscription warning: ' . $e->getMessage());
    }
}

/**
 * Remove o customer Stripe de teste para reduzir residuos.
 *
 * @since 1.0.0
 */
function billingValidationDeleteRemoteCustomer($stripe, ?string $customerId): void
{
    $customerId = trim((string) $customerId);
    if ($customerId === '') {
        return;
    }

    try {
        $stripe->customers->delete($customerId, []);
    } catch (Throwable $e) {
        error_log('[billing_validation] cleanup customer warning: ' . $e->getMessage());
    }
}

/**
 * Registra um resultado operacional padronizado para o report final.
 *
 * @since 1.0.0
 */
function billingValidationResult(
    string $id,
    string $name,
    string $objective,
    string $method,
    array $evidence,
    array $files,
    string $status,
    string $recommendation,
    array $extra = []
): array {
    return array_merge([
        'id' => $id,
        'name' => $name,
        'objective' => $objective,
        'method' => $method,
        'evidence' => $evidence,
        'files' => $files,
        'status' => $status,
        'result' => $status,
        'recommendation' => $recommendation,
    ], $extra);
}
