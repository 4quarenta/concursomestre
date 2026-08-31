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

require_once __DIR__ . '/../../../shared/observability/RuntimeMutationEvidence.php';

/**
 * Repositorio do dominio de assinaturas para operacoes de portal e renovacao.
 */
class SubscriptionsRepository
{
    private const WEBHOOK_PROCESSING_RETRY_AFTER_SECONDS = 900;

    private PDO $db;

    /**
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Busca dados basicos do usuario usados no portal.
     *
     * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT id, name, email, stripe_customer_id, has_saved_card FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Busca usuario vinculado a um customer Stripe.
     *
     * @since 1.0.0
     */
    public function findUserByStripeCustomerId(string $providerCustomerId): ?array
    {
        $providerCustomerId = trim($providerCustomerId);
        if ($providerCustomerId === '') {
            return null;
        }

        $stmt = $this->db->prepare('
            SELECT id, name, email, stripe_customer_id, has_saved_card
            FROM users
            WHERE stripe_customer_id = :stripe_customer_id
            LIMIT 1
        ');
        $stmt->execute([':stripe_customer_id' => $providerCustomerId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Busca usuario pelo e-mail informado pela Stripe quando metadata antiga
     * nao contem um user_id local confiavel.
     *
     * @since 1.0.0
     */
    public function findUserByEmail(string $email): ?array
    {
        $email = strtolower(trim($email));
        if ($email === '') {
            return null;
        }

        $stmt = $this->db->prepare('
            SELECT id, name, email, stripe_customer_id, has_saved_card
            FROM users
            WHERE LOWER(email) = :email
            LIMIT 1
        ');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Busca o plano alvo usado no checkout de assinatura.
     *
     * @since 1.0.0
     */
    public function findPlanById(int $planId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT *
            FROM plans
            WHERE id = :plan_id
            LIMIT 1
        ");
        $stmt->execute([':plan_id' => $planId]);
        $plan = $stmt->fetch(PDO::FETCH_ASSOC);

        return $plan ?: null;
    }

    public function findCurrentPlanForUser(string $userId): ?array
    {
        $userId = trim($userId);
        if ($userId === '') {
            return null;
        }

        $stmt = $this->db->prepare("
            SELECT p.*
            FROM users u
            JOIN plans p ON p.id = u.current_plan_id
            WHERE u.id = :user_id
            LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);
        $plan = $stmt->fetch(PDO::FETCH_ASSOC);

        return $plan ?: null;
    }

    /**
     * Busca plano Stripe por price ou product id quando metadata vier incompleta.
     *
     * @since 1.0.0
     */
    public function findPlanByStripePriceOrProduct(string $stripePriceId = '', string $stripeProductId = ''): ?array
    {
        $stripePriceId = trim($stripePriceId);
        $stripeProductId = trim($stripeProductId);
        if ($stripePriceId === '' && $stripeProductId === '') {
            return null;
        }

        $stmt = $this->db->prepare("
            SELECT *
            FROM plans
            WHERE (:stripe_price_id <> '' AND stripe_price_id = :stripe_price_id)
               OR (:stripe_product_id <> '' AND stripe_product_id = :stripe_product_id)
            ORDER BY COALESCE(is_active, active, 1) DESC, id DESC
            LIMIT 1
        ");
        $stmt->execute([
            ':stripe_price_id' => $stripePriceId,
            ':stripe_product_id' => $stripeProductId,
        ]);
        $plan = $stmt->fetch(PDO::FETCH_ASSOC);

        return $plan ?: null;
    }

    /**
     * Busca plano pelo nome comercial e, quando possivel, pelo ciclo.
     *
     * Usado como fallback para webhooks Stripe antigos que carregam um plan_id
     * local que ja nao existe mais, mas ainda preservam plan_name e intervalo.
     *
     * @since 1.0.0
     */
    public function findPlanByNameAndCycle(string $planName, string $intervalUnit = '', int $intervalCount = 0): ?array
    {
        $planName = trim($planName);
        if ($planName === '') {
            return null;
        }

        $intervalUnit = strtolower(trim($intervalUnit));
        $intervalCount = max(0, $intervalCount);

        $stmt = $this->db->prepare("
            SELECT *
            FROM plans
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(:plan_name))
            ORDER BY
                CASE
                    WHEN :interval_unit <> ''
                     AND interval_unit = :interval_unit
                     AND interval_count = :interval_count THEN 0
                    ELSE 1
                END,
                COALESCE(is_active, active, 1) DESC,
                id DESC
            LIMIT 1
        ");
        $stmt->execute([
            ':plan_name' => $planName,
            ':interval_unit' => $intervalUnit,
            ':interval_count' => $intervalCount,
        ]);
        $plan = $stmt->fetch(PDO::FETCH_ASSOC);

        return $plan ?: null;
    }

    /**
     * Busca plano ativo pelo valor recorrente e ciclo da cobranca Stripe.
     *
     * Este fallback cobre webhooks antigos ou manuais em que a Stripe nao
     * devolve metadata suficiente para localizar o plan_id local, mas o Price
     * da assinatura ainda carrega amount/interval.
     *
     * @since 1.0.0
     */
    public function findPlanByRecurringAmountAndCycle(float $amount, string $intervalUnit = '', int $intervalCount = 0): ?array
    {
        $amount = round(max(0, $amount), 2);
        if ($amount <= 0) {
            return null;
        }

        $intervalUnit = strtolower(trim($intervalUnit));
        $intervalCount = max(0, $intervalCount);

        $stmt = $this->db->prepare("
            SELECT *
            FROM plans
            WHERE ROUND(COALESCE(price, 0), 2) = :amount
            ORDER BY
                CASE
                    WHEN :interval_unit <> ''
                     AND interval_unit = :interval_unit
                     AND interval_count = :interval_count THEN 0
                    ELSE 1
                END,
                COALESCE(is_active, active, 1) DESC,
                id DESC
            LIMIT 1
        ");
        $stmt->execute([
            ':amount' => $amount,
            ':interval_unit' => $intervalUnit,
            ':interval_count' => $intervalCount,
        ]);
        $plan = $stmt->fetch(PDO::FETCH_ASSOC);

        return $plan ?: null;
    }

    /**
     * Busca o perfil completo exigido pelos fluxos Stripe.
     *
     * @since 1.0.0
     */
    public function findStripeCheckoutUser(string $userId): ?array
    {
        $stmt = $this->db->prepare("
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
     * Localiza a ultima assinatura ativa gerenciada localmente.
     *
     * @since 1.0.0
     */
    public function findLatestManagedSubscription(string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                us.*,
                p.name AS plan_name,
                p.price,
                p.interval_unit,
                p.interval_count,
                p.tier,
                p.stripe_product_id
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE user_id = :user_id
              AND status IN ('active', 'trialing', 'past_due')
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);
        $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

        return $subscription ?: null;
    }

    /**
     * Busca a assinatura Stripe mais recente do usuario, incluindo linhas canceladas.
     *
     * @since 1.0.0
     */
    public function findLatestStripeSubscriptionForUser(string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price, p.interval_unit, p.interval_count, p.stripe_product_id
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE us.user_id = :user_id
              AND us.payment_provider = 'stripe'
              AND COALESCE(us.provider_subscription_id, '') <> ''
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);
        $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

        return $subscription ?: null;
    }

    /**
     * Localiza a assinatura Stripe pendente/sincronizada pelo provider id.
     *
     * @since 1.0.0
     */
    public function findStripeSubscriptionForUser(string $userId, string $subscriptionId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price, p.interval_unit, p.interval_count, p.stripe_product_id
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE us.user_id = :user_id
              AND us.provider_subscription_id = :provider_subscription_id
            LIMIT 1
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':provider_subscription_id' => $subscriptionId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Busca assinatura Stripe por id de provedor.
     *
     * @since 1.0.0
     */
    public function findStripeSubscriptionByProviderId(string $providerSubscriptionId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price, p.interval_unit, p.interval_count, p.stripe_product_id
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE us.provider_subscription_id = :provider_subscription_id
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([
            ':provider_subscription_id' => $providerSubscriptionId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Localiza outra assinatura vigente para impedir que o cancelamento de um
     * contrato antigo revogue o plano atual do usuario.
     *
     * @since 1.0.0
     */
    public function findOtherActiveSubscriptionForUser(string $userId, int $excludeSubscriptionId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price, p.interval_unit, p.interval_count, p.stripe_product_id
            FROM user_subscriptions us
            JOIN plans p ON p.id = us.plan_id
            WHERE us.user_id = :user_id
              AND us.id <> :exclude_id
              AND us.status IN ('active', 'trialing')
              AND (us.current_period_end IS NULL OR us.current_period_end >= NOW())
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':exclude_id' => $excludeSubscriptionId,
        ]);

        $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
        return $subscription ?: null;
    }

    /**
     * Busca a assinatura Stripe local mais recente pelo customer id do Stripe.
     *
     * @since 1.0.0
     */
    public function findLatestStripeSubscriptionByCustomerId(string $providerCustomerId): ?array
    {
        $providerCustomerId = trim($providerCustomerId);
        if ($providerCustomerId === '') {
            return null;
        }

        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price, p.interval_unit, p.interval_count, p.stripe_product_id
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE us.payment_provider = 'stripe'
              AND us.provider_customer_id = :provider_customer_id
            ORDER BY
              CASE WHEN us.status IN ('active', 'trialing', 'past_due', 'incomplete') THEN 0 ELSE 1 END,
              us.id DESC
            LIMIT 1
        ");
        $stmt->execute([
            ':provider_customer_id' => $providerCustomerId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Recupera a ultima assinatura usada pelo portal do cliente.
     *
     * @since 1.0.0
     */
    public function findLatestPortalSubscription(string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT u.stripe_customer_id, us.provider_subscription_id, us.payment_provider
            FROM users u
            LEFT JOIN user_subscriptions us
              ON us.user_id = u.id
             AND us.status IN ('active', 'trialing', 'past_due', 'canceled')
            WHERE u.id = :user_id
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Persiste um evento Stripe cuja assinatura ja foi validada pela camada de servico.
     * A chave unica (provider, event_id) torna entregas repetidas idempotentes.
     */
    public function enqueueStripeWebhookEvent(array $event): array
    {
        $eventId = trim((string) ($event['event_id'] ?? ''));
        $eventType = trim((string) ($event['event_type'] ?? ''));
        $payloadHash = trim((string) ($event['payload_hash'] ?? ''));
        $payloadJson = (string) ($event['payload_json'] ?? '');
        if ($eventId === '' || $eventType === '' || $payloadHash === '' || $payloadJson === '') {
            throw new InvalidArgumentException('Evento Stripe incompleto para enfileiramento.');
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "SELECT id, event_type, object_id, payload_hash, status
                 FROM provider_webhook_events
                 WHERE provider = 'stripe' AND event_id = :event_id
                 LIMIT 1 FOR UPDATE"
            );
            $stmt->execute([':event_id' => $eventId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if (is_array($existing)) {
                $integrityMismatch = !hash_equals((string) ($existing['payload_hash'] ?? ''), $payloadHash)
                    || (string) ($existing['event_type'] ?? '') !== $eventType
                    || ((string) ($existing['object_id'] ?? '') !== ''
                        && (string) ($event['object_id'] ?? '') !== ''
                        && (string) $existing['object_id'] !== (string) $event['object_id']);
                if ($integrityMismatch) {
                    $this->db->prepare(
                        "UPDATE provider_webhook_events
                         SET status = 'integrity_error', dead_lettered_at = COALESCE(dead_lettered_at, NOW()),
                             last_error_code = 'PAYLOAD_INTEGRITY_MISMATCH',
                             error_message = 'Mesmo event_id recebido com payload divergente.',
                             delivery_count = delivery_count + 1, last_received_at = NOW()
                         WHERE id = :id"
                    )->execute([':id' => $existing['id']]);
                    $this->db->commit();
                    throw new DomainException('Integridade do webhook Stripe violada.');
                }

                $status = strtolower((string) ($existing['status'] ?? ''));
                $this->db->prepare(
                    'UPDATE provider_webhook_events
                     SET delivery_count = delivery_count + 1, last_received_at = NOW()
                     WHERE id = :id'
                )->execute([':id' => $existing['id']]);
                $this->db->commit();
                return [
                    'queued' => false,
                    'duplicate' => true,
                    'terminal' => in_array($status, ['processed', 'ignored', 'dead_lettered', 'integrity_error'], true),
                    'status' => $status,
                    'eventId' => $eventId,
                ];
            }

            $insert = $this->db->prepare(
                "INSERT INTO provider_webhook_events (
                    provider, event_id, event_type, object_id, payload_hash, payload_json,
                    signature_verified_at, queued_at, status, event_created_at,
                    first_received_at, last_received_at, attempt_count, delivery_count
                 ) VALUES (
                    'stripe', :event_id, :event_type, :object_id, :payload_hash, :payload_json,
                    NOW(), NOW(), 'queued', :event_created_at,
                    NOW(), NOW(), 0, 1
                 )"
            );
            $insert->execute([
                ':event_id' => $eventId,
                ':event_type' => $eventType,
                ':object_id' => $event['object_id'] ?? null,
                ':payload_hash' => $payloadHash,
                ':payload_json' => $payloadJson,
                ':event_created_at' => $event['event_created_at'] ?? null,
            ]);
            $this->db->commit();
            return ['queued' => true, 'duplicate' => false, 'status' => 'queued', 'eventId' => $eventId];
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /** Reserva um evento pendente sem bloquear outro worker. */
    public function claimNextStripeWebhookEvent(): ?array
    {
        $maximumAttempts = max(1, min(20, (int) ($_ENV['STRIPE_WEBHOOK_WORKER_MAX_ATTEMPTS']
            ?? getenv('STRIPE_WEBHOOK_WORKER_MAX_ATTEMPTS') ?: 8)));
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "SELECT id, event_id, payload_json, payload_hash, attempt_count
                 FROM provider_webhook_events
                 WHERE provider = 'stripe'
                   AND payload_json IS NOT NULL
                   AND payload_json <> ''
                   AND (status IN ('queued', 'failed')
                        OR (status = 'processing' AND updated_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)))
                   AND attempt_count < :maximum_attempts
                   AND (next_retry_at IS NULL OR next_retry_at <= NOW())
                 ORDER BY COALESCE(next_retry_at, queued_at, created_at) ASC, id ASC
                 LIMIT 1 FOR UPDATE SKIP LOCKED"
            );
            $stmt->bindValue(':maximum_attempts', $maximumAttempts, PDO::PARAM_INT);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                $this->db->commit();
                return null;
            }

            $claimToken = bin2hex(random_bytes(16));
            $this->db->prepare(
                "UPDATE provider_webhook_events
                 SET status = 'processing', claim_token = :claim_token,
                     attempt_count = attempt_count + 1, error_message = NULL,
                     last_error_code = NULL, updated_at = NOW()
                 WHERE id = :id"
            )->execute([':claim_token' => $claimToken, ':id' => $row['id']]);
            $this->db->commit();
            $row['claim_token'] = $claimToken;
            $row['attempt_count'] = (int) ($row['attempt_count'] ?? 0) + 1;
            return $row;
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Reserva um evento de webhook do provider para processamento idempotente.
     *
     * @since 1.0.0
     */
    public function claimProviderWebhookEvent(
        string $provider,
        string $eventId,
        string $eventType,
        ?string $objectId = null,
        ?string $payloadHash = null,
        ?string $eventCreatedAt = null
    ): bool {
        $stmt = $this->db->prepare("
            SELECT id, status, updated_at
            FROM provider_webhook_events
            WHERE provider = :provider
              AND event_id = :event_id
            LIMIT 1
        ");
        $stmt->execute([
            ':provider' => $provider,
            ':event_id' => $eventId,
        ]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $status = trim((string) ($existing['status'] ?? ''));
            if (in_array($status, ['processed', 'ignored'], true)) {
                return false;
            }

            if ($status === 'processing' && !$this->isStaleWebhookProcessingClaim($existing)) {
                return false;
            }

            $processingRetryCutoff = date('Y-m-d H:i:s', time() - self::WEBHOOK_PROCESSING_RETRY_AFTER_SECONDS);
            $stmt = $this->db->prepare("
                UPDATE provider_webhook_events
                SET status = 'processing',
                    event_type = :event_type,
                    object_id = :object_id,
                    payload_hash = :payload_hash,
                    event_created_at = :event_created_at,
                    error_message = NULL,
                    processed_at = NULL,
                    attempt_count = attempt_count + 1
                WHERE id = :id
                  AND status <> 'processed'
                  AND (
                      status <> 'processing'
                      OR updated_at IS NULL
                      OR updated_at <= :processing_retry_cutoff
                  )
            ");
            $stmt->execute([
                ':event_type' => $eventType,
                ':object_id' => $objectId,
                ':payload_hash' => $payloadHash,
                ':event_created_at' => $eventCreatedAt,
                ':id' => (int) $existing['id'],
                ':processing_retry_cutoff' => $processingRetryCutoff,
            ]);

            return $stmt->rowCount() > 0;
        }

        try {
            $this->db->prepare("
                INSERT INTO provider_webhook_events (
                    provider, event_id, event_type, object_id, payload_hash, status, event_created_at
                ) VALUES (
                    :provider, :event_id, :event_type, :object_id, :payload_hash, 'processing', :event_created_at
                )
            ")->execute([
                ':provider' => $provider,
                ':event_id' => $eventId,
                ':event_type' => $eventType,
                ':object_id' => $objectId,
                ':payload_hash' => $payloadHash,
                ':event_created_at' => $eventCreatedAt,
            ]);

            return true;
        } catch (PDOException $exception) {
            return false;
        }
    }

    /**
     * Permite que a Stripe reentregue um webhook preso em processamento apos queda do worker.
     *
     * @since 1.0.0
     */
    private function isStaleWebhookProcessingClaim(array $event): bool
    {
        $updatedAt = strtotime((string) ($event['updated_at'] ?? ''));

        if ($updatedAt === false) {
            return true;
        }

        return $updatedAt <= (time() - self::WEBHOOK_PROCESSING_RETRY_AFTER_SECONDS);
    }

    /**
     * Marca um evento de webhook como processado.
     *
     * @since 1.0.0
     */
    public function markProviderWebhookEventProcessed(string $provider, string $eventId, ?string $claimToken = null): void
    {
        $whereToken = $claimToken !== null && $claimToken !== '' ? ' AND claim_token = :claim_token' : '';
        $params = [':provider' => $provider, ':event_id' => $eventId];
        if ($whereToken !== '') {
            $params[':claim_token'] = $claimToken;
        }
        $this->db->prepare("
            UPDATE provider_webhook_events
            SET status = 'processed',
                processed_at = NOW(),
                error_message = NULL,
                last_error_code = NULL,
                next_retry_at = NULL,
                claim_token = NULL,
                payload_json = NULL
            WHERE provider = :provider
              AND event_id = :event_id
              {$whereToken}
        ")->execute($params);
    }

    /**
     * Marca um evento de webhook como falho para permitir nova tentativa.
     *
     * @since 1.0.0
     */
    public function markProviderWebhookEventFailed(
        string $provider,
        string $eventId,
        string $errorMessage,
        ?string $claimToken = null,
        string $errorCode = 'PROCESSING_ERROR'
    ): void
    {
        $maximumAttempts = max(1, min(20, (int) ($_ENV['STRIPE_WEBHOOK_WORKER_MAX_ATTEMPTS']
            ?? getenv('STRIPE_WEBHOOK_WORKER_MAX_ATTEMPTS') ?: 8)));
        $whereToken = $claimToken !== null && $claimToken !== '' ? ' AND claim_token = :claim_token' : '';
        $params = [
            ':provider' => $provider,
            ':event_id' => $eventId,
            ':error_message' => substr($errorMessage, 0, 1000),
            ':error_code' => substr($errorCode, 0, 80),
            ':maximum_attempts_status' => $maximumAttempts,
            ':maximum_attempts_retry' => $maximumAttempts,
            ':maximum_attempts_dead_letter' => $maximumAttempts,
            ':maximum_attempts_payload' => $maximumAttempts,
        ];
        if ($whereToken !== '') {
            $params[':claim_token'] = $claimToken;
        }
        $this->db->prepare("
            UPDATE provider_webhook_events
            SET status = CASE WHEN attempt_count >= :maximum_attempts_status THEN 'dead_lettered' ELSE 'failed' END,
                error_message = :error_message,
                last_error_code = :error_code,
                next_retry_at = CASE
                    WHEN attempt_count >= :maximum_attempts_retry THEN NULL
                    ELSE DATE_ADD(NOW(), INTERVAL LEAST(3600, POW(2, LEAST(attempt_count, 6)) * 30) SECOND)
                END,
                dead_lettered_at = CASE
                    WHEN attempt_count >= :maximum_attempts_dead_letter THEN COALESCE(dead_lettered_at, NOW())
                    ELSE dead_lettered_at
                END,
                claim_token = NULL,
                payload_json = CASE WHEN attempt_count >= :maximum_attempts_payload THEN NULL ELSE payload_json END
            WHERE provider = :provider
              AND event_id = :event_id
              {$whereToken}
        ")->execute($params);
    }

    /**
     * Marca um evento de webhook como ignorado quando ele nao afeta o dominio.
     *
     * @since 1.0.0
     */
    public function markProviderWebhookEventIgnored(
        string $provider,
        string $eventId,
        string $reason,
        ?string $claimToken = null
    ): void
    {
        $whereToken = $claimToken !== null && $claimToken !== '' ? ' AND claim_token = :claim_token' : '';
        $params = [
            ':provider' => $provider,
            ':event_id' => $eventId,
            ':error_message' => substr($reason, 0, 1000),
        ];
        if ($whereToken !== '') {
            $params[':claim_token'] = $claimToken;
        }
        $this->db->prepare("
            UPDATE provider_webhook_events
            SET status = 'ignored',
                processed_at = NOW(),
                error_message = :error_message,
                last_error_code = NULL,
                next_retry_at = NULL,
                claim_token = NULL,
                payload_json = NULL
            WHERE provider = :provider
              AND event_id = :event_id
              {$whereToken}
        ")->execute($params);
    }

    /**
     * Consulta o estado atual de um evento de webhook para diagnostico operacional.
     *
     * @since 1.0.0
     */
    public function findProviderWebhookEventStatus(string $provider, string $eventId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT event_type, object_id, status, processed_at, error_message, updated_at,
                   attempt_count, next_retry_at, dead_lettered_at, last_error_code
            FROM provider_webhook_events
            WHERE provider = :provider
              AND event_id = :event_id
            LIMIT 1
        ");
        $stmt->execute([
            ':provider' => $provider,
            ':event_id' => $eventId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Atualiza flags de renovacao automatica na assinatura.
     *
     * @since 1.0.0
     */
    public function updateAutoRenewState(int $subscriptionId, bool $autoRenew, bool $cancelAtPeriodEnd): void
    {
        $stmt = $this->db->prepare('UPDATE user_subscriptions SET auto_renew = :auto_renew, cancel_at_period_end = :cancel_at_period_end WHERE id = :id');
        $stmt->execute([
            ':auto_renew' => $autoRenew ? 1 : 0,
            ':cancel_at_period_end' => $cancelAtPeriodEnd ? 1 : 0,
            ':id' => $subscriptionId,
        ]);
    }

    /**
     * Persiste o customer id da Stripe no usuario.
     *
     * @since 1.0.0
     */
    public function updateUserStripeCustomerId(string $userId, string $stripeCustomerId): void
    {
        $stmt = $this->db->prepare('UPDATE users SET stripe_customer_id = :stripe_customer_id WHERE id = :user_id');
        $stmt->execute([
            ':stripe_customer_id' => $stripeCustomerId,
            ':user_id' => $userId,
        ]);
    }

    /**
     * Atualiza o plano ativo e a data de expiracao do usuario.
     *
     * @since 1.0.0
     */
    public function updateUserPlanAssignment(string $userId, int $planId, string $planName, string $subscriptionEnd): void
    {
        $stmt = $this->db->prepare("
            UPDATE users
            SET plan = :plan_name,
                current_plan_id = :plan_id,
                subscription_end = :subscription_end
            WHERE id = :user_id
        ");
        $stmt->execute([
            ':plan_name' => $planName,
            ':plan_id' => $planId,
            ':subscription_end' => $subscriptionEnd,
            ':user_id' => $userId,
        ]);
    }

    /**
     * Conta cartoes Stripe salvos pelo usuario.
     *
     * @since 1.0.0
     */
    public function countSavedStripeCards(string $userId): int
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM user_cards
            WHERE user_id = :user_id
              AND payment_provider = 'stripe'
        ");
        $stmt->execute([':user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Atualiza o indicador de cartao salvo no perfil do usuario.
     *
     * @since 1.0.0
     */
    public function updateUserHasSavedCard(string $userId, bool $hasSavedCard): void
    {
        $stmt = $this->db->prepare('UPDATE users SET has_saved_card = :has_saved_card WHERE id = :user_id');
        $stmt->execute([
            ':has_saved_card' => $hasSavedCard ? 1 : 0,
            ':user_id' => $userId,
        ]);
    }

    /**
     * Busca assinatura cancelavel para o usuario.
     *
     * @since 1.0.0
     */
    public function findCancelableSubscriptionForUser(string $userId, bool $forUpdate = false): ?array
    {
        $query = "
            SELECT
                us.id,
                us.user_id,
                us.plan_id,
                us.current_period_start,
                us.current_period_end,
                us.is_recurring,
                us.total_installments,
                us.paid_installments,
                us.recurring_amount,
                us.payment_provider,
                us.provider_subscription_id,
                us.provider_customer_id,
                us.provider_current_period_start,
                us.provider_current_period_end,
                us.auto_renew,
                us.cancel_at_period_end,
                us.status,
                us.created_at,
                p.price,
                p.interval_unit,
                p.interval_count,
                p.name AS plan_name
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE us.user_id = :user_id
              AND us.status IN ('active', 'trialing', 'past_due')
            ORDER BY us.id DESC
            LIMIT 1
        ";

        if ($forUpdate) {
            $query .= ' FOR UPDATE';
        }

        $stmt = $this->db->prepare($query);
        $stmt->execute([':user_id' => $userId]);
        $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

        return $subscription ?: null;
    }

    /**
     * Marca o saldo restante do termo parcelado como quitado e agenda encerramento sem renovacao.
     *
     * @since 1.0.0
     */
    public function settleSubscriptionInstallmentDebt(int $subscriptionId): void
    {
        $stmt = $this->db->prepare("
            UPDATE user_subscriptions
            SET paid_installments = COALESCE(total_installments, paid_installments),
                auto_renew = 0,
                cancel_at_period_end = 1,
                next_renewal_amount = NULL,
                next_renewal_date = NULL,
                next_renewal_price_source = NULL,
                next_renewal_cycle_label = NULL,
                next_renewal_snapshot_json = NULL
            WHERE id = :id
        ");
        $stmt->execute([':id' => $subscriptionId]);
    }

    /**
     * Salva o feedback informado no cancelamento.
     *
     * @since 1.0.0
     */
    public function insertCancellationFeedback(string $userId, string $reason, string $details): void
    {
        $reasonLabel = match (strtolower(str_replace(['-', ' '], '_', trim($reason)))) {
            'price', 'valor_da_assinatura' => 'Valor da assinatura',
            'usage', 'nao_estou_usando_o_suficiente' => 'Não estou usando o suficiente',
            'technical', 'problemas_tecnicos' => 'Problemas técnicos',
            'content', 'falta_de_conteudos_especificos' => 'Falta de conteúdos específicos',
            'other', 'outros_motivos' => 'Outros motivos',
            'arrependimento' => 'Arrependimento dentro do prazo de garantia',
            'user_request' => 'Solicitado pelo usuário',
            default => trim($reason) !== '' ? trim($reason) : 'Solicitado pelo usuário',
        };
        $stmt = $this->db->prepare("
            INSERT INTO user_feedback (user_id, type, reason, details)
            VALUES (:user_id, 'cancellation', :reason, :details)
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':reason' => $reasonLabel,
            ':details' => $details,
        ]);
    }

    /**
     * Marca uma transacao como reembolso solicitado.
     *
     * @since 1.0.0
     */
    public function markTransactionRefundRequested(int $transactionId, string $refundReason): void
    {
        $stmt = $this->db->prepare("
            UPDATE transactions
            SET status = 'refund_requested',
                refund_reason = :refund_reason,
                refund_requested_at = NOW()
            WHERE id = :id
        ");
        $stmt->execute([
            ':refund_reason' => $refundReason,
            ':id' => $transactionId,
        ]);
    }

    /**
     * Revoga acesso da assinatura e reseta o plano do usuario.
     *
     * @since 1.0.0
     */
    public function revokeSubscriptionAccessNow(string $userId, int $subscriptionId): void
    {
        $this->db->prepare("
            UPDATE user_subscriptions
            SET auto_renew = 0,
                cancel_at_period_end = 0,
                status = 'canceled',
                current_period_end = NOW(),
                provider_current_period_end = NOW(),
                next_renewal_amount = NULL,
                next_renewal_date = NULL,
                next_renewal_price_source = NULL,
                next_renewal_cycle_label = NULL,
                next_renewal_snapshot_json = NULL
            WHERE id = :id
        ")->execute([':id' => $subscriptionId]);

        $this->db->prepare("
            UPDATE users
            SET current_plan_id = NULL,
                plan = 'Gratuito',
                subscription_end = NULL
            WHERE id = :user_id
        ")->execute([':user_id' => $userId]);

        $this->db->prepare("
            UPDATE user_cards
            SET locked_by_recurring = 0
            WHERE user_id = :user_id
        ")->execute([':user_id' => $userId]);
        RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_subscription_unlock');
    }

    /**
     * Busca a ultima transacao em status de reembolso solicitado.
     *
     * @since 1.0.0
     */
    public function findLatestRefundRequestedTransaction(string $userId, bool $planOnly = false): ?array
    {
        $query = "
            SELECT id, type
            FROM transactions
            WHERE user_id = :user_id
              AND status = 'refund_requested'
        ";

        if ($planOnly) {
            $query .= " AND type = 'plan'";
        }

        $query .= ' ORDER BY created_at DESC LIMIT 1';

        $stmt = $this->db->prepare($query);
        $stmt->execute([':user_id' => $userId]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

        return $transaction ?: null;
    }

    /**
     * Restaura a transacao que estava marcada para reembolso.
     *
     * @since 1.0.0
     */
    public function restoreRefundRequestedTransaction(int $transactionId): void
    {
        $stmt = $this->db->prepare("
            UPDATE transactions
            SET status = 'approved',
                refund_reason = NULL,
                refund_requested_at = NULL
            WHERE id = :id
        ");
        $stmt->execute([':id' => $transactionId]);
    }

    /**
     * Reativa a renovacao automatica em assinaturas ativas.
     *
     * @since 1.0.0
     */
    public function reenableActiveSubscriptionRenewal(string $userId): void
    {
        $stmt = $this->db->prepare("
            UPDATE user_subscriptions
            SET auto_renew = 1,
                cancel_at_period_end = 0
            WHERE user_id = :user_id
              AND status = 'active'
        ");
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Verifica se uma transacao ja existe para um external id.
     *
     * @since 1.0.0
     */
    public function transactionExistsByExternalId(string $externalId): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM transactions WHERE external_id = :external_id LIMIT 1');
        $stmt->execute([':external_id' => $externalId]);

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Conta quantas transacoes de plano o usuario possui.
     *
     * @since 1.0.0
     */
    public function countPlanTransactionsForUser(string $userId): int
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM transactions
            WHERE user_id = :user_id
              AND type = 'plan'
        ");
        $stmt->execute([':user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    public function scheduleStripeInvoiceCollectionRetry(
        string $invoiceId,
        int $attemptCount,
        ?string $nextRetryAt,
        ?string $lastError = null,
        bool $markAttemptedNow = false
    ): void {
        $stmt = $this->db->prepare(
            "UPDATE transactions
             SET collection_retry_count = GREATEST(collection_retry_count, :attempt_count),
                 collection_retry_next_at = :next_retry_at,
                 collection_retry_last_at = CASE WHEN :mark_attempted_now = 1 THEN NOW() ELSE collection_retry_last_at END,
                 collection_retry_last_error = :last_error
             WHERE payment_provider = 'stripe' AND provider_invoice_id = :provider_invoice_id"
        );
        $stmt->execute([
            ':attempt_count' => max(0, $attemptCount),
            ':next_retry_at' => $nextRetryAt,
            ':mark_attempted_now' => $markAttemptedNow ? 1 : 0,
            ':last_error' => $lastError !== null ? mb_substr($lastError, 0, 500) : null,
            ':provider_invoice_id' => $invoiceId,
        ]);
    }

    public function findDueStripeInvoiceCollectionRetries(int $maximumAttempts, int $limit = 50): array
    {
        $safeLimit = max(1, min(200, $limit));
        $stmt = $this->db->prepare(
            "SELECT t.id AS transaction_id, t.provider_invoice_id, t.collection_retry_count,
                    t.collection_retry_next_at, us.id AS subscription_id,
                    us.provider_subscription_id, us.user_id
             FROM transactions t
             JOIN user_subscriptions us ON us.id = t.user_subscription_id
             WHERE t.payment_provider = 'stripe'
               AND t.status = 'rejected'
               AND t.provider_invoice_id IS NOT NULL
               AND t.collection_retry_next_at IS NOT NULL
               AND t.collection_retry_next_at <= NOW()
               AND t.collection_retry_count < :maximum_attempts
               AND us.status IN ('past_due', 'incomplete', 'active', 'trialing')
               AND us.superseded_by_subscription_id IS NULL
             ORDER BY t.collection_retry_next_at ASC, t.id ASC
             LIMIT {$safeLimit}"
        );
        $stmt->bindValue(':maximum_attempts', max(1, $maximumAttempts), PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function clearStripeInvoiceCollectionRetry(string $invoiceId, ?string $lastError = null): void
    {
        $this->db->prepare(
            "UPDATE transactions
             SET collection_retry_next_at = NULL, collection_retry_last_error = :last_error
             WHERE payment_provider = 'stripe' AND provider_invoice_id = :provider_invoice_id"
        )->execute([
            ':last_error' => $lastError !== null ? mb_substr($lastError, 0, 500) : null,
            ':provider_invoice_id' => $invoiceId,
        ]);
    }

    public function findTransactionByProviderInvoiceId(string $invoiceId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, status FROM transactions WHERE provider_invoice_id = :provider_invoice_id LIMIT 1'
        );
        $stmt->execute([':provider_invoice_id' => $invoiceId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function markExistingStripeInvoiceTransactionFailed(
        int $transactionId,
        ?int $subscriptionId,
        ?string $paymentIntentId
    ): void {
        $this->db->prepare(
            "UPDATE transactions
             SET status = 'rejected',
                 user_subscription_id = COALESCE(user_subscription_id, :user_subscription_id),
                 provider_payment_intent_id = :provider_payment_intent_id
             WHERE id = :id AND status NOT IN ('approved', 'completed', 'refunded', 'partially_refunded')"
        )->execute([
            ':user_subscription_id' => $subscriptionId,
            ':provider_payment_intent_id' => $paymentIntentId,
            ':id' => $transactionId,
        ]);
    }

    public function createFailedStripeInvoiceTransaction(array $transaction): void
    {
        $this->db->prepare(
            "INSERT INTO transactions (
                external_id, user_id, user_subscription_id, plan_id, plan_name, amount, platform_fee, status,
                payment_method, payment_provider, provider_payment_intent_id, provider_invoice_id,
                provider_customer_id, installments, payer_email, type
             ) VALUES (
                :external_id, :user_id, :user_subscription_id, :plan_id, :plan_name, :amount, 0, 'rejected',
                'credit_card', 'stripe', :provider_payment_intent_id, :provider_invoice_id,
                :provider_customer_id, 1, :payer_email, 'plan'
             )"
        )->execute([
            ':external_id' => $transaction['external_id'],
            ':user_id' => $transaction['user_id'],
            ':user_subscription_id' => $transaction['user_subscription_id'],
            ':plan_id' => $transaction['plan_id'],
            ':plan_name' => $transaction['plan_name'],
            ':amount' => $transaction['amount'],
            ':provider_payment_intent_id' => $transaction['provider_payment_intent_id'],
            ':provider_invoice_id' => $transaction['provider_invoice_id'],
            ':provider_customer_id' => $transaction['provider_customer_id'],
            ':payer_email' => $transaction['payer_email'],
        ]);
    }

    /**
     * Busca assinaturas Stripe para reconciliacao periodica.
     *
     * @since 1.0.0
     */
    public function findStripeSubscriptionsForReconciliation(): array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price, p.interval_unit, p.interval_count, p.stripe_product_id, u.email
            FROM user_subscriptions us
            JOIN plans p ON p.id = us.plan_id
            JOIN users u ON u.id = us.user_id
            WHERE us.payment_provider = 'stripe'
              AND COALESCE(us.provider_subscription_id, '') <> ''
              AND (
                    us.status IN ('active', 'trialing', 'past_due', 'incomplete')
                    OR (
                        us.status = 'canceled'
                        AND COALESCE(us.updated_at, us.created_at) >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                    )
                  )
            ORDER BY us.id DESC
        ");
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca assinaturas vencidas que podem ser encerradas sem depender do login do usuario.
     *
     * @since 1.0.0
     */
    public function findSubscriptionsForLocalAccessExpiration(): array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price, p.interval_unit, p.interval_count, p.stripe_product_id, u.email
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            LEFT JOIN users u ON u.id = us.user_id
            WHERE us.status IN ('active', 'trialing')
              AND us.current_period_end IS NOT NULL
              AND us.current_period_end < NOW()
              AND (
                    us.payment_provider <> 'stripe'
                    OR COALESCE(us.provider_subscription_id, '') = ''
                    OR COALESCE(us.auto_renew, 0) = 0
                    OR COALESCE(us.cancel_at_period_end, 0) = 1
                  )
            ORDER BY us.current_period_end ASC, us.id ASC
        ");
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Atualiza o status de uma assinatura pelo id.
     *
     * @since 1.0.0
     */
    public function updateSubscriptionStatusById(int $subscriptionId, string $status): void
    {
        $this->db->prepare('UPDATE user_subscriptions SET status = :status WHERE id = :id')
            ->execute([
                ':status' => $status,
                ':id' => $subscriptionId,
            ]);
    }

    /**
     * Marca uma assinatura encerrada por fim de vigencia e remove projecoes futuras.
     *
     * @since 1.0.0
     */
    public function expireSubscriptionById(int $subscriptionId): void
    {
        $this->db->prepare("
            UPDATE user_subscriptions
            SET status = 'expired',
                auto_renew = 0,
                cancel_at_period_end = 0,
                next_renewal_amount = NULL,
                next_renewal_date = NULL,
                next_renewal_price_source = NULL,
                next_renewal_cycle_label = NULL,
                next_renewal_snapshot_json = NULL
            WHERE id = :id
        ")->execute([
            ':id' => $subscriptionId,
        ]);
    }

    /**
     * Atualiza o valor recorrente de uma assinatura.
     *
     * @since 1.0.0
     */
    public function updateSubscriptionRecurringAmountById(int $subscriptionId, float $recurringAmount): void
    {
        $this->db->prepare('UPDATE user_subscriptions SET recurring_amount = :recurring_amount WHERE id = :id')
            ->execute([
                ':recurring_amount' => $recurringAmount,
                ':id' => $subscriptionId,
            ]);
    }

    /**
     * Atualiza o total de parcelas de uma assinatura.
     *
     * @since 1.0.0
     */
    public function updateSubscriptionTotalInstallmentsById(int $subscriptionId, int $totalInstallments): void
    {
        $this->db->prepare('UPDATE user_subscriptions SET total_installments = :total_installments WHERE id = :id')
            ->execute([
                ':total_installments' => $totalInstallments,
                ':id' => $subscriptionId,
            ]);
    }

    /**
     * Atualiza o identificador remoto canonico do plano recorrente.
     *
     * @since 1.0.0
     */
    public function updatePlanExternalPlanId(int $planId, string $externalPlanId): void
    {
        $stmt = $this->db->prepare('UPDATE plans SET external_plan_id = :external_plan_id WHERE id = :id');
        $stmt->execute([
            ':external_plan_id' => $externalPlanId,
            ':id' => $planId,
        ]);
    }

    /**
     * Registra uma execucao guiada da matriz Stripe para auditoria administrativa.
     *
     * @since 1.0.0
     */
    public function insertStripeTestingRun(array $payload): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO stripe_testing_matrix_runs (
                run_id,
                scenario_id,
                scenario_label,
                category_id,
                stripe_reference,
                platform_flow,
                platform_status,
                execution_result,
                evidence_json,
                notes,
                executed_by_admin_id
            ) VALUES (
                :run_id,
                :scenario_id,
                :scenario_label,
                :category_id,
                :stripe_reference,
                :platform_flow,
                :platform_status,
                :execution_result,
                :evidence_json,
                :notes,
                :executed_by_admin_id
            )
        ");

        $stmt->execute([
            ':run_id' => (string) $payload['run_id'],
            ':scenario_id' => (string) $payload['scenario_id'],
            ':scenario_label' => (string) $payload['scenario_label'],
            ':category_id' => (string) $payload['category_id'],
            ':stripe_reference' => (string) ($payload['stripe_reference'] ?? ''),
            ':platform_flow' => (string) ($payload['platform_flow'] ?? ''),
            ':platform_status' => (string) ($payload['platform_status'] ?? ''),
            ':execution_result' => (string) $payload['execution_result'],
            ':evidence_json' => json_encode($payload['evidence'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':notes' => (string) ($payload['notes'] ?? ''),
            ':executed_by_admin_id' => (string) $payload['executed_by_admin_id'],
        ]);
    }

    /**
     * Lista o historico de execucoes da matriz Stripe para o painel admin.
     *
     * @since 1.0.0
     */
    public function listStripeTestingRuns(int $limit = 80): array
    {
        $safeLimit = max(1, min(300, $limit));
        $stmt = $this->db->prepare("
            SELECT
                r.run_id,
                r.scenario_id,
                r.scenario_label,
                r.category_id,
                r.stripe_reference,
                r.platform_flow,
                r.platform_status,
                r.execution_result,
                r.evidence_json,
                r.notes,
                r.executed_by_admin_id,
                u.name AS executed_by_admin_name,
                u.email AS executed_by_admin_email,
                r.created_at
            FROM stripe_testing_matrix_runs r
            LEFT JOIN users u ON u.id = r.executed_by_admin_id
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT {$safeLimit}
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            $evidence = json_decode((string) ($row['evidence_json'] ?? ''), true);
            return [
                'run_id' => (string) ($row['run_id'] ?? ''),
                'scenario_id' => (string) ($row['scenario_id'] ?? ''),
                'scenario_label' => (string) ($row['scenario_label'] ?? ''),
                'category_id' => (string) ($row['category_id'] ?? ''),
                'stripe_reference' => (string) ($row['stripe_reference'] ?? ''),
                'platform_flow' => (string) ($row['platform_flow'] ?? ''),
                'platform_status' => (string) ($row['platform_status'] ?? ''),
                'execution_result' => (string) ($row['execution_result'] ?? ''),
                'evidence' => is_array($evidence) ? $evidence : [],
                'notes' => (string) ($row['notes'] ?? ''),
                'executed_by_admin_id' => (string) ($row['executed_by_admin_id'] ?? ''),
                'executed_by_admin_name' => (string) ($row['executed_by_admin_name'] ?? ''),
                'executed_by_admin_email' => (string) ($row['executed_by_admin_email'] ?? ''),
                'created_at' => (string) ($row['created_at'] ?? ''),
            ];
        }, $rows);
    }
}
