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

/**
 * Suporte Stripe do dominio de usuarios.
 *
 * Este arquivo concentra a sincronizacao do cofre de cartoes Stripe enquanto
 * os endpoints legados de setup/sync ainda nao foram totalmente absorvidos
 * pelo modulo `users`.
 *
 * Observacao de manutencao:
 * Parte da persistencia local ainda esta aqui por compatibilidade historica.
 * Os proximos slices devem continuar puxando essas queries para o repository.
 *
 * @since 1.0.0
 */

require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/../../../shared/observability/RuntimeMutationEvidence.php';

/**
 * Busca um cartao Stripe local pelo id interno.
 *
 * @since 1.0.0
 */
function getLocalStripeCardById(PDO $db, string $userId, string $cardId): ?array
{
    $stmt = $db->prepare("
        SELECT *
        FROM user_cards
        WHERE id = :card_id
          AND user_id = :user_id
          AND payment_provider = 'stripe'
        LIMIT 1
    ");
    $stmt->execute([
        ':card_id' => $cardId,
        ':user_id' => $userId,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Indexa os cartoes Stripe locais pelo payment method.
 *
 * @since 1.0.0
 */
function getLocalStripeCardsByPaymentMethod(PDO $db, string $userId): array
{
    $stmt = $db->prepare("
        SELECT *
        FROM user_cards
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
          AND stripe_payment_method_id IS NOT NULL
    ");
    $stmt->execute([':user_id' => $userId]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $map = [];
    foreach ($rows as $row) {
        $map[(string) $row['stripe_payment_method_id']] = $row;
    }

    return $map;
}

/**
 * Busca um espelho local pelo mesmo fingerprint operacional do cartao.
 * Reaproveita o registro para evitar duplicar o mesmo cartao quando a Stripe
 * retorna um novo PaymentMethod para a mesma bandeira/final/validade.
 *
 * @since 1.0.0
 */
function findLocalStripeCardMirrorByFingerprint(
    PDO $db,
    string $userId,
    string $brand,
    string $last4,
    int $expMonth,
    int $expYear
): ?array {
    $stmt = $db->prepare("
        SELECT id, stripe_payment_method_id
        FROM user_cards
        WHERE user_id = :user_id
          AND brand = :brand
          AND last_four_digits = :last_four_digits
          AND exp_month = :exp_month
          AND exp_year = :exp_year
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $stmt->execute([
        ':user_id' => $userId,
        ':brand' => $brand,
        ':last_four_digits' => $last4,
        ':exp_month' => $expMonth,
        ':exp_year' => $expYear,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Atualiza (ou converte) um espelho local para Stripe por ID.
 *
 * @since 1.0.0
 */
function updateLocalStripeCardMirrorById(
    PDO $db,
    string $id,
    string $customerId,
    string $paymentMethodId,
    string $brand,
    string $last4,
    int $expMonth,
    int $expYear,
    string $billingName,
    bool $isDefault
): void {
    $db->prepare("
        UPDATE user_cards
        SET payment_provider = 'stripe',
            provider_customer_id = :provider_customer_id,
            stripe_payment_method_id = :stripe_payment_method_id,
            brand = :brand,
            last_four_digits = :last_four_digits,
            exp_month = :exp_month,
            exp_year = :exp_year,
            holder_name = :holder_name,
            is_default = :is_default
        WHERE id = :id
    ")->execute([
        ':provider_customer_id' => $customerId,
        ':stripe_payment_method_id' => $paymentMethodId,
        ':brand' => $brand,
        ':last_four_digits' => $last4,
        ':exp_month' => $expMonth,
        ':exp_year' => $expYear,
        ':holder_name' => $billingName,
        ':is_default' => $isDefault ? 1 : 0,
        ':id' => $id,
    ]);
    RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_state_sync');
}

/**
 * Marca no Stripe se o metodo deve aparecer no cofre local.
 *
 * @since 1.0.0
 */
function markStripePaymentMethodAsSaved($stripe, string $paymentMethodId, bool $saved): void
{
    $paymentMethod = $stripe->paymentMethods->retrieve($paymentMethodId, []);
    $metadata = [];

    if (!empty($paymentMethod->metadata)) {
        foreach ($paymentMethod->metadata as $key => $value) {
            $metadata[(string) $key] = (string) $value;
        }
    }

    $metadata['local_vault_saved'] = $saved ? '1' : '0';

    $stripe->paymentMethods->update($paymentMethodId, [
        'metadata' => $metadata,
    ]);
}

/**
 * Decide se o metodo Stripe deve ser exibido ao usuario.
 *
 * @since 1.0.0
 */
function shouldDisplayStripePaymentMethod($paymentMethod, ?array $localCardRow = null): bool
{
    if (!empty($localCardRow)) {
        return true;
    }

    $savedFlag = (string) (($paymentMethod->metadata->local_vault_saved ?? '') ?: '');
    if ($savedFlag === '0') {
        return false;
    }

    if ($savedFlag === '1') {
        return true;
    }

    return !empty($paymentMethod->customer)
        && StringableIsCardPaymentMethod($paymentMethod);
}

/**
 * Confirma se o payment method Stripe e um cartao valido para exibir no cofre.
 *
 * @since 1.0.0
 */
function StringableIsCardPaymentMethod($paymentMethod): bool
{
    if (empty($paymentMethod->card)) {
        return false;
    }

    $type = strtolower((string) ($paymentMethod->type ?? ''));
    $objectType = strtolower((string) ($paymentMethod->object ?? ''));
    $remoteId = (string) ($paymentMethod->id ?? '');

    return $type === 'card'
        || $objectType === 'payment_method'
        || ($type === '' && isStripePaymentMethodReferenceId($remoteId));
}

/**
 * Detecta se o identificador remoto do cofre Stripe e um PaymentMethod moderno.
 *
 * @since 1.0.0
 */
function isStripePaymentMethodReferenceId(string $remoteId): bool
{
    return str_starts_with($remoteId, 'pm_');
}

/**
 * Detecta se o identificador remoto do cofre Stripe representa um card/source legado.
 *
 * @since 1.0.0
 */
function isStripeSourceCardReferenceId(string $remoteId): bool
{
    return str_starts_with($remoteId, 'card_') || str_starts_with($remoteId, 'src_');
}

/**
 * Normaliza um cartao remoto Stripe, seja PaymentMethod moderno ou source/card legado.
 *
 * @since 1.0.0
 */
function normalizeStripeRemoteCard($remoteCard): ?array
{
    $objectType = strtolower((string) ($remoteCard->object ?? ''));
    $remoteId = (string) ($remoteCard->id ?? '');

    if (
        ($objectType === 'payment_method' || ($objectType === '' && isStripePaymentMethodReferenceId($remoteId)))
        && StringableIsCardPaymentMethod($remoteCard)
    ) {
        return [
            'remote_id' => $remoteId,
            'kind' => 'payment_method',
            'brand' => strtolower((string) ($remoteCard->card->brand ?? 'card')),
            'last4' => (string) ($remoteCard->card->last4 ?? '****'),
            'exp_month' => (int) ($remoteCard->card->exp_month ?? 0),
            'exp_year' => (int) ($remoteCard->card->exp_year ?? 0),
            'holder_name' => trim((string) ($remoteCard->billing_details->name ?? '')),
            'raw' => $remoteCard,
        ];
    }

    if (($objectType === 'card' || $objectType === 'source') && !empty($remoteCard->last4)) {
        return [
            'remote_id' => (string) $remoteCard->id,
            'kind' => 'source',
            'brand' => strtolower((string) ($remoteCard->brand ?? 'card')),
            'last4' => (string) ($remoteCard->last4 ?? '****'),
            'exp_month' => (int) ($remoteCard->exp_month ?? 0),
            'exp_year' => (int) ($remoteCard->exp_year ?? 0),
            'holder_name' => trim((string) (($remoteCard->name ?? $remoteCard->holder_name) ?? '')),
            'raw' => $remoteCard,
        ];
    }

    return null;
}

/**
 * Gera uma assinatura operacional para evitar duplicar o mesmo cartao entre APIs antigas e novas.
 *
 * @since 1.0.0
 */
function buildStripeRemoteCardFingerprint(array $card): string
{
    return implode('|', [
        strtolower((string) ($card['brand'] ?? '')),
        (string) ($card['last4'] ?? ''),
        (string) ($card['exp_month'] ?? ''),
        (string) ($card['exp_year'] ?? ''),
    ]);
}

/**
 * Busca todos os cartoes remotos do customer Stripe, cobrindo PaymentMethods e fallback legado.
 *
 * @since 1.0.0
 */
function fetchStripeCustomerRemoteCards($stripe, string $customerId): array
{
    $remoteCardsById = [];
    $seenFingerprints = [];

    try {
        $paymentMethods = $stripe->customers->allPaymentMethods($customerId, [
            'type' => 'card',
            'limit' => 100,
        ]);

        foreach ($paymentMethods->autoPagingIterator() as $paymentMethod) {
            $normalized = normalizeStripeRemoteCard($paymentMethod);
            if (!$normalized) {
                continue;
            }

            $remoteCardsById[$normalized['remote_id']] = $normalized;
            $seenFingerprints[buildStripeRemoteCardFingerprint($normalized)] = true;
        }
    } catch (Throwable $error) {
        error_log('Stripe customer payment methods sync warning: ' . $error->getMessage());
    }

    try {
        $sources = $stripe->customers->allSources($customerId, [
            'object' => 'card',
            'limit' => 100,
        ]);

        foreach ($sources->autoPagingIterator() as $sourceCard) {
            $normalized = normalizeStripeRemoteCard($sourceCard);
            if (!$normalized) {
                continue;
            }

            $fingerprint = buildStripeRemoteCardFingerprint($normalized);
            if (isset($seenFingerprints[$fingerprint])) {
                continue;
            }

            $remoteCardsById[$normalized['remote_id']] = $normalized;
            $seenFingerprints[$fingerprint] = true;
        }
    } catch (Throwable $error) {
        error_log('Stripe customer legacy card sources sync warning: ' . $error->getMessage());
    }

    return $remoteCardsById;
}

/**
 * Atualiza o cartao padrao local para o payment method informado.
 *
 * @since 1.0.0
 */
function setStripeLocalDefaultCard(PDO $db, string $userId, string $paymentMethodId): void
{
    $db->prepare("
        UPDATE user_cards
        SET is_default = 0
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
    ")->execute([
        ':user_id' => $userId,
    ]);
    RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_default_changed');

    $db->prepare("
        UPDATE user_cards
        SET is_default = 1
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
          AND stripe_payment_method_id = :payment_method_id
    ")->execute([
        ':user_id' => $userId,
        ':payment_method_id' => $paymentMethodId,
    ]);
    RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_default_changed');
}

/**
 * Sincroniza o bloqueio de recorrencia do cartao Stripe ativo.
 *
 * @since 1.0.0
 */
function setStripeRecurringCardLock(PDO $db, string $userId, ?string $paymentMethodId): void
{
    $db->prepare("
        UPDATE user_cards
        SET locked_by_recurring = 0
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
    ")->execute([
        ':user_id' => $userId,
    ]);
    RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_state_sync');

    if (!$paymentMethodId) {
        return;
    }

    $db->prepare("
        UPDATE user_cards
        SET locked_by_recurring = 1
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
          AND stripe_payment_method_id = :payment_method_id
    ")->execute([
        ':user_id' => $userId,
        ':payment_method_id' => $paymentMethodId,
    ]);
    RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_state_sync');
}

/**
 * Monta o endereco do cliente Stripe a partir do perfil.
 *
 * @since 1.0.0
 */
function buildStripeCustomerAddressFromUser(array $user): ?array
{
    $street = trim((string) ($user['street'] ?? ''));
    $number = trim((string) ($user['number'] ?? ''));
    $city = trim((string) ($user['city'] ?? ''));
    $state = trim((string) ($user['state'] ?? ''));
    $zipCode = preg_replace('/\D+/', '', (string) ($user['zip_code'] ?? ''));

    if ($street === '' || $number === '' || $city === '' || $state === '' || $zipCode === '') {
        return null;
    }

    $address = [
        'line1' => trim($street . ', ' . $number),
        'city' => $city,
        'state' => strtoupper($state),
        'postal_code' => $zipCode,
        'country' => 'BR',
    ];

    $complement = trim((string) ($user['complement'] ?? ''));
    if ($complement !== '') {
        $address['line2'] = $complement;
    }

    return $address;
}

/**
 * Monta o payload de cliente Stripe com dados do usuario.
 *
 * @since 1.0.0
 */
function buildStripeCustomerPayloadFromUser(array $user, string $userId): array
{
    $payload = [
        'email' => (string) ($user['email'] ?? ''),
        'name' => (string) ($user['name'] ?? ''),
        'preferred_locales' => ['pt-BR'],
        'metadata' => [
            'user_id' => $userId,
            'billing_country' => 'BR',
        ],
    ];

    $cpf = preg_replace('/\D+/', '', (string) ($user['cpf'] ?? ''));
    if ($cpf !== '') {
        $payload['metadata']['cpf'] = $cpf;
    }

    $address = buildStripeCustomerAddressFromUser($user);
    if ($address) {
        $payload['address'] = $address;
    }

    return $payload;
}

/**
 * Busca o customer Stripe que ancora a assinatura ativa do usuario.
 *
 * Quando o usuario acumula customers duplicados na Stripe, a assinatura ativa
 * e o melhor sinal de qual registro deve continuar canônico para billing e
 * cofre de cartoes.
 *
 * @since 1.0.0
 */
function findStripeSubscriptionBackedCustomerId(PDO $db, string $userId): ?string
{
    $stmt = $db->prepare("
        SELECT provider_customer_id
        FROM user_subscriptions
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
          AND status IN ('active', 'trialing', 'past_due')
          AND provider_customer_id IS NOT NULL
          AND provider_customer_id <> ''
        ORDER BY
            CASE status
                WHEN 'active' THEN 1
                WHEN 'trialing' THEN 2
                WHEN 'past_due' THEN 3
                ELSE 4
            END,
            id DESC
        LIMIT 1
    ");
    $stmt->execute([
        ':user_id' => $userId,
    ]);

    $customerId = $stmt->fetchColumn();
    return $customerId ? (string) $customerId : null;
}

/**
 * Persiste o customer Stripe canônico do usuario.
 *
 * @since 1.0.0
 */
function persistStripeCustomerIdForUser(PDO $db, string $userId, string $customerId): void
{
    $db->prepare("
        UPDATE users
        SET stripe_customer_id = :stripe_customer_id
        WHERE id = :user_id
    ")->execute([
        ':stripe_customer_id' => $customerId,
        ':user_id' => $userId,
    ]);
}

/**
 * Busca customers Stripe já referenciados localmente pelo usuario.
 *
 * Isso cobre ciclos sem assinatura ativa, mas com historico de checkout,
 * transacoes ou subscriptions anteriores que já apontavam para um customer
 * válido. A ideia é reutilizar o mesmo `customer_id` sempre que possível.
 *
 * @since 1.0.0
 */
function findStripeCustomerIdFromLocalProviderHistory(PDO $db, string $userId): ?string
{
    $candidates = [];

    $subscriptionStmt = $db->prepare("
        SELECT provider_customer_id
        FROM user_subscriptions
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
          AND provider_customer_id IS NOT NULL
          AND provider_customer_id <> ''
        ORDER BY
            CASE status
                WHEN 'active' THEN 1
                WHEN 'trialing' THEN 2
                WHEN 'past_due' THEN 3
                ELSE 4
            END,
            id DESC
    ");
    $subscriptionStmt->execute([
        ':user_id' => $userId,
    ]);

    foreach ($subscriptionStmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $customerId) {
        $customerId = trim((string) $customerId);
        if ($customerId !== '' && !in_array($customerId, $candidates, true)) {
            $candidates[] = $customerId;
        }
    }

    $transactionsStmt = $db->prepare("
        SELECT provider_customer_id
        FROM transactions
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
          AND provider_customer_id IS NOT NULL
          AND provider_customer_id <> ''
        ORDER BY id DESC
    ");
    $transactionsStmt->execute([
        ':user_id' => $userId,
    ]);

    foreach ($transactionsStmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $customerId) {
        $customerId = trim((string) $customerId);
        if ($customerId !== '' && !in_array($customerId, $candidates, true)) {
            $candidates[] = $customerId;
        }
    }

    return $candidates[0] ?? null;
}

/**
 * Tenta reservar um lock lógico por usuario durante a resolucao do customer Stripe.
 *
 * Em MySQL usamos GET_LOCK para evitar que duas requisicoes concorrentes criem
 * customers distintos para o mesmo usuario antes que `users.stripe_customer_id`
 * seja persistido.
 *
 * @since 1.0.0
 */
function acquireStripeCustomerResolutionLock(PDO $db, string $userId): ?string
{
    $driver = strtolower((string) $db->getAttribute(PDO::ATTR_DRIVER_NAME));
    if ($driver !== 'mysql') {
        return null;
    }

    $lockName = 'stripe_customer_user_' . $userId;
    $stmt = $db->prepare('SELECT GET_LOCK(:lock_name, 10)');
    $stmt->execute([
        ':lock_name' => $lockName,
    ]);

    $acquired = (int) $stmt->fetchColumn() === 1;
    return $acquired ? $lockName : null;
}

/**
 * Libera o lock de resolucao do customer Stripe quando aplicavel.
 *
 * @since 1.0.0
 */
function releaseStripeCustomerResolutionLock(PDO $db, ?string $lockName): void
{
    if (!$lockName) {
        return;
    }

    try {
        $stmt = $db->prepare('SELECT RELEASE_LOCK(:lock_name)');
        $stmt->execute([
            ':lock_name' => $lockName,
        ]);
    } catch (Throwable $e) {
        error_log('Stripe customer lock release warning: ' . $e->getMessage());
    }
}

/**
 * Carrega o snapshot do usuario usado para resolver o customer Stripe.
 *
 * @since 1.0.0
 */
function loadStripeCustomerUserSnapshot(PDO $db, string $userId): ?array
{
    $stmt = $db->prepare("
        SELECT
            u.id,
            u.email,
            u.name,
            u.cpf,
            u.email_verified,
            u.stripe_customer_id,
            a.zip_code,
            a.street,
            a.number,
            a.complement,
            a.neighborhood,
            a.city,
            a.state
        FROM users u
        LEFT JOIN addresses a ON a.user_id = u.id
        WHERE u.id = :user_id
        LIMIT 1
    ");
    $stmt->execute([':user_id' => $userId]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    return $user ?: null;
}

/**
 * Procura um customer Stripe existente para o usuario antes de criar outro.
 *
 * A documentacao da Stripe recomenda evitar customers duplicados porque isso
 * fragmenta historico e payment methods. Aqui preferimos customers com o mesmo
 * `metadata.user_id` e, na falta disso, caimos para o email do usuario.
 *
 * @since 1.0.0
 */
function findExistingStripeCustomerForUser($stripe, string $userId, string $email, ?string $storedCustomerId = null): ?string
{
    $email = trim($email);
    $candidates = [];

    if ($storedCustomerId) {
        $candidates[$storedCustomerId] = [
            'id' => $storedCustomerId,
            'score' => 25,
        ];
    }

    if ($email !== '') {
        try {
            $customerList = $stripe->customers->all([
                'email' => $email,
                'limit' => 100,
            ]);

            foreach ($customerList->autoPagingIterator() as $customer) {
                if (!empty($customer->deleted) || empty($customer->id)) {
                    continue;
                }

                $candidateId = (string) $customer->id;
                $metadataUserId = (string) (($customer->metadata->user_id ?? '') ?: '');
                $score = 0;

                if ($metadataUserId !== '' && $metadataUserId === $userId) {
                    $score += 100;
                }

                if (((string) ($customer->email ?? '')) === $email) {
                    $score += 10;
                }

                if (!empty($customer->invoice_settings->default_payment_method) || !empty($customer->default_source)) {
                    $score += 5;
                }

                if (isset($candidates[$candidateId])) {
                    $candidates[$candidateId]['score'] = max($candidates[$candidateId]['score'], $score);
                } else {
                    $candidates[$candidateId] = [
                        'id' => $candidateId,
                        'score' => $score,
                    ];
                }
            }
        } catch (Throwable $e) {
            error_log('Stripe existing customer lookup warning: ' . $e->getMessage());
        }
    }

    if ($candidates === []) {
        return null;
    }

    uasort($candidates, static function (array $left, array $right): int {
        return ($right['score'] <=> $left['score']) ?: strcmp((string) $right['id'], (string) $left['id']);
    });

    $best = reset($candidates);
    return !empty($best['id']) ? (string) $best['id'] : null;
}

/**
 * Monta billing details Stripe para anexar ao cartao.
 *
 * @since 1.0.0
 */
function buildStripeBillingDetailsFromUser(array $user): array
{
    $billingDetails = [];

    $name = trim((string) ($user['name'] ?? ''));
    if ($name !== '') {
        $billingDetails['name'] = $name;
    }

    $email = trim((string) ($user['email'] ?? ''));
    if ($email !== '') {
        $billingDetails['email'] = $email;
    }

    $address = buildStripeCustomerAddressFromUser($user);
    if ($address) {
        $billingDetails['address'] = $address;
    }

    return $billingDetails;
}

/**
 * Atualiza billing details remotos do payment method.
 *
 * @since 1.0.0
 */
function syncStripePaymentMethodBillingDetails($stripe, string $paymentMethodId, array $user): void
{
    $paymentMethodId = trim($paymentMethodId);
    if ($paymentMethodId === '') {
        return;
    }

    $billingDetails = buildStripeBillingDetailsFromUser($user);
    if ($billingDetails === []) {
        return;
    }

    try {
        $stripe->paymentMethods->update($paymentMethodId, [
            'billing_details' => $billingDetails,
            'metadata' => [
                'billing_country' => 'BR',
                'payer_cpf' => preg_replace('/\D+/', '', (string) ($user['cpf'] ?? '')),
            ],
        ]);
    } catch (Throwable $e) {
        error_log('Stripe payment method billing details sync warning: ' . $e->getMessage());
    }
}

/**
 * Valida dados minimos exigidos para checkout Stripe.
 *
 * @since 1.0.0
 */
function getStripeCheckoutRequirementErrors(array $user): array
{
    $missing = [];

    $requiredFields = [
        'name' => (string) ($user['name'] ?? ''),
        'cpf' => (string) ($user['cpf'] ?? ''),
        'zip_code' => (string) ($user['zip_code'] ?? ''),
        'street' => (string) ($user['street'] ?? ''),
        'number' => (string) ($user['number'] ?? ''),
        'neighborhood' => (string) ($user['neighborhood'] ?? ''),
        'city' => (string) ($user['city'] ?? ''),
        'state' => (string) ($user['state'] ?? ''),
    ];

    foreach ($requiredFields as $field => $value) {
        if (trim($value) === '') {
            $missing[] = $field;
        }
    }

    if (empty($user['email_verified'])) {
        $missing[] = 'email_verified';
    }

    return $missing;
}

/**
 * Resolve ou cria o customer Stripe do usuario.
 *
 * @since 1.0.0
 */
function getStripeCustomerForUser(PDO $db, string $userId): array
{
    $lockName = acquireStripeCustomerResolutionLock($db, $userId);

    try {
        $user = loadStripeCustomerUserSnapshot($db, $userId);

        if (!$user) {
            throw new RuntimeException('Usurio no encontrado.');
        }

        $stripe = getStripeClient();
        $storedCustomerId = !empty($user['stripe_customer_id']) ? (string) $user['stripe_customer_id'] : null;
        $subscriptionCustomerId = findStripeSubscriptionBackedCustomerId($db, $userId);
        $historyCustomerId = findStripeCustomerIdFromLocalProviderHistory($db, $userId);
        $customerId = $subscriptionCustomerId ?: ($storedCustomerId ?: $historyCustomerId);
        $customerPayload = buildStripeCustomerPayloadFromUser($user, $userId);

        if (!empty($customerId)) {
            try {
                $customer = $stripe->customers->retrieve($customerId, []);
                if (!$customer || !empty($customer->deleted)) {
                    $customerId = null;
                } else {
                    $stripe->customers->update($customerId, $customerPayload);
                }
            } catch (Throwable $e) {
                $customerId = null;
            }
        }

        if (empty($customerId)) {
            $customerId = findExistingStripeCustomerForUser(
                $stripe,
                $userId,
                (string) ($user['email'] ?? ''),
                $storedCustomerId ?: $historyCustomerId
            );

            if (!empty($customerId)) {
                try {
                    $stripe->customers->update($customerId, $customerPayload);
                } catch (Throwable $e) {
                    error_log('Stripe customer refresh warning: ' . $e->getMessage());
                }
            }
        }

        if (empty($customerId)) {
            $customer = $stripe->customers->create($customerPayload);
            $customerId = $customer->id;
        }

        if ((string) ($user['stripe_customer_id'] ?? '') !== (string) $customerId) {
            persistStripeCustomerIdForUser($db, $userId, (string) $customerId);
        }

        return [
            'user' => $user,
            'customer_id' => $customerId,
            'stripe' => $stripe,
        ];
    } finally {
        releaseStripeCustomerResolutionLock($db, $lockName);
    }
}

/**
 * Espelha localmente um payment method Stripe salvo.
 *
 * @since 1.0.0
 */
function upsertLocalStripeCardMirror(
    PDO $db,
    string $userId,
    string $customerId,
    $remoteCard,
    bool $isDefault = false,
    string $runtimeEvent = 'profile_billing_card_sync'
): string
{
    ensurePaymentProviderSchema($db);

    $normalizedCard = normalizeStripeRemoteCard($remoteCard);
    if (!$normalizedCard) {
        throw new InvalidArgumentException('Cartao Stripe invalido para sincronizacao.');
    }

    $remoteId = (string) $normalizedCard['remote_id'];
    $billingName = (string) $normalizedCard['holder_name'];
    $brand = (string) $normalizedCard['brand'];
    $last4 = (string) $normalizedCard['last4'];
    $expMonth = (int) $normalizedCard['exp_month'];
    $expYear = (int) $normalizedCard['exp_year'];

    $existingStmt = $db->prepare("
        SELECT id
        FROM user_cards
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
          AND stripe_payment_method_id = :stripe_payment_method_id
        LIMIT 1
    ");
    $existingStmt->execute([
        ':user_id' => $userId,
        ':stripe_payment_method_id' => $remoteId,
    ]);
    $existingId = $existingStmt->fetchColumn();

    if (!$existingId) {
        $fingerprintMatch = findLocalStripeCardMirrorByFingerprint(
            $db,
            $userId,
            $brand,
            $last4,
            $expMonth,
            $expYear
        );

        if ($fingerprintMatch) {
            $existingId = (string) $fingerprintMatch['id'];
        }
    }

    if ($isDefault) {
        $db->prepare("UPDATE user_cards SET is_default = 0 WHERE user_id = :user_id AND payment_provider = 'stripe'")
            ->execute([':user_id' => $userId]);
        RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_default_changed');
    }

    if ($existingId) {
        updateLocalStripeCardMirrorById(
            $db,
            (string) $existingId,
            $customerId,
            $remoteId,
            $brand,
            $last4,
            $expMonth,
            $expYear,
            $billingName,
            $isDefault
        );
        RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', $runtimeEvent);

        return (string) $existingId;
    }

    $id = bin2hex(random_bytes(16));
    try {
        $db->prepare("
            INSERT INTO user_cards (
                id, user_id, payment_provider, mp_card_id, stripe_payment_method_id, mp_customer_id, provider_customer_id,
                brand, last_four_digits, exp_month, exp_year, holder_name, is_default, locked_by_recurring
            ) VALUES (
                :id, :user_id, 'stripe', :mp_card_id, :stripe_payment_method_id, NULL, :provider_customer_id,
                :brand, :last_four_digits, :exp_month, :exp_year, :holder_name, :is_default, 0
            )
        ")->execute([
            ':id' => $id,
            ':user_id' => $userId,
            ':mp_card_id' => '',
            ':stripe_payment_method_id' => $remoteId,
            ':provider_customer_id' => $customerId,
            ':brand' => $brand,
            ':last_four_digits' => $last4,
            ':exp_month' => $expMonth,
            ':exp_year' => $expYear,
            ':holder_name' => $billingName,
            ':is_default' => $isDefault ? 1 : 0,
        ]);
    } catch (PDOException $e) {
        $isDuplicateKey = ((string) $e->getCode() === '23000')
            || (strpos((string) $e->getMessage(), 'Duplicate entry') !== false);

        if (!$isDuplicateKey) {
            throw $e;
        }

        $fingerprintMatch = findLocalStripeCardMirrorByFingerprint(
            $db,
            $userId,
            $brand,
            $last4,
            $expMonth,
            $expYear
        );

        if (!$fingerprintMatch) {
            throw $e;
        }

        $fallbackId = (string) $fingerprintMatch['id'];
        updateLocalStripeCardMirrorById(
            $db,
            $fallbackId,
            $customerId,
            $remoteId,
            $brand,
            $last4,
            $expMonth,
            $expYear,
            $billingName,
            $isDefault
        );
        RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', $runtimeEvent);

        return $fallbackId;
    }

    RuntimeMutationEvidence::record('user_cards', 'INSERT', 'http-auth-account', $runtimeEvent, 1);

    return $id;
}

/**
 * Sincroniza o cofre local com os cartoes ativos do Stripe.
 *
 * @since 1.0.0
 */
function syncStripeCardsForUser(PDO $db, string $userId, string $customerId): array
{
    $stripe = getStripeClient();
    $customer = $stripe->customers->retrieve($customerId, []);
    $defaultPaymentMethodId = (string) ($customer->invoice_settings->default_payment_method ?? '');
    $defaultSourceId = (string) ($customer->default_source ?? '');
    $remoteCards = fetchStripeCustomerRemoteCards($stripe, $customerId);

    $existingLocalCards = getLocalStripeCardsByPaymentMethod($db, $userId);
    $includedRemoteCards = [];

    foreach ($remoteCards as $remoteId => $remoteCard) {
        $localRow = $existingLocalCards[$remoteId] ?? null;

        if (
            ($remoteCard['kind'] ?? '') === 'payment_method'
            && !shouldDisplayStripePaymentMethod($remoteCard['raw'], $localRow)
        ) {
            continue;
        }

        $isDefault = $defaultPaymentMethodId !== ''
            ? $remoteId === $defaultPaymentMethodId
            : ($defaultSourceId !== '' && $remoteId === $defaultSourceId);

        upsertLocalStripeCardMirror($db, $userId, $customerId, $remoteCard['raw'], $isDefault);
        $includedRemoteCards[$remoteId] = $remoteCard;
    }

    if (empty($includedRemoteCards)) {
        $delete = $db->prepare("
            DELETE FROM user_cards
            WHERE user_id = :user_id
              AND payment_provider = 'stripe'
        ");
        $delete->execute([':user_id' => $userId]);
        if ($delete->rowCount() > 0) {
            RuntimeMutationEvidence::record(
                'user_cards',
                'DELETE',
                'http-auth-account',
                'profile_billing_card_sync',
                -$delete->rowCount()
            );
        }
    } else {
        $keepIds = array_keys($includedRemoteCards);
        $placeholders = implode(',', array_fill(0, count($keepIds), '?'));
        $params = array_merge([$userId], $keepIds);
        $stmt = $db->prepare("
            DELETE FROM user_cards
            WHERE user_id = ?
              AND payment_provider = 'stripe'
              AND stripe_payment_method_id IS NOT NULL
              AND stripe_payment_method_id NOT IN ({$placeholders})
        ");
        $stmt->execute($params);
        if ($stmt->rowCount() > 0) {
            RuntimeMutationEvidence::record(
                'user_cards',
                'DELETE',
                'http-auth-account',
                'profile_billing_card_sync',
                -$stmt->rowCount()
            );
        }
    }

    $cardsStmt = $db->prepare("
        SELECT id, payment_provider, stripe_payment_method_id, provider_customer_id, brand, last_four_digits,
               exp_month, exp_year, holder_name, is_default, locked_by_recurring
        FROM user_cards
        WHERE user_id = :user_id
          AND payment_provider = 'stripe'
        ORDER BY is_default DESC, created_at DESC
    ");
    $cardsStmt->execute([':user_id' => $userId]);
    $localCards = $cardsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $cards = [];
    foreach ($localCards as $localCard) {
        $remoteId = (string) ($localCard['stripe_payment_method_id'] ?? '');
        $remoteCard = $includedRemoteCards[$remoteId] ?? null;
        if (!$remoteCard) {
            continue;
        }

        $cards[] = [
            'id' => (string) $localCard['id'],
            'payment_provider' => 'stripe',
            'stripe_payment_method_id' => $remoteId,
            'provider_customer_id' => (string) $localCard['provider_customer_id'],
            'brand' => strtolower((string) ($localCard['brand'] ?? ($remoteCard['brand'] ?? 'card'))),
            'last_four_digits' => (string) ($localCard['last_four_digits'] ?? ($remoteCard['last4'] ?? '****')),
            'exp_month' => (int) ($localCard['exp_month'] ?? ($remoteCard['exp_month'] ?? 0)),
            'exp_year' => (int) ($localCard['exp_year'] ?? ($remoteCard['exp_year'] ?? 0)),
            'holder_name' => (string) ($localCard['holder_name'] ?? ($remoteCard['holder_name'] ?? '')),
            'is_default' => (int) ($localCard['is_default'] ?? 0),
            'locked_by_recurring' => (int) ($localCard['locked_by_recurring'] ?? 0),
            'payment_method_id' => 'card',
        ];
    }

    $db->prepare("UPDATE users SET has_saved_card = :has_saved_card WHERE id = :user_id")
        ->execute([
            ':has_saved_card' => !empty($cards) ? 1 : 0,
            ':user_id' => $userId,
        ]);

    return $cards;
}
