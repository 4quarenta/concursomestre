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
 * Repositorio do dominio de pagamentos.
 * Centraliza leituras de material/usurio e persistencia da transao local.
 *
 * @since 1.0.0
 */
class PaymentsRepository
{
    private PDO $db;

    /**
     * Injeta a conexao usada pelo checkout, webhook e conciliacao local de pagamentos.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Retorna o material comercializado no checkout.
     *
     * @since 1.0.0
     */
    public function findMaterialById(string $materialId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, title, price, type, author_id, status
            FROM materials
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $materialId]);

        $material = $stmt->fetch(PDO::FETCH_ASSOC);
        return $material ?: null;
    }

    /**
     * Retorna o usurio autenticado usado como fonte de verdade do pagamento.
     *
     * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, name, email, cpf
                 , stripe_account_id
            FROM users
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $userId]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return $user ?: null;
    }

    /**
     * Persiste a conta conectada do vendedor para reuso em novos onboardings.
     *
     * @since 1.0.0
     */
    public function updateUserStripeAccountId(string $userId, string $accountId): void
    {
        $stmt = $this->db->prepare("
            UPDATE users
            SET stripe_account_id = :stripe_account_id
            WHERE id = :id
        ");
        $stmt->execute([
            ':stripe_account_id' => $accountId,
            ':id' => $userId,
        ]);
    }

    /**
     * Le a taxa da plataforma a partir da configurao persistida no painel.
     *
     * @since 1.0.0
     */
    public function getPlatformFeePercent(): float
    {
        return getPlatformFeePercent($this->db);
    }

    /**
     * Evita recompra do mesmo material quando a compra j foi aprovada.
     *
     * @since 1.0.0
     */
    public function hasSuccessfulMaterialPurchase(string $userId, string $materialId): bool
    {
        $stmt = $this->db->prepare("
            SELECT id
            FROM transactions
            WHERE user_id = :user_id
              AND material_id = :material_id
              AND status IN ('approved', 'completed')
            LIMIT 1
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
        ]);

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Busca uma transao local pelo id externo do gateway para manter idempotencia.
     *
     * @since 1.0.0
     */
    public function findTransactionByExternalId(string $externalId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, status, user_id, material_id, external_id, provider_payment_intent_id
            FROM transactions
            WHERE external_id = :external_id
            LIMIT 1
        ");
        $stmt->execute([':external_id' => $externalId]);

        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        return $transaction ?: null;
    }

    /**
     * Localiza uma transao pelo PaymentIntent do Stripe j persistido localmente.
     *
     * @since 1.0.0
     */
    public function findTransactionByProviderPaymentIntentId(string $paymentIntentId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, status, user_id, material_id, external_id, provider_payment_intent_id
            FROM transactions
            WHERE provider_payment_intent_id = :payment_intent_id
            LIMIT 1
        ");
        $stmt->execute([':payment_intent_id' => $paymentIntentId]);

        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        return $transaction ?: null;
    }

    /**
     * Cria a transao local correspondente ao pagamento do material.
     *
     * @since 1.0.0
     */
    public function createMaterialPaymentTransaction(array $payload): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO transactions (
                external_id,
                user_id,
                material_id,
                seller_id,
                amount,
                platform_fee,
                status,
                payment_method,
                payment_provider,
                provider_payment_intent_id,
                provider_customer_id,
                installments,
                payer_email,
                type,
                created_at
            ) VALUES (
                :external_id,
                :user_id,
                :material_id,
                :seller_id,
                :amount,
                :platform_fee,
                :status,
                :payment_method,
                :payment_provider,
                :provider_payment_intent_id,
                :provider_customer_id,
                :installments,
                :payer_email,
                'material',
                NOW()
            )
        ");
        $stmt->execute([
            ':external_id' => $payload['external_id'],
            ':user_id' => $payload['user_id'],
            ':material_id' => $payload['material_id'],
            ':seller_id' => $payload['seller_id'],
            ':amount' => $payload['amount'],
            ':platform_fee' => $payload['platform_fee'],
            ':status' => $payload['status'],
            ':payment_method' => $payload['payment_method'],
            ':payment_provider' => $payload['payment_provider'],
            ':provider_payment_intent_id' => $payload['provider_payment_intent_id'] ?? null,
            ':provider_customer_id' => $payload['provider_customer_id'] ?? null,
            ':installments' => $payload['installments'],
            ':payer_email' => $payload['payer_email'],
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Atualiza a transao local quando o gateway retorna o mesmo pagamento novamente.
     *
     * @since 1.0.0
     */
    public function updateMaterialPaymentTransactionByExternalId(string $externalId, array $payload): void
    {
        $stmt = $this->db->prepare("
            UPDATE transactions
            SET user_id = :user_id,
                material_id = :material_id,
                seller_id = :seller_id,
                amount = :amount,
                platform_fee = :platform_fee,
                status = :status,
                payment_method = :payment_method,
                payment_provider = :payment_provider,
                provider_payment_intent_id = :provider_payment_intent_id,
                provider_customer_id = :provider_customer_id,
                installments = :installments,
                payer_email = :payer_email,
                type = 'material'
            WHERE external_id = :external_id
        ");
        $stmt->execute([
            ':external_id' => $externalId,
            ':user_id' => $payload['user_id'],
            ':material_id' => $payload['material_id'],
            ':seller_id' => $payload['seller_id'],
            ':amount' => $payload['amount'],
            ':platform_fee' => $payload['platform_fee'],
            ':status' => $payload['status'],
            ':payment_method' => $payload['payment_method'],
            ':payment_provider' => $payload['payment_provider'],
            ':provider_payment_intent_id' => $payload['provider_payment_intent_id'] ?? null,
            ':provider_customer_id' => $payload['provider_customer_id'] ?? null,
            ':installments' => $payload['installments'],
            ':payer_email' => $payload['payer_email'],
        ]);
    }

    /**
     * Atualiza a transao j associada a um PaymentIntent do Stripe.
     *
     * @since 1.0.0
     */
    public function updateMaterialPaymentTransactionByProviderPaymentIntentId(string $paymentIntentId, array $payload): void
    {
        $stmt = $this->db->prepare("
            UPDATE transactions
            SET external_id = :external_id,
                user_id = :user_id,
                material_id = :material_id,
                seller_id = :seller_id,
                amount = :amount,
                platform_fee = :platform_fee,
                status = :status,
                payment_method = :payment_method,
                payment_provider = :payment_provider,
                provider_customer_id = :provider_customer_id,
                installments = :installments,
                payer_email = :payer_email,
                type = 'material'
            WHERE provider_payment_intent_id = :provider_payment_intent_id
        ");
        $stmt->execute([
            ':provider_payment_intent_id' => $paymentIntentId,
            ':external_id' => $payload['external_id'],
            ':user_id' => $payload['user_id'],
            ':material_id' => $payload['material_id'],
            ':seller_id' => $payload['seller_id'],
            ':amount' => $payload['amount'],
            ':platform_fee' => $payload['platform_fee'],
            ':status' => $payload['status'],
            ':payment_method' => $payload['payment_method'],
            ':payment_provider' => $payload['payment_provider'],
            ':provider_customer_id' => $payload['provider_customer_id'] ?? null,
            ':installments' => $payload['installments'],
            ':payer_email' => $payload['payer_email'],
        ]);
    }

    /**
     * Reflete a venda no agregado comercial do material.
     *
     * @since 1.0.0
     */
    public function incrementMaterialSalesCount(string $materialId): void
    {
        $stmt = $this->db->prepare('UPDATE materials SET sales_count = sales_count + 1 WHERE id = :id');
        $stmt->execute([':id' => $materialId]);
    }
}
