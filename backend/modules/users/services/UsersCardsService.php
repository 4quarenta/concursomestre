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

require_once __DIR__ . '/../repositories/UsersRepository.php';
require_once __DIR__ . '/../validators/UsersValidator.php';
require_once __DIR__ . '/UsersCardsStripeSupport.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/stripe.php';

/**
 * Service especializado do cofre de cartoes do usuario.
 * Mantem a regra de billing do perfil fora do controller e do bridge legado.
 *
 * @since 1.0.0
 */
class UsersCardsService
{
    private UsersRepository $repository;
    private UsersValidator $validator;
    private PDO $db;

    /**
     * Injeta dependencias do fluxo de cartoes.
     *
     * @since 1.0.0
     */
    public function __construct(
        UsersRepository $repository,
        UsersValidator $validator,
        PDO $db
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
        $this->db = $db;
    }

    /**
     * Lista os cartoes salvos do usurio no provedor ativo de cofre.
      * @since 1.0.0
     */
    public function listSavedCards(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): array
    {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);
        $customerData = getStripeCustomerForUser($this->db, $targetUserId);
        $cards = syncStripeCardsForUser($this->db, $targetUserId, $customerData['customer_id']);
        $this->repository->updateHasSavedCard($targetUserId, $cards !== []);

        return [
            'cards' => $cards,
            'removed_stale_cards' => 0,
            'provider' => 'stripe',
        ];
    }

    /**
     * Remove um carto salvo respeitando travas de assinatura recorrente.
      * @since 1.0.0
     */
    public function removeSavedCard(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin,
        string $cardId
    ): array {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);
        $card = $this->repository->findUserCardById($targetUserId, $cardId);

        if (!$card) {
            throw new OutOfBoundsException('Carto no encontrado.');
        }

        $totalCards = $this->repository->countUserCards($targetUserId);

        $protectedSubscription = $this->repository->findCardProtectedStripeSubscription($targetUserId);
        $isProtectedByBilling = $this->isCardProtectedByActiveBilling($card, $protectedSubscription);
        if ($protectedSubscription && $totalCards <= 1) {
            throw new DomainException('Este e o unico cartao vinculado a sua assinatura. Adicione outro cartao e defina-o como padrao antes de remover este.');
        }
        if ($isProtectedByBilling) {
            throw new DomainException('Este cartao esta vinculado a uma assinatura recorrente ativa. Defina outro cartao como padrao antes de remove-lo.');
        }

        if (($card['payment_provider'] ?? 'stripe') === 'stripe'
            && !empty($card['stripe_payment_method_id'])
        ) {
            if (!stripeIsConfigured()) {
                throw new RuntimeException('Stripe nao esta configurada. Remocao cancelada.');
            }
            $stripe = getStripeClient();
            try {
                $paymentMethod = $stripe->paymentMethods->retrieve((string) $card['stripe_payment_method_id'], []);
                $remoteCustomerId = getStripeObjectId($paymentMethod->customer ?? null);
                if ($remoteCustomerId !== '') {
                    $expectedCustomerId = trim((string) ($card['provider_customer_id'] ?? ''));
                    if ($expectedCustomerId !== '' && !hash_equals($expectedCustomerId, $remoteCustomerId)) {
                        throw new RuntimeException('O cartao pertence a outro cliente Stripe. Remocao cancelada.');
                    }
                    $stripe->paymentMethods->detach((string) $card['stripe_payment_method_id'], []);
                }
            } catch (Throwable $e) {
                throw new RuntimeException(
                    'Nao foi possivel confirmar a remocao do cartao na Stripe. Nenhum dado local foi removido.',
                    0,
                    $e
                );
            }
        }

        $this->repository->deleteUserCardById($targetUserId, $cardId);

        $remainingCards = $this->repository->countUserCards($targetUserId);
        $this->repository->updateHasSavedCard($targetUserId, $remainingCards > 0);

        if ((int) ($card['is_default'] ?? 0) === 1 && $remainingCards > 0) {
            $nextCardId = $this->repository->findLatestUserCardId($targetUserId);
            if ($nextCardId !== null) {
                $this->repository->clearDefaultCards($targetUserId);
                $this->repository->markUserCardAsDefault($targetUserId, $nextCardId);
            }
        }

        return [
            'message' => 'Carto removido com sucesso!',
        ];
    }

    private function isCardProtectedByActiveBilling(array $card, ?array $subscription): bool
    {
        if (!$subscription) {
            return false;
        }
        if ((int) ($card['locked_by_recurring'] ?? 0) === 1 || (int) ($card['is_default'] ?? 0) === 1) {
            return true;
        }

        $paymentMethodId = trim((string) ($card['stripe_payment_method_id'] ?? ''));
        if ($paymentMethodId === '') {
            return false;
        }
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Nao foi possivel validar o vinculo do cartao porque a Stripe nao esta configurada. Remocao cancelada.');
        }

        try {
            $stripe = getStripeClient();
            $protectedPaymentMethodIds = [];
            $providerSubscriptionId = trim((string) ($subscription['provider_subscription_id'] ?? ''));
            $providerCustomerId = trim((string) ($subscription['provider_customer_id'] ?? ''));
            if ($providerSubscriptionId !== '') {
                $remoteSubscription = $stripe->subscriptions->retrieve($providerSubscriptionId, [
                    'expand' => ['default_payment_method', 'latest_invoice.default_payment_method'],
                ]);
                foreach ([
                    getStripeObjectId($remoteSubscription->default_payment_method ?? null),
                    getStripeObjectId($remoteSubscription->latest_invoice->default_payment_method ?? null),
                ] as $remotePaymentMethodId) {
                    if ($remotePaymentMethodId !== '') {
                        $protectedPaymentMethodIds[] = $remotePaymentMethodId;
                    }
                }
                if ($providerCustomerId === '') {
                    $providerCustomerId = getStripeObjectId($remoteSubscription->customer ?? null);
                }
            }
            if ($providerCustomerId !== '') {
                $customer = $stripe->customers->retrieve($providerCustomerId, []);
                $customerPaymentMethodId = getStripeObjectId($customer->invoice_settings->default_payment_method ?? null);
                if ($customerPaymentMethodId !== '') {
                    $protectedPaymentMethodIds[] = $customerPaymentMethodId;
                }
            }
            return in_array($paymentMethodId, array_unique($protectedPaymentMethodIds), true);
        } catch (Throwable $e) {
            throw new RuntimeException(
                'Nao foi possivel validar o vinculo do cartao com a assinatura na Stripe. Remocao cancelada.',
                0,
                $e
            );
        }
    }

    /**
     * Define o carto padrao do usurio e sincroniza o default no Stripe quando preciso.
      * @since 1.0.0
     */
    public function setDefaultSavedCard(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin,
        string $cardId
    ): array {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);

        try {
            $this->repository->beginTransaction();
            $card = $this->repository->findUserCardById($targetUserId, $cardId);

            if (!$card) {
                throw new OutOfBoundsException('Carto no encontrado.');
            }

            if (($card['payment_provider'] ?? 'stripe') === 'stripe'
                && !empty($card['stripe_payment_method_id'])
                && !empty($card['provider_customer_id'])
                && stripeIsConfigured()
            ) {
                $stripe = getStripeClient();
                $stripe->customers->update((string) $card['provider_customer_id'], [
                    'invoice_settings' => [
                        'default_payment_method' => (string) $card['stripe_payment_method_id'],
                    ],
                ]);
            }

            $this->repository->clearDefaultCards($targetUserId);
            $updatedRows = $this->repository->markUserCardAsDefault($targetUserId, $cardId);

            if ($updatedRows <= 0) {
                throw new OutOfBoundsException('Carto no encontrado ou erro na atualizacao.');
            }

            if (
                ($card['payment_provider'] ?? 'stripe') === 'stripe'
                && !empty($card['stripe_payment_method_id'])
                && $this->repository->hasActiveAutoRenewingSubscription($targetUserId)
            ) {
                setStripeRecurringCardLock($this->db, $targetUserId, (string) $card['stripe_payment_method_id']);
            }

            $this->repository->updateHasSavedCard($targetUserId, true);
            $this->repository->commit();
        } catch (Throwable $e) {
            if ($this->repository->inTransaction()) {
                $this->repository->rollBack();
            }

            throw $e;
        }

        return [
            'message' => 'Carto padrao atualizado com sucesso!',
        ];
    }

    /**
     * Prepara o SetupIntent usado pelo formulrio Stripe para salvar carto.
      * @since 1.0.0
     */
    public function createStripeSetupIntent(string $authenticatedUserId): array
    {
        $this->validator->validateAuthenticatedUserId($authenticatedUserId);

        if (!stripeIsConfigured()) {
            throw new LogicException('Stripe no configurado no backend.');
        }

        $customerData = getStripeCustomerForUser($this->db, $authenticatedUserId);
        $setupIntent = $customerData['stripe']->setupIntents->create([
            'customer' => $customerData['customer_id'],
            'payment_method_types' => ['card'],
            'usage' => 'off_session',
            'metadata' => [
                'user_id' => $authenticatedUserId,
            ],
        ]);

        return [
            'client_secret' => $setupIntent->client_secret,
            'customer_id' => $customerData['customer_id'],
        ];
    }

    /**
     * Sincroniza localmente o payment method Stripe criado pelo SetupIntent.
      * @since 1.0.0
     */
    public function syncStripeCard(string $authenticatedUserId, string $paymentMethodId): array
    {
        $this->validator->validateAuthenticatedUserId($authenticatedUserId);

        if (!stripeIsConfigured()) {
            throw new LogicException('Stripe no configurado no backend.');
        }

        $customerData = getStripeCustomerForUser($this->db, $authenticatedUserId);
        $stripe = $customerData['stripe'];
        $hadSavedCardsBeforeSync = $this->repository->countUserCards($authenticatedUserId) > 0;
        $paymentMethod = $stripe->paymentMethods->retrieve($paymentMethodId, []);

        if (($paymentMethod->customer ?? null) !== $customerData['customer_id']) {
            $paymentMethod = $stripe->paymentMethods->attach($paymentMethodId, [
                'customer' => $customerData['customer_id'],
            ]);
        }

        markStripePaymentMethodAsSaved($stripe, $paymentMethodId, true);

        $customer = $stripe->customers->retrieve($customerData['customer_id'], []);
        $defaultPaymentMethodId = (string) ($customer->invoice_settings->default_payment_method ?? '');
        $shouldPromoteForFutureInvoices = !$hadSavedCardsBeforeSync && $this->hasActiveStripeSubscription($authenticatedUserId);
        $isDefault = $defaultPaymentMethodId === '' || $defaultPaymentMethodId === $paymentMethodId || $shouldPromoteForFutureInvoices;

        if ($isDefault) {
            $stripe->customers->update($customerData['customer_id'], [
                'invoice_settings' => [
                    'default_payment_method' => $paymentMethodId,
                ],
            ]);
        }

        if ($shouldPromoteForFutureInvoices) {
            $this->assignPaymentMethodToActiveStripeSubscriptions($authenticatedUserId, $paymentMethodId, $stripe);
        }

        $localId = upsertLocalStripeCardMirror(
            $this->db,
            $authenticatedUserId,
            $customerData['customer_id'],
            $paymentMethod,
            true
        );
        $cards = syncStripeCardsForUser($this->db, $authenticatedUserId, $customerData['customer_id']);

        return [
            'local_card_id' => $localId,
            'cards' => $cards,
            'message' => 'Carto Stripe sincronizado com sucesso.',
        ];
    }

    /**
     * Verifica se o usuario possui uma assinatura Stripe ativa que ainda exige cobrancas futuras.
     *
     * @since 1.0.0
     */
    private function hasActiveStripeSubscription(string $userId): bool
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM user_subscriptions
            WHERE user_id = :user_id
              AND payment_provider = 'stripe'
              AND status IN ('active', 'trialing', 'past_due')
        ");
        $stmt->execute([
            ':user_id' => $userId,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Garante que o cartao recem salvo abasteca as proximas faturas Stripe da assinatura ativa.
     *
     * @since 1.0.0
     */
    private function assignPaymentMethodToActiveStripeSubscriptions(string $userId, string $paymentMethodId, $stripe): void
    {
        $stmt = $this->db->prepare("
            SELECT provider_subscription_id
            FROM user_subscriptions
            WHERE user_id = :user_id
              AND payment_provider = 'stripe'
              AND status IN ('active', 'trialing', 'past_due')
              AND provider_subscription_id IS NOT NULL
              AND provider_subscription_id <> ''
            ORDER BY id DESC
        ");
        $stmt->execute([
            ':user_id' => $userId,
        ]);

        $subscriptionIds = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        foreach ($subscriptionIds as $subscriptionId) {
            try {
                $stripe->subscriptions->update((string) $subscriptionId, [
                    'default_payment_method' => $paymentMethodId,
                ]);
            } catch (Throwable $error) {
                error_log('Failed to assign saved Stripe card to future invoices: ' . $error->getMessage());
            }
        }
    }

    /**
     * Verifica se a lista atual j possui um carto padrao marcado.
      * @since 1.0.0
     */
    private function hasDefaultCard(array $cards): bool
    {
        foreach ($cards as $card) {
            if ((int) ($card['is_default'] ?? 0) === 1) {
                return true;
            }
        }

        return false;
    }
}
