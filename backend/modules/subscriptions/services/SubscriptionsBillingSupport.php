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
 * Suporte transversal do dominio de assinaturas.
 *
 * Este arquivo concentra calculos de recorrencia, antifraude, notificacoes
 * e adaptacoes de cobranca usados por `modules/subscriptions` e dominios
 * correlatos como `transactions`.
 */
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Calcula a hierarquia do plano por nome.
 *
 * @since 1.0.0
 */
function getPlanTierByName(string $name): int
{
    $normalized = strtolower($name);

    if (strpos($normalized, 'elite') !== false) {
        return 3;
    }

    if (strpos($normalized, 'pro') !== false) {
        return 2;
    }

    if (strpos($normalized, 'essencial') !== false) {
        return 1;
    }

    return 0;
}

/**
 * Converte o intervalo do plano em um score comparavel.
 *
 * @since 1.0.0
 */
function getPlanTimeScore(string $intervalUnit, int $intervalCount): int
{
    $normalizedUnit = strtolower($intervalUnit);

    if ($normalizedUnit === 'year') {
        return 12 * max(1, $intervalCount);
    }

    if ($normalizedUnit === 'month') {
        return max(1, $intervalCount);
    }

    return 1;
}

/**
 * Resolve o total de dias do ciclo do plano.
 *
 * @since 1.0.0
 */
function getPlanDurationInDays(string $intervalUnit, int $intervalCount): int
{
    $normalizedUnit = strtolower(trim($intervalUnit));
    $count = max(1, $intervalCount);

    switch ($normalizedUnit) {
        case 'year':
            return 360 * $count;
        case 'week':
            return 7 * $count;
        case 'day':
            return $count;
        case 'month':
        default:
            return 30 * $count;
    }
}

/**
 * Calcula o periodo de acesso da assinatura.
 *
 * @since 1.0.0
 */
function calculateSubscriptionPeriodRange(string $intervalUnit, int $intervalCount, ?int $fromTimestamp = null): array
{
    $startTimestamp = $fromTimestamp ?: time();
    $durationInDays = getPlanDurationInDays($intervalUnit, $intervalCount);
    $endTimestamp = strtotime('+' . $durationInDays . ' days', $startTimestamp);

    return [
        'start_timestamp' => $startTimestamp,
        'end_timestamp' => $endTimestamp,
        'start' => date('Y-m-d H:i:s', $startTimestamp),
        'end' => date('Y-m-d H:i:s', $endTimestamp),
        'days' => $durationInDays,
    ];
}

/**
 * Calcula o periodo de renovacao respeitando o termino atual.
 *
 * @since 1.0.0
 */
function calculateSubscriptionRenewalPeriodRange(string $intervalUnit, int $intervalCount, ?string $currentPeriodEnd = null, ?int $fromTimestamp = null): array
{
    $baseTimestamp = $fromTimestamp ?: time();
    $currentEndTimestamp = $currentPeriodEnd ? strtotime($currentPeriodEnd) : 0;

    if ($currentEndTimestamp && $currentEndTimestamp > $baseTimestamp) {
        $baseTimestamp = $currentEndTimestamp;
    }

    return calculateSubscriptionPeriodRange($intervalUnit, $intervalCount, $baseTimestamp);
}

/**
 * Cancela outras assinaturas ativas do usuario.
 *
 * @since 1.0.0
 */
function deactivateOtherUserSubscriptions(PDO $db, string $userId, ?int $keepId = null): void
{
    $params = [':user_id' => $userId];
    $sql = "
        UPDATE user_subscriptions
        SET status = 'canceled',
            auto_renew = 0,
            cancel_at_period_end = CASE
                WHEN superseded_by_subscription_id IS NULL THEN 1
                ELSE 0
            END
        WHERE user_id = :user_id
          AND status IN ('active', 'trialing', 'past_due', 'incomplete')
    ";

    if ($keepId !== null) {
        $sql .= " AND id < :keep_id";
        $params[':keep_id'] = $keepId;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
}

/**
 * Busca a assinatura ativa mais recente do usuario.
 *
 * @since 1.0.0
 */
function getActiveSubscriptionForUser(PDO $db, $userId): ?array
{
    $stmt = $db->prepare("
        SELECT us.*, p.name AS plan_name, p.price AS plan_price, p.interval_unit, p.interval_count
        FROM user_subscriptions us
        JOIN plans p ON us.plan_id = p.id
        WHERE us.user_id = :user_id
          AND us.status IN ('active', 'trialing', 'past_due')
        ORDER BY us.id DESC
        LIMIT 1
    ");

    $stmt->execute([':user_id' => $userId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

    return $subscription ?: null;
}

/**
 * Localiza o valor efetivamente pago pelo ciclo atual da assinatura.
 *
 * @since 1.0.0
 */
function findCurrentSubscriptionPaidAmountForCredit(PDO $db, array $subscription): ?float
{
    $userId = trim((string) ($subscription['user_id'] ?? ''));
    $planId = (int) ($subscription['plan_id'] ?? 0);
    $periodStart = trim((string) ($subscription['current_period_start'] ?? $subscription['created_at'] ?? ''));
    if ($userId === '' || $planId <= 0 || $periodStart === '') {
        return null;
    }

    $paymentProvider = normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe');
    $providerCustomerId = trim((string) ($subscription['provider_customer_id'] ?? ''));

    $query = "
        SELECT amount
        FROM transactions
        WHERE user_id = :user_id
          AND type = 'plan'
          AND plan_id = :plan_id
          AND payment_provider = :payment_provider
          AND status IN ('approved', 'completed')
          AND COALESCE(amount, 0) >= 0
          AND (provider_refund_id IS NULL OR provider_refund_id = '')
          AND refunded_at IS NULL
          AND created_at >= DATE_SUB(:period_start, INTERVAL 30 MINUTE)
    ";
    $params = [
        ':user_id' => $userId,
        ':plan_id' => $planId,
        ':payment_provider' => $paymentProvider,
        ':period_start' => $periodStart,
    ];

    if ($providerCustomerId !== '') {
        $query .= " AND (provider_customer_id = :provider_customer_id OR provider_customer_id IS NULL OR provider_customer_id = '')";
        $params[':provider_customer_id'] = $providerCustomerId;
    }

    $query .= " ORDER BY created_at DESC, id DESC LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $amount = $stmt->fetchColumn();

    if ($amount === false || $amount === null) {
        return null;
    }

    return round(max(0, (float) $amount), 2);
}

/**
 * Valida se o usuario pode migrar para o plano alvo.
 *
 * @since 1.0.0
 */
function validateSubscriptionTargetPlan(PDO $db, $userId, array $targetPlan): array
{
    $currentSubscription = getActiveSubscriptionForUser($db, $userId);

    if (!$currentSubscription) {
        return ['current_subscription' => null, 'blocked_message' => null];
    }

    $currentTier = getPlanTierByName($currentSubscription['plan_name'] ?? '');
    $currentTimeScore = getPlanTimeScore(
        (string) ($currentSubscription['interval_unit'] ?? 'month'),
        (int) ($currentSubscription['interval_count'] ?? 1)
    );

    $targetTier = getPlanTierByName($targetPlan['name'] ?? '');
    $targetTimeScore = getPlanTimeScore(
        (string) ($targetPlan['interval_unit'] ?? 'month'),
        (int) ($targetPlan['interval_count'] ?? 1)
    );

    if ($targetTier < $currentTier) {
        return [
            'current_subscription' => $currentSubscription,
            'blocked_message' => "Voce ja possui o plano {$currentSubscription['plan_name']}. Nao e possivel assinar um plano inferior enquanto o atual estiver ativo."
        ];
    }

    if ($targetTier === $currentTier && $targetTimeScore < $currentTimeScore) {
        return [
            'current_subscription' => $currentSubscription,
            'blocked_message' => "Voce ja possui o plano {$currentSubscription['plan_name']} em uma modalidade superior. Nao e possivel migrar para uma modalidade inferior enquanto o atual estiver ativo."
        ];
    }

    return ['current_subscription' => $currentSubscription, 'blocked_message' => null];
}

/**
 * Calcula o credito proporcional seguro para upgrades.
 *
 * @since 1.0.0
 */
function calculateSafeProratedCredit(PDO $db, $userId): float
{
    $currentSubscription = getActiveSubscriptionForUser($db, $userId);

    if (!$currentSubscription) {
        return 0.0;
    }

    $planPrice = (float) ($currentSubscription['plan_price'] ?? 0);
    if ($planPrice <= 0) {
        return 0.0;
    }

    $paidAmount = findCurrentSubscriptionPaidAmountForCredit($db, $currentSubscription);
    $recurringAmount = round((float) ($currentSubscription['recurring_amount'] ?? 0), 2);
    if ($paidAmount !== null) {
        $creditBase = min($planPrice, $paidAmount);
    } elseif ($recurringAmount > 0) {
        $creditBase = min($planPrice, $recurringAmount);
    } else {
        return 0.0;
    }

    if ($creditBase <= 0) {
        return 0.0;
    }

    $start = strtotime((string) ($currentSubscription['current_period_start'] ?? ''));
    $end = strtotime((string) ($currentSubscription['current_period_end'] ?? ''));
    $now = time();

    if (!$start || !$end || $end <= $now || $end <= $start) {
        return 0.0;
    }

    $totalDuration = $end - $start;
    $remaining = max(0, min($totalDuration, $end - $now));
    $theoreticalCredit = round(($creditBase * $remaining) / $totalDuration, 2);

    return round(min($creditBase, $theoreticalCredit), 2);
}

/**
 * Normaliza o alvo de um cupom comercial.
 *
 * @since 1.0.0
 */
function normalizeCouponTargetType(?string $targetType): string
{
    $normalized = strtolower(trim((string) $targetType));

    if (in_array($normalized, ['plan', 'item'], true)) {
        return $normalized;
    }

    return 'all';
}

/**
 * Normaliza o identificador alvo do cupom.
 *
 * @since 1.0.0
 */
function normalizeCouponTargetId($targetId): ?string
{
    $normalized = trim((string) $targetId);
    return $normalized !== '' ? $normalized : null;
}

/**
 * Resolve o contexto alvo usado para validar cupons.
 *
 * @since 1.0.0
 */
function resolveCouponTargetContext(array $context): array
{
    $planId = isset($context['plan_id']) ? (int) $context['plan_id'] : 0;
    $itemId = normalizeCouponTargetId($context['item_id'] ?? null);
    $targetType = normalizeCouponTargetType($context['target_type'] ?? null);
    $targetId = normalizeCouponTargetId($context['target_id'] ?? null);

    if ($targetType === 'all') {
        if ($planId > 0) {
            return ['target_type' => 'plan', 'target_id' => (string) $planId];
        }

        if ($itemId !== null) {
            return ['target_type' => 'item', 'target_id' => $itemId];
        }

        return ['target_type' => 'all', 'target_id' => null];
    }

    if ($targetType === 'plan' && $targetId === null && $planId > 0) {
        $targetId = (string) $planId;
    }

    if ($targetType === 'item' && $targetId === null && $itemId !== null) {
        $targetId = $itemId;
    }

    return [
        'target_type' => $targetType,
        'target_id' => $targetId,
    ];
}

/**
 * Normaliza o payload do cupom vindo das configuracoes.
 *
 * @since 1.0.0
 */
function normalizeStoredCouponCandidate(array $coupon): array
{
    return [
        ...$coupon,
        'code' => strtoupper(trim((string) ($coupon['code'] ?? ''))),
        'discountPercentage' => (float) ($coupon['discountPercentage'] ?? 0),
        'discountAmount' => (float) ($coupon['discountAmount'] ?? 0),
        'uses' => (int) ($coupon['uses'] ?? 0),
        'maxUses' => (int) ($coupon['maxUses'] ?? 0),
        'autoApply' => !empty($coupon['autoApply']),
        'targetType' => normalizeCouponTargetType($coupon['targetType'] ?? null),
        'targetId' => normalizeCouponTargetId($coupon['targetId'] ?? null),
        'newUsersOnly' => !empty($coupon['newUsersOnly']) || !empty($coupon['new_users_only']),
        'firstPurchaseOnly' => !empty($coupon['firstPurchaseOnly']) || !empty($coupon['first_purchase_only']),
        'allowedUserIds' => normalizeCouponAudienceList($coupon['allowedUserIds'] ?? $coupon['allowed_user_ids'] ?? []),
        'allowedUserEmails' => normalizeCouponAudienceList(
            $coupon['allowedUserEmails'] ?? $coupon['allowed_user_emails'] ?? [],
            true
        ),
    ];
}

/**
 * Normaliza listas de audiencia de cupom.
 *
 * @since 1.0.0
 */
function normalizeCouponAudienceList($value, bool $lowercase = false): array
{
    if (is_string($value)) {
        $items = preg_split('/[\r\n,;]+/', $value) ?: [];
    } elseif (is_array($value)) {
        $items = $value;
    } else {
        $items = [];
    }

    $normalized = [];
    foreach ($items as $item) {
        $text = trim((string) $item);
        if ($text === '') {
            continue;
        }

        $normalized[] = $lowercase ? strtolower($text) : $text;
    }

    return array_values(array_unique($normalized));
}

/**
 * Indica se o cupom possui restricao de audiencia.
 *
 * @since 1.0.0
 */
function couponHasAudienceRestriction(array $coupon): bool
{
    return !empty($coupon['newUsersOnly'])
        || !empty($coupon['firstPurchaseOnly'])
        || !empty($coupon['allowedUserIds'])
        || !empty($coupon['allowedUserEmails']);
}

/**
 * Verifica se o usuario ja tem compra ou assinatura paga na plataforma.
 *
 * @since 1.0.0
 */
function couponUserHasPriorPaidPlan(PDO $db, string $userId): bool
{
    if ($userId === '') {
        return false;
    }

    try {
        if (paymentProviderTableExists($db, 'transactions')) {
            $stmt = $db->prepare("
                SELECT 1
                FROM transactions
                WHERE user_id = :user_id
                  AND type = 'plan'
                  AND status IN ('approved', 'completed', 'refund_requested', 'refunded')
                LIMIT 1
            ");
            $stmt->execute([':user_id' => $userId]);
            if ($stmt->fetchColumn()) {
                return true;
            }
        }
    } catch (Throwable $error) {
        error_log('[coupon_eligibility] transaction lookup skipped: ' . $error->getMessage());
    }

    try {
        if (paymentProviderTableExists($db, 'user_subscriptions')) {
            $stmt = $db->prepare("
                SELECT 1
                FROM user_subscriptions
                WHERE user_id = :user_id
                  AND payment_provider IN ('stripe', 'mercado_pago')
                  AND provider_subscription_id IS NOT NULL
                  AND provider_subscription_id <> ''
                LIMIT 1
            ");
            $stmt->execute([':user_id' => $userId]);
            if ($stmt->fetchColumn()) {
                return true;
            }
        }
    } catch (Throwable $error) {
        error_log('[coupon_eligibility] subscription lookup skipped: ' . $error->getMessage());
    }

    return false;
}

/**
 * Resolve restricoes de audiencia do cupom para o usuario autenticado.
 *
 * @return string|null Mensagem de bloqueio, quando houver.
 * @since 1.0.0
 */
function couponAudienceRejectionMessage(PDO $db, array $coupon, array $context): ?string
{
    $userId = trim((string) ($context['user_id'] ?? $context['authenticated_user_id'] ?? ''));
    $userEmail = strtolower(trim((string) ($context['user_email'] ?? $context['authenticated_user_email'] ?? '')));
    $allowedUserIds = normalizeCouponAudienceList($coupon['allowedUserIds'] ?? []);
    $allowedUserEmails = normalizeCouponAudienceList($coupon['allowedUserEmails'] ?? [], true);

    if (!couponHasAudienceRestriction($coupon)) {
        return null;
    }

    if ($userId === '' && $userEmail === '') {
        return 'Entre na conta para validar este cupom.';
    }

    if ($allowedUserIds !== [] || $allowedUserEmails !== []) {
        $matchesUserId = $userId !== '' && in_array($userId, $allowedUserIds, true);
        $matchesEmail = $userEmail !== '' && in_array($userEmail, $allowedUserEmails, true);

        if (!$matchesUserId && !$matchesEmail) {
            return 'Cupom restrito a usuarios selecionados.';
        }
    }

    if (!empty($coupon['newUsersOnly']) || !empty($coupon['firstPurchaseOnly'])) {
        $hasPriorPurchase = array_key_exists('has_prior_purchase', $context)
            ? (bool) $context['has_prior_purchase']
            : couponUserHasPriorPaidPlan($db, $userId);

        if ($hasPriorPurchase) {
            return 'Cupom exclusivo para novos usuarios.';
        }
    }

    return null;
}

/**
 * Calcula o desconto absoluto do cupom para um valor alvo.
 *
 * @since 1.0.0
 */
function calculateCouponDiscountAmount(array $coupon, float $amount): float
{
    $percentage = max(0.0, min(100.0, (float) ($coupon['discountPercentage'] ?? 0)));
    $fixedAmount = (float) ($coupon['discountAmount'] ?? 0);

    if ($percentage > 0) {
        return round(($amount * $percentage) / 100, 2);
    }

    if ($fixedAmount > 0) {
        return round($fixedAmount, 2);
    }

    return 0.0;
}

/**
 * Verifica se o cupom expirou com base na data configurada.
 *
 * @since 1.0.0
 */
function couponHasExpired(array $coupon): bool
{
    $expiresAt = trim((string) ($coupon['expiresAt'] ?? ''));
    if ($expiresAt === '') {
        return false;
    }

    $expiresAtTimestamp = strtotime($expiresAt);
    if ($expiresAtTimestamp === false) {
        return false;
    }

    return $expiresAtTimestamp < time();
}

/**
 * Verifica se o cupom pode ser aplicado ao contexto atual.
 *
 * @since 1.0.0
 */
function couponMatchesTargetContext(array $coupon, array $context): bool
{
    $targetType = normalizeCouponTargetType($coupon['targetType'] ?? null);
    $targetId = normalizeCouponTargetId($coupon['targetId'] ?? null);

    if ($targetType === 'all') {
        return true;
    }

    $resolvedContext = resolveCouponTargetContext($context);
    if ($resolvedContext['target_type'] !== $targetType) {
        return false;
    }

    if ($targetId === null || $resolvedContext['target_id'] === null) {
        return false;
    }

    return (string) $targetId === (string) $resolvedContext['target_id'];
}

/**
 * Escolhe o melhor cupom automatico para o contexto alvo.
 *
 * @since 1.0.0
 */
function resolveBestAutomaticCoupon(array $coupons, float $amount, array $context, ?PDO $db = null): ?array
{
    $bestCoupon = null;
    $bestScore = null;

    foreach ($coupons as $coupon) {
        $candidate = normalizeStoredCouponCandidate(is_array($coupon) ? $coupon : (array) $coupon);

        if ($candidate['code'] === '' || !$candidate['autoApply']) {
            continue;
        }

        if (couponHasExpired($candidate)) {
            continue;
        }

        if (!couponMatchesTargetContext($candidate, $context)) {
            continue;
        }

        if ($db !== null && couponAudienceRejectionMessage($db, $candidate, $context) !== null) {
            continue;
        }

        if (
            $candidate['maxUses'] > 0
            && (
                $candidate['uses'] + (
                    $db !== null
                        ? getActiveCouponReservationCount($db, $candidate['code'], (string) ($context['checkout_attempt_id'] ?? ''))
                        : 0
                )
            ) >= $candidate['maxUses']
        ) {
            continue;
        }

        $discountAmount = calculateCouponDiscountAmount($candidate, $amount);
        $specificityScore = $candidate['targetType'] === 'all' ? 0 : 1;
        $score = [$specificityScore, $discountAmount];

        if ($bestScore === null || $score > $bestScore) {
            $bestCoupon = $candidate;
            $bestScore = $score;
        }
    }

    return $bestCoupon;
}

/**
 * Garante a tabela de reservas temporarias de cupom.
 *
 * @since 1.0.0
 */
function ensureCouponReservationsTable(PDO $db): void
{
    SchemaReadiness::assertTablesAndColumns($db, 'reservas de cupom', [
        'coupon_reservations' => [
            'coupon_code', 'user_id', 'checkout_attempt_id', 'provider',
            'provider_session_id', 'provider_subscription_id', 'provider_invoice_id',
            'status', 'reserved_at', 'expires_at', 'consumed_at', 'released_at',
        ],
    ]);
}

/**
 * Conta reservas ativas para evitar ultrapassar o limite de usos durante checkouts abertos.
 *
 * @since 1.0.0
 */
function getActiveCouponReservationCount(PDO $db, string $couponCode, string $checkoutAttemptId = ''): int
{
    $normalizedCode = strtoupper(trim($couponCode));
    if ($normalizedCode === '') {
        return 0;
    }

    try {
        ensureCouponReservationsTable($db);

        $sql = "
            SELECT COUNT(*)
            FROM coupon_reservations
            WHERE coupon_code = :coupon_code
              AND status = 'reserved'
              AND expires_at > NOW()
        ";
        $params = [':coupon_code' => $normalizedCode];

        $checkoutAttemptId = trim($checkoutAttemptId);
        if ($checkoutAttemptId !== '') {
            $sql .= ' AND checkout_attempt_id <> :checkout_attempt_id';
            $params[':checkout_attempt_id'] = $checkoutAttemptId;
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    } catch (Throwable $error) {
        error_log('Coupon reservation count warning: ' . $error->getMessage());
        return 0;
    }
}

/**
 * Expira reservas antigas de cupom sem remover historico.
 *
 * @since 1.0.0
 */
function expireStaleCouponReservations(PDO $db): void
{
    ensureCouponReservationsTable($db);

    $db->exec("
        UPDATE coupon_reservations
        SET status = 'expired',
            released_at = COALESCE(released_at, NOW())
        WHERE status = 'reserved'
          AND expires_at <= NOW()
    ");
}

/**
 * Reserva um uso de cupom para um checkout ainda nao confirmado.
 *
 * @since 1.0.0
 */
function reserveCouponUsage(PDO $db, string $couponCode, string $userId, string $checkoutAttemptId, string $provider = 'stripe'): void
{
    $normalizedCode = strtoupper(trim($couponCode));
    $userId = trim($userId);
    $checkoutAttemptId = trim($checkoutAttemptId);
    $provider = trim($provider) !== '' ? trim($provider) : 'stripe';

    if ($normalizedCode === '') {
        return;
    }

    if ($userId === '' || $checkoutAttemptId === '') {
        throw new DomainException('Nao foi possivel reservar o cupom para este checkout. Atualize a pagina e tente novamente.');
    }

    ensureCouponReservationsTable($db);

    $startedTransaction = !$db->inTransaction();
    if ($startedTransaction) {
        $db->beginTransaction();
    }

    try {
        expireStaleCouponReservations($db);

        $lockSql = "SELECT value_json FROM system_settings WHERE key_name = 'coupons' LIMIT 1";
        if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
            $lockSql .= ' FOR UPDATE';
        }

        $stmt = $db->query($lockSql);
        $rawValue = $stmt ? $stmt->fetchColumn() : false;
        $coupons = $rawValue !== false ? json_decode((string) $rawValue, true) : [];
        if (!is_array($coupons)) {
            $coupons = [];
        }

        $targetCoupon = null;
        foreach ($coupons as $coupon) {
            $candidate = normalizeStoredCouponCandidate(is_array($coupon) ? $coupon : (array) $coupon);
            if ($candidate['code'] === $normalizedCode) {
                $targetCoupon = $candidate;
                break;
            }
        }

        if ($targetCoupon === null || couponHasExpired($targetCoupon)) {
            throw new DomainException('Cupom invalido ou expirado.');
        }

        $activeReservations = getActiveCouponReservationCount($db, $normalizedCode, $checkoutAttemptId);
        if (
            $targetCoupon['maxUses'] > 0
            && ($targetCoupon['uses'] + $activeReservations) >= $targetCoupon['maxUses']
        ) {
            throw new DomainException('Cupom esgotado.');
        }

        $expiresAt = date('Y-m-d H:i:s', time() + 7200);
        $stmt = $db->prepare("
            INSERT INTO coupon_reservations (
                coupon_code, user_id, checkout_attempt_id, provider, status, expires_at
            ) VALUES (
                :coupon_code, :user_id, :checkout_attempt_id, :provider, 'reserved', :expires_at
            )
            ON DUPLICATE KEY UPDATE
                status = 'reserved',
                expires_at = VALUES(expires_at),
                released_at = NULL,
                consumed_at = NULL,
                updated_at = CURRENT_TIMESTAMP
        ");
        $stmt->execute([
            ':coupon_code' => $normalizedCode,
            ':user_id' => $userId,
            ':checkout_attempt_id' => $checkoutAttemptId,
            ':provider' => $provider,
            ':expires_at' => $expiresAt,
        ]);

        if ($startedTransaction) {
            $db->commit();
        }
    } catch (Throwable $error) {
        if ($startedTransaction && $db->inTransaction()) {
            $db->rollBack();
        }

        throw $error;
    }
}

/**
 * Vincula uma reserva ao objeto Stripe criado para rastrear expiracao e consumo.
 *
 * @since 1.0.0
 */
function attachCouponReservationProviderReference(
    PDO $db,
    string $couponCode,
    string $userId,
    string $checkoutAttemptId,
    ?string $providerSessionId = null,
    ?string $providerSubscriptionId = null,
    string $provider = 'stripe'
): void {
    $couponCode = strtoupper(trim($couponCode));
    $userId = trim($userId);
    $checkoutAttemptId = trim($checkoutAttemptId);

    if ($couponCode === '' || $userId === '' || $checkoutAttemptId === '') {
        return;
    }

    ensureCouponReservationsTable($db);

    $stmt = $db->prepare("
        UPDATE coupon_reservations
        SET provider_session_id = COALESCE(:provider_session_id, provider_session_id),
            provider_subscription_id = COALESCE(:provider_subscription_id, provider_subscription_id)
        WHERE coupon_code = :coupon_code
          AND user_id = :user_id
          AND checkout_attempt_id = :checkout_attempt_id
          AND provider = :provider
          AND status = 'reserved'
    ");
    $stmt->execute([
        ':provider_session_id' => $providerSessionId !== '' ? $providerSessionId : null,
        ':provider_subscription_id' => $providerSubscriptionId !== '' ? $providerSubscriptionId : null,
        ':coupon_code' => $couponCode,
        ':user_id' => $userId,
        ':checkout_attempt_id' => $checkoutAttemptId,
        ':provider' => $provider,
    ]);
}

/**
 * Libera uma reserva quando o checkout hospedado expira ou falha antes da cobranca.
 *
 * @since 1.0.0
 */
function releaseCouponReservation(PDO $db, string $couponCode, string $userId, string $checkoutAttemptId, string $provider = 'stripe'): void
{
    $couponCode = strtoupper(trim($couponCode));
    $userId = trim($userId);
    $checkoutAttemptId = trim($checkoutAttemptId);

    if ($couponCode === '' || $userId === '' || $checkoutAttemptId === '') {
        return;
    }

    ensureCouponReservationsTable($db);

    $stmt = $db->prepare("
        UPDATE coupon_reservations
        SET status = 'released',
            released_at = NOW()
        WHERE coupon_code = :coupon_code
          AND user_id = :user_id
          AND checkout_attempt_id = :checkout_attempt_id
          AND provider = :provider
          AND status = 'reserved'
    ");
    $stmt->execute([
        ':coupon_code' => $couponCode,
        ':user_id' => $userId,
        ':checkout_attempt_id' => $checkoutAttemptId,
        ':provider' => $provider,
    ]);
}

/**
 * Marca a reserva como consumida quando a fatura Stripe e registrada.
 *
 * @since 1.0.0
 */
function consumeCouponReservationForStripeInvoice(PDO $db, string $couponCode, array $metadata, string $invoiceId, string $subscriptionId = ''): bool
{
    $couponCode = strtoupper(trim($couponCode));
    if ($couponCode === '') {
        return false;
    }

    ensureCouponReservationsTable($db);

    $checkoutAttemptId = trim((string) ($metadata['checkout_attempt_id'] ?? ''));
    $userId = trim((string) ($metadata['user_id'] ?? ''));
    $subscriptionId = trim($subscriptionId);
    $invoiceId = trim($invoiceId);

    $where = ["coupon_code = :coupon_code", "status = 'reserved'"];
    $params = [':coupon_code' => $couponCode];

    if ($checkoutAttemptId !== '' && $userId !== '') {
        $where[] = '(checkout_attempt_id = :checkout_attempt_id AND user_id = :user_id)';
        $params[':checkout_attempt_id'] = $checkoutAttemptId;
        $params[':user_id'] = $userId;
    }

    if ($subscriptionId !== '') {
        $where[] = 'provider_subscription_id = :provider_subscription_id';
        $params[':provider_subscription_id'] = $subscriptionId;
    }

    if (count($where) <= 2) {
        return false;
    }

    $stmt = $db->prepare('
        SELECT id
        FROM coupon_reservations
        WHERE ' . implode(' AND ', array_slice($where, 0, 2)) . '
          AND (' . implode(' OR ', array_slice($where, 2)) . ')
        ORDER BY id DESC
        LIMIT 1
    ');
    $stmt->execute($params);
    $reservationId = (int) $stmt->fetchColumn();

    if ($reservationId <= 0) {
        return false;
    }

    $stmt = $db->prepare("
        UPDATE coupon_reservations
        SET status = 'consumed',
            provider_invoice_id = :provider_invoice_id,
            provider_subscription_id = COALESCE(NULLIF(:provider_subscription_id, ''), provider_subscription_id),
            consumed_at = NOW()
        WHERE id = :id
          AND status = 'reserved'
    ");
    $stmt->execute([
        ':provider_invoice_id' => $invoiceId !== '' ? $invoiceId : null,
        ':provider_subscription_id' => $subscriptionId,
        ':id' => $reservationId,
    ]);

    return $stmt->rowCount() > 0;
}

/**
 * Valida o cupom aplicado e calcula o desconto.
 *
 * @since 1.0.0
 */
function validateCouponForAmount(PDO $db, ?string $couponCode, float $amount, array $context = []): array
{
    $normalizedCode = strtoupper(trim((string) $couponCode));

    $coupons = getSystemSettingValue($db, 'coupons', []);
    if (!is_array($coupons)) {
        $coupons = [];
    }

    if ($normalizedCode === '') {
        $automaticCoupon = resolveBestAutomaticCoupon($coupons, $amount, $context, $db);

        if ($automaticCoupon === null) {
            return [
                'valid' => false,
                'coupon' => null,
                'discount_amount' => 0.0,
                'final_amount' => round($amount, 2),
                'message' => null,
                'auto_applied' => false,
            ];
        }

        $discountAmount = min(round($amount, 2), calculateCouponDiscountAmount($automaticCoupon, $amount));

        return [
            'valid' => true,
            'coupon' => $automaticCoupon,
            'discount_amount' => $discountAmount,
            'final_amount' => max(0, round($amount - $discountAmount, 2)),
            'message' => null,
            'auto_applied' => true,
        ];
    }

    foreach ($coupons as $coupon) {
        $candidate = normalizeStoredCouponCandidate(is_array($coupon) ? $coupon : (array) $coupon);

        if ($candidate['code'] !== $normalizedCode) {
            continue;
        }

        if (couponHasExpired($candidate)) {
            return [
                'valid' => false,
                'coupon' => null,
                'discount_amount' => 0.0,
                'final_amount' => round($amount, 2),
                'message' => 'Cupom invalido ou expirado.',
                'auto_applied' => false,
            ];
        }

        if (!couponMatchesTargetContext($candidate, $context)) {
            return [
                'valid' => false,
                'coupon' => null,
                'discount_amount' => 0.0,
                'final_amount' => round($amount, 2),
                'message' => 'Cupom nao se aplica ao alvo selecionado.',
                'auto_applied' => false,
            ];
        }

        $audienceRejectionMessage = couponAudienceRejectionMessage($db, $candidate, $context);
        if ($audienceRejectionMessage !== null) {
            return [
                'valid' => false,
                'coupon' => null,
                'discount_amount' => 0.0,
                'final_amount' => round($amount, 2),
                'message' => $audienceRejectionMessage,
                'auto_applied' => false,
            ];
        }

        if (
            $candidate['maxUses'] > 0
            && (
                $candidate['uses']
                + getActiveCouponReservationCount($db, $candidate['code'], (string) ($context['checkout_attempt_id'] ?? ''))
            ) >= $candidate['maxUses']
        ) {
            return [
                'valid' => false,
                'coupon' => null,
                'discount_amount' => 0.0,
                'final_amount' => round($amount, 2),
                'message' => 'Cupom esgotado.',
                'auto_applied' => false,
            ];
        }

        $discountAmount = min(round($amount, 2), calculateCouponDiscountAmount($candidate, $amount));

        return [
            'valid' => true,
            'coupon' => $candidate,
            'discount_amount' => $discountAmount,
            'final_amount' => max(0, round($amount - $discountAmount, 2)),
            'message' => null,
            'auto_applied' => false,
        ];
    }

    return [
        'valid' => false,
        'coupon' => null,
        'discount_amount' => 0.0,
        'final_amount' => round($amount, 2),
        'message' => 'Cupom invalido ou expirado.',
        'auto_applied' => false,
    ];
}

/**
 * Incrementa o uso de um cupom validado.
 *
 * @since 1.0.0
 */
function incrementCouponUsage(PDO $db, string $couponCode, bool $enforceUsageLimit = false): void
{
    $normalizedCode = strtoupper(trim($couponCode));
    if ($normalizedCode === '') {
        return;
    }

    $startedTransaction = !$db->inTransaction();
    if ($startedTransaction) {
        $db->beginTransaction();
    }

    try {
        $lockSql = "SELECT value_json FROM system_settings WHERE key_name = 'coupons' LIMIT 1";
        if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
            $lockSql .= ' FOR UPDATE';
        }

        $stmt = $db->query($lockSql);
        $rawValue = $stmt ? $stmt->fetchColumn() : false;
        $coupons = $rawValue !== false ? json_decode((string) $rawValue, true) : [];
        if (!is_array($coupons)) {
            $coupons = [];
        }

        $updated = false;
        foreach ($coupons as &$coupon) {
            $candidate = is_array($coupon) ? $coupon : (array) $coupon;
            $candidateCode = strtoupper(trim((string) ($candidate['code'] ?? '')));

            if ($candidateCode === $normalizedCode) {
                $maxUses = max(0, (int) ($candidate['maxUses'] ?? 0));
                $currentUses = max(0, (int) ($candidate['uses'] ?? 0));
                if ($enforceUsageLimit && $maxUses > 0 && $currentUses >= $maxUses) {
                    throw new RuntimeException('Cupom esgotado.');
                }

                $candidate['uses'] = $currentUses + 1;
                $coupon = $candidate;
                $updated = true;
                break;
            }
        }
        unset($coupon);

        if ($updated) {
            $jsonValue = json_encode($coupons, JSON_UNESCAPED_UNICODE);
            if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
                $stmt = $db->prepare("
                    INSERT INTO system_settings (key_name, value_json)
                    VALUES ('coupons', :value_json)
                    ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)
                ");
                $stmt->execute([':value_json' => $jsonValue]);
            } else {
                $stmt = $db->prepare("
                    UPDATE system_settings
                    SET value_json = :value_json
                    WHERE key_name = 'coupons'
                ");
                $stmt->execute([':value_json' => $jsonValue]);
            }
        }

        if ($startedTransaction) {
            $db->commit();
        }
    } catch (Throwable $error) {
        if ($startedTransaction && $db->inTransaction()) {
            $db->rollBack();
        }

        throw $error;
    }
}

/**
 * Normaliza status do Stripe para o estado local.
 *
 * @since 1.0.0
 */
function mapStripeSubscriptionStatus(string $stripeStatus): string
{
    $normalized = strtolower($stripeStatus);

    $map = [
        'active' => 'active',
        'trialing' => 'trialing',
        'past_due' => 'past_due',
        'unpaid' => 'past_due',
        'incomplete' => 'incomplete',
        'incomplete_expired' => 'canceled',
        'canceled' => 'canceled',
        'cancelled' => 'canceled',
        'paused' => 'past_due',
    ];

    return $map[$normalized] ?? 'incomplete';
}

/**
 * Monta configuracao recorrente do Stripe a partir do plano.
 *
 * @since 1.0.0
 */
function getStripeRecurringConfig(array $plan): array
{
    $intervalUnit = strtolower((string) ($plan['interval_unit'] ?? 'month'));
    $intervalCount = max(1, (int) ($plan['interval_count'] ?? 1));

    if (!in_array($intervalUnit, ['day', 'week', 'month', 'year'], true)) {
        throw new RuntimeException('Intervalo do plano nao suportado pelo Stripe.');
    }

    return [
        'interval' => $intervalUnit,
        'interval_count' => $intervalCount,
    ];
}

/**
 * Resolve o numero de ciclos de compromisso do plano.
 *
 * @since 1.0.0
 */
function getPlanCommitmentCycleCount(string $intervalUnit, int $intervalCount, ?string $planName = null): int
{
    $normalizedUnit = strtolower(trim($intervalUnit));
    $count = max(1, $intervalCount);
    $normalizedName = strtolower(trim((string) $planName));

    if ($normalizedUnit === 'year' || strpos($normalizedName, 'anual') !== false || strpos($normalizedName, 'annual') !== false) {
        return 12 * $count;
    }

    if ($normalizedUnit === 'month') {
        return $count;
    }

    return 1;
}

/**
 * Ajusta o total de parcelas solicitado ao limite do plano.
 *
 * @since 1.0.0
 */
function normalizeStripeRequestedInstallmentCount(?int $requestedInstallmentCount, array $plan): int
{
    $maxInstallments = getPlanCommitmentCycleCount(
        (string) ($plan['interval_unit'] ?? 'month'),
        (int) ($plan['interval_count'] ?? 1),
        (string) ($plan['name'] ?? '')
    );

    $safeRequestedInstallmentCount = max(1, (int) ($requestedInstallmentCount ?? 1));
    return min($maxInstallments, $safeRequestedInstallmentCount);
}

/**
 * Normaliza o modo de cobranca solicitado no Stripe.
 *
 * @since 1.0.0
 */
function normalizeStripeBillingMode(?string $billingMode, ?array $plan = null, ?int $requestedInstallmentCount = null): string
{
    $normalized = strtolower(trim((string) $billingMode));
    $supportedModes = ['single_installment', 'term_recurring'];

    if ($plan) {
        $termCycles = normalizeStripeRequestedInstallmentCount($requestedInstallmentCount, $plan);

        if ($termCycles <= 1) {
            return 'single_installment';
        }
    }

    return in_array($normalized, $supportedModes, true) ? $normalized : 'term_recurring';
}

/**
 * Calcula o intervalo entre cobrancas Stripe.
 *
 * @since 1.0.0
 */
function getStripeChargeIntervalConfig(array $plan, int $termCycles): array
{
    $safeTermCycles = max(1, $termCycles);

    if ($safeTermCycles <= 1) {
        $planRecurring = getStripeRecurringConfig($plan);

        return [
            'charge_interval_unit' => $planRecurring['interval'],
            'charge_interval_count' => $planRecurring['interval_count'],
        ];
    }

    // Parcelas selecionadas representam cobrancas mensais consecutivas. O
    // prazo de acesso continua sendo o prazo integral contratado no plano.
    return [
        'charge_interval_unit' => 'month',
        'charge_interval_count' => 1,
    ];
}

/**
 * Calcula o intervalo de acesso liberado no Stripe.
 *
 * @since 1.0.0
 */
function getStripeAccessIntervalConfig(array $plan, int $termCycles): array
{
    $planRecurring = getStripeRecurringConfig($plan);

    return [
        'access_interval_unit' => $planRecurring['interval'],
        'access_interval_count' => $planRecurring['interval_count'],
    ];
}

/**
 * Converte o intervalo de cobranca Stripe em dias.
 *
 * @since 1.0.0
 */
function getStripeChargeIntervalDays(array $plan, int $termCycles): int
{
    $chargeInterval = getStripeChargeIntervalConfig($plan, $termCycles);

    return getPlanDurationInDays(
        (string) ($chargeInterval['charge_interval_unit'] ?? 'day'),
        (int) ($chargeInterval['charge_interval_count'] ?? 1)
    );
}

/**
 * Monta a configuracao completa do termo de cobranca Stripe.
 *
 * @since 1.0.0
 */
function getStripeBillingTermConfig(
    array $plan,
    float $termTotalAmount,
    ?string $billingMode = null,
    ?int $requestedInstallmentCount = null
): array
{
    $planCommitmentCycles = getPlanCommitmentCycleCount(
        (string) ($plan['interval_unit'] ?? 'month'),
        (int) ($plan['interval_count'] ?? 1),
        (string) ($plan['name'] ?? '')
    );
    $resolvedInstallmentCount = normalizeStripeRequestedInstallmentCount($requestedInstallmentCount, $plan);
    $resolvedBillingMode = normalizeStripeBillingMode($billingMode, $plan, $resolvedInstallmentCount);

    $totalCents = formatMoneyToCents($termTotalAmount);
    if ($totalCents <= 0) {
        throw new RuntimeException('Valor total invalido para gerar a recorrencia Stripe.');
    }

    if ($resolvedBillingMode === 'single_installment') {
        $planRecurring = getStripeRecurringConfig($plan);
        $accessInterval = getStripeAccessIntervalConfig($plan, 1);

        return [
            'billing_mode' => 'single_installment',
            'term_cycles' => 1,
            'commitment_cycles' => $planCommitmentCycles,
            'selected_installment_count' => 1,
            'charge_interval' => $planRecurring['interval'],
            'charge_interval_count' => $planRecurring['interval_count'],
            'access_interval_unit' => $accessInterval['access_interval_unit'],
            'access_interval_count' => $accessInterval['access_interval_count'],
            'term_total_amount' => round($totalCents / 100, 2),
            'term_total_cents' => $totalCents,
            'cycle_charge_amount' => round($totalCents / 100, 2),
            'cycle_charge_cents' => $totalCents,
            'first_invoice_discount_amount' => 0.0,
            'first_invoice_discount_cents' => 0,
            'first_invoice_charge_amount' => round($totalCents / 100, 2),
            'first_invoice_charge_cents' => $totalCents,
        ];
    }

    // Canonico para termos recorrentes: nunca arredondar para baixo o total contratado.
    // @since 1.0.0
    $cycleChargeCents = max(1, (int) ceil($totalCents / $resolvedInstallmentCount));
    $grossTermTotalCents = $cycleChargeCents * $resolvedInstallmentCount;
    $firstInvoiceDiscountCents = max(0, $grossTermTotalCents - $totalCents);
    $firstInvoiceChargeCents = max(0, $cycleChargeCents - $firstInvoiceDiscountCents);

    $chargeInterval = getStripeChargeIntervalConfig($plan, $resolvedInstallmentCount);
    $accessInterval = getStripeAccessIntervalConfig($plan, $resolvedInstallmentCount);

    return [
        'billing_mode' => 'term_recurring',
        'term_cycles' => $resolvedInstallmentCount,
        'commitment_cycles' => $planCommitmentCycles,
        'selected_installment_count' => $resolvedInstallmentCount,
        'charge_interval' => $chargeInterval['charge_interval_unit'],
        'charge_interval_count' => $chargeInterval['charge_interval_count'],
        'access_interval_unit' => $accessInterval['access_interval_unit'],
        'access_interval_count' => $accessInterval['access_interval_count'],
        'term_total_amount' => round($totalCents / 100, 2),
        'term_total_cents' => $totalCents,
        'cycle_charge_amount' => round($cycleChargeCents / 100, 2),
        'cycle_charge_cents' => $cycleChargeCents,
        'first_invoice_discount_amount' => round($firstInvoiceDiscountCents / 100, 2),
        'first_invoice_discount_cents' => $firstInvoiceDiscountCents,
        'first_invoice_charge_amount' => round($firstInvoiceChargeCents / 100, 2),
        'first_invoice_charge_cents' => $firstInvoiceChargeCents,
    ];
}

function addStripeBillingIntervals(
    DateTimeImmutable $date,
    string $intervalUnit,
    int $intervalCount,
    int $numberOfIntervals
): DateTimeImmutable {
    $normalizedUnit = strtolower(trim($intervalUnit));
    $totalCount = max(1, $intervalCount) * max(0, $numberOfIntervals);

    if ($totalCount === 0) {
        return $date;
    }

    if ($normalizedUnit === 'month' || $normalizedUnit === 'year') {
        $monthsToAdd = $normalizedUnit === 'year' ? $totalCount * 12 : $totalCount;
        $currentMonthIndex = ((int) $date->format('Y') * 12) + ((int) $date->format('n') - 1);
        $targetMonthIndex = $currentMonthIndex + $monthsToAdd;
        $targetYear = intdiv($targetMonthIndex, 12);
        $targetMonth = ($targetMonthIndex % 12) + 1;
        $targetMonthStart = new DateTimeImmutable(
            sprintf('%04d-%02d-01 00:00:00', $targetYear, $targetMonth),
            $date->getTimezone()
        );
        $targetDay = min((int) $date->format('j'), (int) $targetMonthStart->format('t'));

        return $date->setDate($targetYear, $targetMonth, $targetDay);
    }

    if ($normalizedUnit === 'week') {
        return $date->modify('+' . ($totalCount * 7) . ' days');
    }

    if ($normalizedUnit === 'day') {
        return $date->modify('+' . $totalCount . ' days');
    }

    throw new InvalidArgumentException('Intervalo de cobranca Stripe invalido para validar a validade do cartao.');
}

function getStripeLastInstallmentChargeAt(
    array $billingConfig,
    ?DateTimeImmutable $firstChargeAt = null
): DateTimeImmutable {
    $firstChargeAt = $firstChargeAt ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $termCycles = max(1, (int) ($billingConfig['term_cycles'] ?? 1));

    return addStripeBillingIntervals(
        $firstChargeAt,
        (string) ($billingConfig['charge_interval'] ?? 'month'),
        max(1, (int) ($billingConfig['charge_interval_count'] ?? 1)),
        $termCycles - 1
    );
}

function getStripeCardExpiryEndAt(
    int $expMonth,
    int $expYear,
    ?DateTimeZone $timezone = null
): DateTimeImmutable {
    if ($expMonth < 1 || $expMonth > 12 || $expYear < 2000) {
        throw new InvalidArgumentException('A Stripe nao retornou uma validade de cartao confiavel.');
    }

    $timezone = $timezone ?? new DateTimeZone('UTC');
    return (new DateTimeImmutable(
        sprintf('%04d-%02d-01 00:00:00', $expYear, $expMonth),
        $timezone
    ))->modify('last day of this month')->setTime(23, 59, 59);
}

function getStripeCardInstallmentExpiryEligibility(
    int $expMonth,
    int $expYear,
    array $billingConfig,
    ?DateTimeImmutable $firstChargeAt = null
): array {
    $firstChargeAt = $firstChargeAt ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $expiryEndAt = getStripeCardExpiryEndAt($expMonth, $expYear, $firstChargeAt->getTimezone());
    $lastChargeAt = getStripeLastInstallmentChargeAt($billingConfig, $firstChargeAt);

    return [
        'eligible' => $lastChargeAt <= $expiryEndAt,
        'expiry_end_at' => $expiryEndAt,
        'last_charge_at' => $lastChargeAt,
        'term_cycles' => max(1, (int) ($billingConfig['term_cycles'] ?? 1)),
    ];
}

function assertStripeCardCoversInstallmentTerm(
    $paymentMethod,
    array $billingConfig,
    ?DateTimeImmutable $firstChargeAt = null
): void {
    $expMonth = (int) ($paymentMethod->card->exp_month ?? 0);
    $expYear = (int) ($paymentMethod->card->exp_year ?? 0);
    $eligibility = getStripeCardInstallmentExpiryEligibility(
        $expMonth,
        $expYear,
        $billingConfig,
        $firstChargeAt
    );

    if (!empty($eligibility['eligible'])) {
        return;
    }

    throw new DomainException(sprintf(
        'Este cartao vence em %02d/%04d, antes da ultima parcela prevista para %s. Escolha menos parcelas ou use outro cartao.',
        $expMonth,
        $expYear,
        $eligibility['last_charge_at']->format('m/Y')
    ));
}

/**
 * Indica se ainda ha ciclos pendentes no termo Stripe.
 *
 * @since 1.0.0
 */
function hasStripeRemainingCommitmentCycles(int $totalInstallments, int $paidInstallments = 0): bool
{
    $safeTotalInstallments = max(1, $totalInstallments);
    $safePaidInstallments = max(0, $paidInstallments);

    return $safeTotalInstallments > 1 && $safePaidInstallments < $safeTotalInstallments;
}

/**
 * Decide o cancelamento ao fim do periodo para o Stripe.
 *
 * @since 1.0.0
 */
function resolveStripeCancelAtPeriodEnd(bool $autoRenew, int $totalInstallments, int $paidInstallments = 0): bool
{
    if ($autoRenew) {
        return false;
    }

    return !hasStripeRemainingCommitmentCycles($totalInstallments, $paidInstallments);
}

/**
 * Monta o rotulo de parcela para exibicao.
 *
 * @since 1.0.0
 */
function buildStripeInstallmentLabel(int $installmentNumber, int $installmentCount): string
{
    $safeInstallmentCount = max(1, $installmentCount);
    $safeInstallmentNumber = max(1, min($safeInstallmentCount, $installmentNumber));
    return $safeInstallmentNumber . '/' . $safeInstallmentCount;
}

/**
 * Monta a descricao curta da cobranca Stripe.
 *
 * @since 1.0.0
 */
function buildStripeChargeDescription(string $planName, int $installmentNumber, int $installmentCount, ?string $billingMode = null): string
{
    $normalizedPlanName = trim($planName) !== '' ? trim($planName) : 'Assinatura';
    $safeInstallmentCount = max(1, $installmentCount);
    $safeInstallmentNumber = max(1, min($safeInstallmentCount, $installmentNumber));

    return sprintf(
        '%s %d de %d',
        $normalizedPlanName,
        $safeInstallmentNumber,
        $safeInstallmentCount
    );
}

/**
 * Cria o nome do cupom de ajuste na primeira fatura Stripe.
 *
 * @since 1.0.0
 */
function buildStripeFirstInvoiceAdjustmentCouponName(string $userId, int $planId): string
{
    $safeUserSuffix = preg_replace('/[^a-zA-Z0-9]/', '', $userId);
    $safeUserSuffix = $safeUserSuffix !== '' ? substr($safeUserSuffix, -8) : 'user';

    $name = sprintf('Ajuste 1a cobranca P%s U%s', $planId, $safeUserSuffix);
    return substr($name, 0, 40);
}

/**
 * Gera o texto de duracao de assinatura.
 *
 * @since 1.0.0
 */
function getSubscriptionDurationLabel(string $intervalUnit, int $intervalCount): string
{
    $days = getPlanDurationInDays($intervalUnit, $intervalCount);
    $normalizedUnit = strtolower(trim($intervalUnit));
    $safeCount = max(1, $intervalCount);

    if ($normalizedUnit === 'year') {
        $months = 12 * $safeCount;
        return sprintf('%d dias (%d meses)', $days, $months);
    }

    if ($normalizedUnit === 'month') {
        return sprintf('%d dias', $days);
    }

    if ($normalizedUnit === 'week') {
        return sprintf('%d dias (%d semanas)', $days, $safeCount);
    }

    return sprintf('%d dias', $days);
}

/**
 * Define o rotulo do ciclo (mensal, anual, etc.).
 *
 * @since 1.0.0
 */
function getSubscriptionCycleLabel(string $intervalUnit, int $intervalCount): string
{
    $normalizedUnit = strtolower(trim($intervalUnit));
    $safeCount = max(1, $intervalCount);

    if ($normalizedUnit === 'year' || ($normalizedUnit === 'month' && $safeCount >= 12)) {
        return 'Anual';
    }

    if ($normalizedUnit === 'month' && $safeCount === 3) {
        return 'Trimestral';
    }

    if ($normalizedUnit === 'week') {
        return $safeCount > 1 ? "{$safeCount} semanas" : 'Semanal';
    }

    if ($normalizedUnit === 'day') {
        return $safeCount > 1 ? "{$safeCount} dias" : 'Diario';
    }

    return 'Mensal';
}

/**
 * Calcula a diferenca em dias de calendario ate a renovacao.
 *
 * A regra de lembretes deve olhar datas de calendario, nao horas exatas,
 * para evitar disparos de "amanha" quando a renovacao ainda cai depois de
 * amanha, mas faltam menos de 48h.
 *
 * @since 1.0.0
 */
function getRenewalCalendarDaysUntil(string $renewalDate, ?int $nowTimestamp = null): ?int
{
    $renewalTimestamp = strtotime($renewalDate);
    if ($renewalTimestamp === false) {
        return null;
    }

    try {
        $timezone = new DateTimeZone((string) (getenv('APP_TIMEZONE') ?: date_default_timezone_get() ?: 'America/Sao_Paulo'));
        $today = (new DateTimeImmutable('@' . ($nowTimestamp ?? time())))->setTimezone($timezone)->setTime(0, 0, 0);
        $renewalDay = (new DateTimeImmutable('@' . $renewalTimestamp))->setTimezone($timezone)->setTime(0, 0, 0);
        $days = (int) $today->diff($renewalDay)->format('%r%a');
        return $days;
    } catch (Throwable $e) {
        $seconds = $renewalTimestamp - ($nowTimestamp ?? time());
        return (int) floor($seconds / 86400);
    }
}

/**
 * Resolve qual lembrete de renovacao faz sentido para a assinatura.
 *
 * Politica:
 * - 5 dias: apenas ciclos maiores que 5 dias;
 * - amanha: qualquer ciclo com renovacao no proximo dia de calendario.
 *
 * @since 1.0.0
 */
function resolveStripeRenewalReminderNotice(array $subscriptionRow, ?int $nowTimestamp = null): ?array
{
    $nextRenewalDate = trim((string) ($subscriptionRow['next_renewal_date'] ?? ''));
    if ($nextRenewalDate === '') {
        return null;
    }

    $daysUntilRenewal = getRenewalCalendarDaysUntil($nextRenewalDate, $nowTimestamp);
    if ($daysUntilRenewal === null || $daysUntilRenewal < 0) {
        return null;
    }

    $intervalUnit = (string) ($subscriptionRow['interval_unit'] ?? 'month');
    $intervalCount = max(1, (int) ($subscriptionRow['interval_count'] ?? 1));
    $cycleDays = getPlanDurationInDays($intervalUnit, $intervalCount);

    if ($daysUntilRenewal === 5 && $cycleDays > 5) {
        return [
            'type' => 'five_days',
            'days_until' => 5,
            'template_key' => 'subscription_renewal_reminder',
            'subject' => 'Sua assinatura vai renovar em 5 dias',
            'title' => 'Renovação automática em 5 dias',
            'notification_title' => 'Renovação automática em 5 dias',
            'notification_message' => 'Sua próxima renovação está prevista para daqui a 5 dias. Revise o valor e o cartão salvo.',
            'email_intro' => 'Este e um lembrete de que sua assinatura do <b>ConcursoMestre</b> esta programada para renovar em 5 dias.',
        ];
    }

    if ($daysUntilRenewal === 1) {
        return [
            'type' => 'tomorrow',
            'days_until' => 1,
            'template_key' => 'subscription_renewal_tomorrow',
            'subject' => 'Seu plano renovará amanhã',
            'title' => 'Seu plano renovará amanhã',
            'notification_title' => 'Seu plano renovará amanhã',
            'notification_message' => 'Sua renovação automática está prevista para amanhã. Confira o cartão salvo para evitar interrupções.',
            'email_intro' => 'Sua assinatura do <b>ConcursoMestre</b> está programada para renovar amanhã.',
        ];
    }

    return null;
}

/**
 * Mapa de labels para beneficios de plano.
 *
 * @since 1.0.0
 */
function getPlanBenefitLabelMap(): array
{
    return [
        'unlimited_questions' => 'Questões ilimitadas',
        'questions_per_day' => 'Questões por dia',
        'module.practice' => 'Prática de questões',
        'question.resolve' => 'Resolver questões',
        'question.answer_key' => 'Ver gabarito',
        'question.basic_explanation' => 'Comentário do professor',
        'question.teacher_comments' => 'Comentário do professor',
        'question.detailed_analysis' => 'Análise detalhada',
        'question.full_statistics' => 'Estatísticas completas',
        'question.save' => 'Salvar questões',
        'question.notes' => 'Anotações',
        'question.share' => 'Compartilhar questões',
        'basic_statistics' => 'Estatísticas básicas',
        'community_comments' => 'Comentários da comunidade',
        'no_ads' => 'Sem anúncios',
        'teacher_comments' => 'Comentário do professor',
        'detailed_analysis' => 'Análise detalhada',
        'error_notebook' => 'Caderno de erros',
        'module.lei_comentada' => 'Lei comentada',
        'lei.comentario_basico' => 'Comentários na lei',
        'lei.doutrina' => 'Doutrina na lei comentada',
        'lei.macete' => 'Macetes na lei comentada',
        'lei.jurisprudencia' => 'Jurisprudência e súmulas',
        'lei.sumulas' => 'Súmulas relacionadas',
        'lei.questoes' => 'Questões da lei comentada',
        'lei.modo_foco' => 'Modo foco na lei',
        'lei.favoritos' => 'Favoritar leis e seções',
        'lei.solicitar_comentario' => 'Solicitar comentário do professor',
        'exclusive_simulations' => 'Simulados exclusivos',
        'module.simulations' => 'Simulados',
        'module.xray' => 'Raio-X da banca',
        'module.dashboard' => 'Dashboard premium',
        'xray_banca' => 'Raio-X da banca',
        'mentor_chat' => 'Chat mentor',
        'priority_support' => 'Suporte prioritário',
        'early_access' => 'Acesso antecipado',
    ];
}

/**
 * Humaniza chaves novas do controle de acesso sem expor nomes tecnicos.
 *
 * @since 1.0.0
 */
function humanizePlanBenefitKey(string $benefitKey): ?string
{
    $key = strtolower(trim($benefitKey));
    if ($key === '') {
        return null;
    }

    $lookupKey = (string) preg_replace('/[\s-]+/', '_', $key);
    $prefixLabels = [
        'practice.filter_' => 'Filtros avançados de questões',
        'question.' => 'Recursos do card da questão',
        'lei.' => 'Recursos da Lei Comentada',
        'module.' => 'Módulo liberado',
    ];

    foreach ($prefixLabels as $prefix => $label) {
        if (strpos($lookupKey, $prefix) === 0) {
            return $label;
        }
    }

    if (str_contains($key, '.') || str_contains($key, '_')) {
        return null;
    }

    $text = str_replace(['.', '_', '-'], ' ', $benefitKey);
    $text = trim((string) preg_replace('/\s+/', ' ', $text));
    return $text !== '' ? ucwords(strtolower($text)) : null;
}

/**
 * Monta uma lista comercial e curta a partir das permissoes tecnicas.
 *
 * @since 1.0.0
 */
function buildCommercialPlanBenefitLabels(array $planMatrix, array $baseLabels, array $benefitMap): array
{
    $labels = $baseLabels;
    $isEnabled = static fn(string $key): bool => !empty($planMatrix[$key]['enabled']);

    $groups = [
        'Filtros avançados para encontrar questões' => [
            'practice.filter_keyword',
            'practice.filter_subject',
            'practice.filter_difficulty',
            'practice.filter_bank',
            'practice.filter_organization',
            'practice.filter_year',
            'practice.filter_level',
            'practice.filter_role',
            'practice.filter_modality',
            'practice.filter_topic',
            'practice.filter_saved',
            'practice.filter_teacher_comment',
            'practice.filter_detailed_analysis',
            'practice.filter_answered_correct',
            'practice.filter_answered_wrong',
        ],
        'Comentário do professor nas questões' => [
            'teacher_comments',
            'question.teacher_comments',
            'question.basic_explanation',
        ],
        'Análise detalhada das questões' => [
            'detailed_analysis',
            'question.detailed_analysis',
        ],
        'Estatísticas completas de desempenho' => [
            'question.full_statistics',
        ],
        'Salvar e organizar questões favoritas' => [
            'question.save',
            'error_notebook',
        ],
        'Anotações pessoais nas questões' => [
            'question.notes',
        ],
        'Lei comentada liberada' => [
            'module.lei_comentada',
        ],
        'Doutrina, súmulas e jurisprudência na lei' => [
            'lei.doutrina',
            'lei.jurisprudencia',
            'lei.sumulas',
        ],
        'Macetes de memorização na lei' => [
            'lei.macete',
        ],
        'Favoritar leis e seções' => [
            'lei.favoritos',
        ],
        'Modo foco na Lei Comentada' => [
            'lei.modo_foco',
        ],
        'Solicitar comentário do professor na lei' => [
            'lei.solicitar_comentario',
        ],
        'Raio-X da banca' => [
            'module.xray',
            'xray_banca',
        ],
        'Dashboard premium' => [
            'module.dashboard',
        ],
        'Experiência sem anúncios' => [
            'no_ads',
        ],
        'Suporte prioritário' => [
            'priority_support',
        ],
        'Chat Mentor' => [
            'mentor_chat',
        ],
        'Acesso antecipado a novos recursos' => [
            'early_access',
        ],
    ];

    $consumed = [
        'unlimited_questions' => true,
        'questions_per_day' => true,
        'ai_explanations' => true,
        'module.practice' => true,
        'question.resolve' => true,
        'question.answer_key' => true,
        'module.simulations' => true,
        'question.share' => true,
        'basic_statistics' => true,
        'community_comments' => true,
        'lei.comentario_basico' => true,
        'lei.questoes' => true,
        'exclusive_simulations' => true,
    ];

    foreach ($groups as $label => $keys) {
        foreach ($keys as $key) {
            if ($isEnabled($key)) {
                $labels[] = $label;
                foreach ($keys as $consumedKey) {
                    $consumed[$consumedKey] = true;
                }
                break;
            }
        }
    }

    foreach ($planMatrix as $benefitKey => $enabled) {
        if (empty($enabled['enabled']) || isset($consumed[$benefitKey])) {
            continue;
        }

        $labels[] = $benefitMap[$benefitKey] ?? humanizePlanBenefitKey((string) $benefitKey);
    }

    return array_slice(array_values(array_unique(array_filter($labels))), 0, 10);
}

/**
 * Lista beneficios vinculados ao plano informado.
 *
 * @since 1.0.0
 */
function getPlanBenefitLabels(PDO $db, ?string $planName): array
{
    $canonicalPlan = canonicalUserPlanValue($planName);
    $entitlements = getConfiguredPlanEntitlements($db);
    $usageLimits = getConfiguredPlanUsageLimits($db);
    $benefitMap = getPlanBenefitLabelMap();
    $planMatrix = $entitlements[$canonicalPlan] ?? [];
    $labels = [];
    $planLimits = $usageLimits[$canonicalPlan] ?? [];

    $questionsLimit = $planLimits['questions_per_day'] ?? null;
    if (is_array($questionsLimit)) {
        $labels[] = (($questionsLimit['mode'] ?? '') === 'limited')
            ? max(0, (int) ($questionsLimit['value'] ?? 0)) . ' questões por dia'
            : 'Questões ilimitadas';
    }

    $simulationsLimit = $planLimits['simulations_per_month'] ?? null;
    if (is_array($simulationsLimit)) {
        $labels[] = (($simulationsLimit['mode'] ?? '') === 'limited')
            ? max(0, (int) ($simulationsLimit['value'] ?? 0)) . ' simulados por mês'
            : 'Simulados ilimitados';
    }

    return buildCommercialPlanBenefitLabels($planMatrix, $labels, $benefitMap);
}

/**
 * Renderiza os beneficios comerciais em formato visual para e-mails.
 *
 * @since 1.0.0
 */
function buildSubscriptionBenefitsEmailHtml(array $benefitLabels): string
{
    $benefitLabels = array_slice(array_values(array_filter(array_unique($benefitLabels))), 0, 10);
    if (empty($benefitLabels)) {
        return '';
    }

    $itemsHtml = '';
    foreach ($benefitLabels as $label) {
        $itemsHtml .= '
          <tr>
            <td style="padding:9px 0;vertical-align:top;width:28px;">
              <span style="display:inline-block;width:20px;height:20px;border-radius:999px;background:#dcfce7;color:#047857;text-align:center;font-size:13px;font-weight:900;line-height:20px;">&#10003;</span>
            </td>
            <td style="padding:9px 0 9px 4px;font-size:14px;line-height:1.45;color:#1e293b;font-weight:700;">'
              . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') .
            '</td>
          </tr>';
    }

    return '
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:22px 0 4px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:18px 20px 8px;background:#eff6ff;border-bottom:1px solid #dbeafe;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#2563eb;">Benefícios liberados</p>
            <p style="margin:0;font-size:18px;line-height:1.35;font-weight:900;color:#0f172a;">O que muda na sua rotina de estudos</p>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#475569;font-weight:600;">Seu plano desbloqueou recursos práticos para estudar com mais precisão e menos distração.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 20px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
              . $itemsHtml .
            '</table>
          </td>
        </tr>
      </table>';
}

/**
 * Formata o metodo de pagamento Stripe para exibicao.
 *
 * @since 1.0.0
 */
function formatStripePaymentMethodLabel(?string $provider): string
{
    $normalizedProvider = normalizePaymentProvider($provider);
    if ($normalizedProvider === 'manual_admin') {
        return 'Concessao manual do admin';
    }

    if ($normalizedProvider === 'stripe') {
        return 'Cartao de credito (Stripe)';
    }

    return 'Cartao de credito';
}

/**
 * Resume o modelo de cobranca do termo Stripe.
 *
 * @since 1.0.0
 */
function formatStripeBillingSummary(
    ?string $billingMode,
    int $installmentCount,
    float $termTotalAmount,
    float $firstChargeAmount,
    float $cycleChargeAmount,
    string $cycleLabel
): string {
    $safeInstallmentCount = max(1, $installmentCount);
    $normalizedBillingMode = strtolower(trim((string) $billingMode));

    if ($normalizedBillingMode === 'term_recurring' && $safeInstallmentCount > 1) {
        return sprintf(
        '%dx dentro do termo %s, com a primeira cobranca de R$ %s e demais cobrancas de R$ %s.',
            $safeInstallmentCount,
            strtolower($cycleLabel),
            number_format($firstChargeAmount, 2, ',', '.'),
            number_format($cycleChargeAmount, 2, ',', '.')
        );
    }

    return sprintf(
        'Pagamento unico de R$ %s referente ao plano %s.',
        number_format($termTotalAmount, 2, ',', '.'),
        strtolower($cycleLabel)
    );
}

/**
 * Resolve a melhor referencia de transacao para exibicao.
 *
 * @since 1.0.0
 */
function getBestTransactionReference(?array $transaction, ?string $fallback = null): string
{
    $reference = trim((string) (
        $transaction['provider_invoice_id']
        ?? $transaction['provider_payment_intent_id']
        ?? $transaction['external_id']
        ?? $fallback
        ?? ''
    ));

    return $reference;
}

/**
 * Localiza transacao Stripe relacionada ao invoice.
 *
 * @since 1.0.0
 */
function findStripeTransactionByInvoiceId(PDO $db, string $invoiceId): ?array
{
    $safeInvoiceId = trim($invoiceId);
    if ($safeInvoiceId === '') {
        return null;
    }

    $stmt = $db->prepare("
        SELECT *
        FROM transactions
        WHERE provider_invoice_id = :provider_invoice_id
           OR external_id = :external_id
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([
        ':provider_invoice_id' => $safeInvoiceId,
        ':external_id' => $safeInvoiceId,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Envia email de boas-vindas ao assinante.
 *
 * @since 1.0.0
 */
function sendSubscriptionWelcomeEmail(PDO $db, array $user, array $subscriptionContext, ?array $transaction = null): void
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '') {
        return;
    }

    $planName = trim((string) ($subscriptionContext['plan_name'] ?? 'Assinatura'));
    $intervalUnit = (string) ($subscriptionContext['interval_unit'] ?? 'month');
    $intervalCount = max(1, (int) ($subscriptionContext['interval_count'] ?? 1));
    $cycleLabel = getSubscriptionCycleLabel($intervalUnit, $intervalCount);
    $durationLabel = getSubscriptionDurationLabel($intervalUnit, $intervalCount);
    $benefitLabels = getPlanBenefitLabels($db, $planName);
    $benefitsHtml = buildSubscriptionBenefitsEmailHtml($benefitLabels);

    $billingMode = (string) ($subscriptionContext['billing_mode'] ?? 'single_installment');
    $installmentCount = max(1, (int) ($subscriptionContext['installment_count'] ?? 1));
    $termTotalAmount = round((float) ($subscriptionContext['term_total_amount'] ?? ($transaction['amount'] ?? 0)), 2);
    $firstChargeAmount = round((float) ($subscriptionContext['first_charge_amount'] ?? ($transaction['amount'] ?? $termTotalAmount)), 2);
    $cycleChargeAmount = round((float) ($subscriptionContext['cycle_charge_amount'] ?? $firstChargeAmount), 2);
    $paymentMethodLabel = formatStripePaymentMethodLabel((string) ($subscriptionContext['payment_provider'] ?? 'stripe'));
    $transactionReference = getBestTransactionReference($transaction, (string) ($subscriptionContext['transaction_reference'] ?? ''));
    $subscriptionEnd = trim((string) ($subscriptionContext['current_period_end'] ?? ''));
    $subscriptionEndTimestamp = $subscriptionEnd !== '' ? strtotime($subscriptionEnd) : 0;
    $subscriptionEndLabel = $subscriptionEndTimestamp ? date('d/m/Y H:i', $subscriptionEndTimestamp) : 'conforme o ciclo contratado';
    $paymentSummary = formatStripeBillingSummary(
        $billingMode,
        $installmentCount,
        $termTotalAmount,
        $firstChargeAmount,
        $cycleChargeAmount,
        $cycleLabel
    );

    $content = 'Olá ' . htmlspecialchars((string) ($user['name'] ?? 'assinante'), ENT_QUOTES, 'UTF-8') . ',<br><br>'
        . 'Parabéns pela sua nova assinatura no <b>ConcursoMestre</b>.<br><br>'
        . '<b>Plano:</b> ' . htmlspecialchars($planName, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Modalidade:</b> ' . htmlspecialchars($cycleLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Duração liberada:</b> ' . htmlspecialchars($durationLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Acesso ativo até:</b> ' . htmlspecialchars($subscriptionEndLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Forma de pagamento:</b> ' . htmlspecialchars($paymentMethodLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Detalhes da cobrança:</b> ' . htmlspecialchars($paymentSummary, ENT_QUOTES, 'UTF-8') . '<br>';

    if ($transactionReference !== '') {
        $content .= '<b>ID da transação:</b> ' . htmlspecialchars($transactionReference, ENT_QUOTES, 'UTF-8') . '<br>';
    }

    $content .= $benefitsHtml;

    $bodyHtml = Mailer::htmlTemplate(
        'Assinatura confirmada',
        $content,
        buildAppHashRoute('/profile', ['tab' => 'billing']),
        'Ver assinatura'
    );

    $billingUrl = buildAppHashRoute('/profile', ['tab' => 'billing']);
    $template = resolveSystemEmailTemplate(
        'subscription_welcome',
        [
            'subject' => 'Parabéns pela sua assinatura',
            'htmlBody' => $bodyHtml,
            'textBody' => "Olá {$user['name']},\n\nSua assinatura foi confirmada.\nAcesse sua cobrança em {$billingUrl}.",
        ],
        [
            'name' => (string) ($user['name'] ?? ''),
            'email' => $email,
            'content' => $content,
            'content_html' => $content,
            'content_text' => Mailer::htmlToText($content),
            'billing_url' => $billingUrl,
            'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
        ],
        $db
    );

    if ($template['enabled']) {
        Mailer::send(
            $email,
            (string) ($user['name'] ?? 'Assinante'),
            $template['subject'],
            $template['htmlBody'],
            $template['textBody']
        );
    }
}

/**
 * Resolve o contexto comercial atual do plano para renovacao.
 *
 * @since 1.0.0
 */
function buildStripeRenewalForecast(PDO $db, array $subscriptionRow, array $planContext = []): array
{
    $planId = (int) ($planContext['id'] ?? $subscriptionRow['plan_id'] ?? 0);
    $planName = trim((string) ($planContext['name'] ?? $subscriptionRow['plan_name'] ?? 'Assinatura'));
    $intervalUnit = (string) ($planContext['interval_unit'] ?? $subscriptionRow['interval_unit'] ?? 'month');
    $intervalCount = max(1, (int) ($planContext['interval_count'] ?? $subscriptionRow['interval_count'] ?? 1));
    $planPrice = round((float) ($planContext['price'] ?? $subscriptionRow['price'] ?? $subscriptionRow['recurring_amount'] ?? 0), 2);
    $totalInstallments = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
    $paidInstallments = max(0, (int) ($subscriptionRow['paid_installments'] ?? 0));
    $hasPendingContractInstallments = $totalInstallments > 1 && $paidInstallments < $totalInstallments;
    $billingMode = $totalInstallments > 1 ? 'term_recurring' : 'single_installment';
    $renewalDate = trim((string) ($hasPendingContractInstallments
        ? ($subscriptionRow['next_renewal_date']
            ?? $subscriptionRow['provider_current_period_end']
            ?? $subscriptionRow['current_period_end']
            ?? '')
        : ($subscriptionRow['current_period_end']
            ?? $subscriptionRow['provider_current_period_end']
            ?? $subscriptionRow['next_renewal_date']
            ?? '')
    ));

    // Renovacao recorrente usa o preco vigente do plano. Cupons automaticos
    // pertencem ao checkout e nao podem zerar uma cobranca futura sem regra
    // explicita de renovacao promocional.
    $couponResult = [
        'valid' => false,
        'discount_amount' => 0,
        'coupon' => null,
        'auto_applied' => false,
    ];
    $effectivePlanPrice = $planPrice;

    if ($effectivePlanPrice <= 0) {
        $termConfig = [
            'billing_mode' => $billingMode,
            'term_cycles' => $totalInstallments,
            'commitment_cycles' => $totalInstallments,
            'selected_installment_count' => $totalInstallments,
            'charge_interval' => $intervalUnit,
            'charge_interval_count' => $intervalCount,
            'access_interval_unit' => $intervalUnit,
            'access_interval_count' => $intervalCount,
            'term_total_amount' => 0.0,
            'term_total_cents' => 0,
            'cycle_charge_amount' => 0.0,
            'cycle_charge_cents' => 0,
            'first_invoice_discount_amount' => 0.0,
            'first_invoice_discount_cents' => 0,
            'first_invoice_charge_amount' => 0.0,
            'first_invoice_charge_cents' => 0,
        ];
    } else {
        $termConfig = getStripeBillingTermConfig(
            [
                'name' => $planName,
                'price' => $planPrice,
                'interval_unit' => $intervalUnit,
                'interval_count' => $intervalCount,
            ],
            $effectivePlanPrice,
            $billingMode,
            $totalInstallments
        );
    }
    $cycleLabel = getSubscriptionCycleLabel($intervalUnit, $intervalCount);
    $priceSource = !empty($couponResult['valid']) && !empty($couponResult['auto_applied'])
        ? 'auto_coupon'
        : 'current_price';
    $contractedInstallmentAmount = round((float) (
        $subscriptionRow['next_renewal_amount']
        ?? $subscriptionRow['recurring_amount']
        ?? 0
    ), 2);
    if ($hasPendingContractInstallments && $contractedInstallmentAmount > 0) {
        $priceSource = 'contracted_installment';
    }

    $snapshot = [
        'plan_id' => $planId,
        'plan_name' => $planName,
        'interval_unit' => $intervalUnit,
        'interval_count' => $intervalCount,
        'billing_mode' => $billingMode,
        'selected_installment_count' => $totalInstallments,
        'base_amount' => round($planPrice, 2),
        'discount_amount' => round((float) ($couponResult['discount_amount'] ?? 0), 2),
        'effective_term_total_amount' => round((float) ($termConfig['term_total_amount'] ?? $effectivePlanPrice), 2),
        'effective_cycle_amount' => round((float) ($termConfig['cycle_charge_amount'] ?? $effectivePlanPrice), 2),
        'effective_first_charge_amount' => round((float) ($termConfig['first_invoice_charge_amount'] ?? $effectivePlanPrice), 2),
        'coupon_code' => (string) (($couponResult['coupon']['code'] ?? '') ?: ''),
        'coupon_label' => (string) (($couponResult['coupon']['name'] ?? $couponResult['coupon']['code'] ?? '') ?: ''),
        'price_source' => $priceSource,
        'price_source_label' => $priceSource === 'auto_coupon'
            ? 'cupom autoaplicado vigente'
            : ($priceSource === 'contracted_installment'
                ? 'parcela contratada vigente'
                : 'preco atual do plano'),
        'charge_interval' => (string) ($termConfig['charge_interval'] ?? $intervalUnit),
        'charge_interval_count' => (int) ($termConfig['charge_interval_count'] ?? $intervalCount),
    ];

    $forecastAmount = $hasPendingContractInstallments && $contractedInstallmentAmount > 0
        ? $contractedInstallmentAmount
        : round((float) ($termConfig['first_invoice_charge_amount'] ?? $effectivePlanPrice), 2);

    return [
        'amount' => $forecastAmount,
        'cycle_amount' => $forecastAmount,
        'term_total_amount' => round((float) ($termConfig['term_total_amount'] ?? $effectivePlanPrice), 2),
        'term_cycles' => max(1, (int) ($termConfig['term_cycles'] ?? $totalInstallments)),
        'billing_mode' => $billingMode,
        'date' => $renewalDate !== '' ? $renewalDate : null,
        'cycle_label' => $cycleLabel,
        'price_source' => $priceSource,
        'price_source_label' => $snapshot['price_source_label'],
        'charge_interval' => $snapshot['charge_interval'],
        'charge_interval_count' => $snapshot['charge_interval_count'],
        'snapshot' => $snapshot,
        'reminder_key' => sha1(json_encode([
            'date' => $renewalDate,
            'amount' => $forecastAmount,
            'cycle_label' => $cycleLabel,
            'price_source' => $priceSource,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
    ];
}

/**
 * Envia recibo/comprovante para pagamentos Stripe aprovados.
 *
 * @since 1.0.0
 */
function sendStripePaymentReceiptEmail(PDO $db, array $user, array $subscriptionContext, ?array $transaction = null, ?array $invoiceContext = null): void
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '') {
        return;
    }

    $planName = trim((string) ($subscriptionContext['plan_name'] ?? 'Assinatura'));
    $intervalUnit = (string) ($subscriptionContext['interval_unit'] ?? 'month');
    $intervalCount = max(1, (int) ($subscriptionContext['interval_count'] ?? 1));
    $cycleLabel = getSubscriptionCycleLabel($intervalUnit, $intervalCount);
    $amount = round((float) ($transaction['amount'] ?? $invoiceContext['amount'] ?? 0), 2);
    $paidAt = trim((string) ($invoiceContext['paid_at'] ?? $transaction['paid_at'] ?? $transaction['created_at'] ?? ''));
    $paidAtLabel = $paidAt !== '' && strtotime($paidAt) ? date('d/m/Y H:i', strtotime($paidAt)) : date('d/m/Y H:i');
    $reference = getBestTransactionReference($transaction, (string) ($invoiceContext['invoice_id'] ?? ''));
    $hostedInvoiceUrl = trim((string) ($invoiceContext['hosted_invoice_url'] ?? ''));
    $invoicePdfUrl = trim((string) ($invoiceContext['invoice_pdf'] ?? ''));
    $paymentMethodLabel = formatStripePaymentMethodLabel((string) ($subscriptionContext['payment_provider'] ?? 'stripe'));
    $receiptLink = $invoicePdfUrl !== '' ? $invoicePdfUrl : ($hostedInvoiceUrl !== '' ? $hostedInvoiceUrl : buildAppHashRoute('/profile', ['tab' => 'billing']));

    $content = 'Olá ' . htmlspecialchars((string) ($user['name'] ?? 'assinante'), ENT_QUOTES, 'UTF-8') . ',<br><br>'
        . 'Registramos com sucesso um novo pagamento da sua assinatura no <b>ConcursoMestre</b>.<br><br>'
        . '<b>Plano:</b> ' . htmlspecialchars($planName, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Modalidade:</b> ' . htmlspecialchars($cycleLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Valor pago:</b> R$ ' . htmlspecialchars(number_format($amount, 2, ',', '.'), ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Data do pagamento:</b> ' . htmlspecialchars($paidAtLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Forma de pagamento:</b> ' . htmlspecialchars($paymentMethodLabel, ENT_QUOTES, 'UTF-8') . '<br>';

    if ($reference !== '') {
        $content .= '<b>Referência:</b> ' . htmlspecialchars($reference, ENT_QUOTES, 'UTF-8') . '<br>';
    }

    if ($hostedInvoiceUrl !== '' || $invoicePdfUrl !== '') {
        $content .= '<br>Você também pode acessar o recibo direto pelo Stripe usando o botão abaixo.';
    } else {
        $content .= '<br>O histórico completo também fica disponível na sua área de cobrança dentro da plataforma.';
    }

    $bodyHtml = Mailer::htmlTemplate(
        'Pagamento confirmado',
        $content,
        $receiptLink,
        $invoicePdfUrl !== '' ? 'Baixar recibo' : 'Abrir cobrança'
    );

    $template = resolveSystemEmailTemplate(
        'subscription_payment_receipt',
        [
            'subject' => 'Recibo do seu pagamento - ' . $planName,
            'htmlBody' => $bodyHtml,
            'textBody' => "Olá {$user['name']},\n\nSeu pagamento foi confirmado.\nRecibo: {$receiptLink}",
        ],
        [
            'name' => (string) ($user['name'] ?? ''),
            'email' => $email,
            'content' => Mailer::htmlToText($content),
            'receipt_url' => $receiptLink,
            'billing_url' => buildAppHashRoute('/profile', ['tab' => 'billing']),
            'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
        ],
        $db
    );

    if ($template['enabled']) {
        Mailer::send(
            $email,
            (string) ($user['name'] ?? 'Assinante'),
            $template['subject'],
            $template['htmlBody'],
            $template['textBody']
        );
    }
}

/**
 * Envia email com orientacoes quando a cobranca Stripe falha.
 *
 * @since 1.0.0
 */
function sendStripePaymentFailureEmail(PDO $db, array $user, array $subscriptionContext, ?array $invoiceContext = null): void
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '') {
        return;
    }

    $planName = trim((string) ($subscriptionContext['plan_name'] ?? 'Assinatura'));
    $intervalUnit = (string) ($subscriptionContext['interval_unit'] ?? 'month');
    $intervalCount = max(1, (int) ($subscriptionContext['interval_count'] ?? 1));
    $cycleLabel = getSubscriptionCycleLabel($intervalUnit, $intervalCount);
    $amount = round((float) ($invoiceContext['amount'] ?? 0), 2);
    $dueDate = trim((string) ($invoiceContext['due_date'] ?? $subscriptionContext['current_period_end'] ?? ''));
    $dueDateLabel = $dueDate !== '' && strtotime($dueDate) ? date('d/m/Y', strtotime($dueDate)) : 'o mais rápido possível';

    $content = 'Olá ' . htmlspecialchars((string) ($user['name'] ?? 'assinante'), ENT_QUOTES, 'UTF-8') . ',<br><br>'
        . 'Não conseguimos concluir uma cobrança da sua assinatura no <b>ConcursoMestre</b>.<br><br>'
        . '<b>Plano:</b> ' . htmlspecialchars($planName, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Modalidade:</b> ' . htmlspecialchars($cycleLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Valor em aberto:</b> R$ ' . htmlspecialchars(number_format($amount, 2, ',', '.'), ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Prazo para regularizar:</b> ' . htmlspecialchars($dueDateLabel, ENT_QUOTES, 'UTF-8') . '<br><br>'
        . 'Para resolver:<br>'
        . '1. Acesse sua área de cobrança.<br>'
        . '2. Atualize ou troque o cartão salvo.<br>'
        . '3. Tente novamente a regularização da assinatura.<br><br>'
        . 'Enquanto a cobrança permanecer pendente, os recursos premium ficam bloqueados.';

    $bodyHtml = Mailer::htmlTemplate(
        'Falha no pagamento',
        $content,
        buildAppHashRoute('/profile', ['tab' => 'billing']),
        'Regularizar pagamento'
    );

    $billingUrl = buildAppHashRoute('/profile', ['tab' => 'billing']);
    $template = resolveSystemEmailTemplate(
        'subscription_payment_failed',
        [
            'subject' => 'Falha no pagamento da sua assinatura',
            'htmlBody' => $bodyHtml,
            'textBody' => "Olá {$user['name']},\n\nNão conseguimos concluir uma cobrança da sua assinatura.\nRegularize em: {$billingUrl}",
        ],
        [
            'name' => (string) ($user['name'] ?? ''),
            'email' => $email,
            'content' => Mailer::htmlToText($content),
            'billing_url' => $billingUrl,
            'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
        ],
        $db
    );

    if ($template['enabled']) {
        Mailer::send(
            $email,
            (string) ($user['name'] ?? 'Assinante'),
            $template['subject'],
            $template['htmlBody'],
            $template['textBody']
        );
    }
}

/**
 * Envia o lembrete preventivo da proxima renovacao.
 *
 * @since 1.0.0
 */
function sendStripeRenewalReminderEmail(PDO $db, array $user, array $subscriptionContext, array $forecast, ?array $notice = null): void
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '') {
        return;
    }

    $notice = $notice ?: [
        'template_key' => 'subscription_renewal_reminder',
        'subject' => 'Sua assinatura vai renovar em 5 dias',
        'title' => 'Renovação automática em 5 dias',
        'email_intro' => 'Este é um lembrete de que sua assinatura do <b>ConcursoMestre</b> está programada para renovar em breve.',
        'days_until' => null,
    ];

    $planName = trim((string) ($subscriptionContext['plan_name'] ?? 'Assinatura'));
    $renewalDate = trim((string) ($forecast['date'] ?? ''));
    $renewalDateLabel = $renewalDate !== '' && strtotime($renewalDate)
        ? date('d/m/Y H:i', strtotime($renewalDate))
        : 'nos próximos dias';
    $cycleLabel = trim((string) ($forecast['cycle_label'] ?? getSubscriptionCycleLabel(
        (string) ($subscriptionContext['interval_unit'] ?? 'month'),
        (int) ($subscriptionContext['interval_count'] ?? 1)
    )));
    $priceSourceLabel = trim((string) ($forecast['price_source_label'] ?? 'preço atual do plano'));
    $renewalAmount = round((float) ($forecast['amount'] ?? 0), 2);

    $content = 'Olá ' . htmlspecialchars((string) ($user['name'] ?? 'assinante'), ENT_QUOTES, 'UTF-8') . ',<br><br>'
        . (string) ($notice['email_intro'] ?? 'Sua assinatura está programada para renovar em breve.') . '<br><br>'
        . '<b>Plano:</b> ' . htmlspecialchars($planName, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Modalidade:</b> ' . htmlspecialchars($cycleLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Data prevista:</b> ' . htmlspecialchars($renewalDateLabel, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Valor previsto:</b> R$ ' . htmlspecialchars(number_format($renewalAmount, 2, ',', '.'), ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Origem do valor:</b> ' . htmlspecialchars($priceSourceLabel, ENT_QUOTES, 'UTF-8') . '<br><br>'
        . 'Se quiser manter a renovação, confira se o seu cartão salvo continua válido.';

    $bodyHtml = Mailer::htmlTemplate(
        (string) ($notice['title'] ?? 'Renovação automática'),
        $content,
        buildAppHashRoute('/profile', ['tab' => 'billing']),
        'Revisar cobrança'
    );

    $billingUrl = buildAppHashRoute('/profile', ['tab' => 'billing']);
    $template = resolveSystemEmailTemplate(
        (string) ($notice['template_key'] ?? 'subscription_renewal_reminder'),
        [
            'subject' => (string) ($notice['subject'] ?? 'Sua assinatura vai renovar em breve'),
            'htmlBody' => $bodyHtml,
            'textBody' => "Olá {$user['name']},\n\nSua assinatura vai renovar em breve.\nAcompanhe em: {$billingUrl}",
        ],
        [
            'name' => (string) ($user['name'] ?? ''),
            'email' => $email,
            'content' => Mailer::htmlToText($content),
            'plan_name' => $planName,
            'renewal_date' => $renewalDateLabel,
            'renewal_amount' => number_format($renewalAmount, 2, ',', '.'),
            'cycle_label' => $cycleLabel,
            'days_until_renewal' => isset($notice['days_until']) ? (string) $notice['days_until'] : '',
            'billing_url' => $billingUrl,
            'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
        ],
        $db
    );

    if ($template['enabled']) {
        Mailer::send(
            $email,
            (string) ($user['name'] ?? 'Assinante'),
            $template['subject'],
            $template['htmlBody'],
            $template['textBody']
        );
    }
}

/**
 * Consulta dados de verificacao do PaymentIntent.
 *
 * @since 1.0.0
 */
function getStripePaymentIntentVerificationDetails($stripe, string $paymentIntentId): array
{
    if (trim($paymentIntentId) === '') {
        return [
            'payment_intent_id' => '',
            'payment_intent_status' => '',
            'charge_id' => '',
            'cvc_check' => '',
        ];
    }

    $paymentIntent = $stripe->paymentIntents->retrieve($paymentIntentId, [
        'expand' => ['latest_charge'],
    ]);

    $charge = $paymentIntent->latest_charge ?? null;
    if (is_string($charge) && $charge !== '') {
        $charge = $stripe->charges->retrieve($charge, []);
    }

    $cardChecks = null;
    if (is_object($charge) && isset($charge->payment_method_details->card->checks)) {
        $cardChecks = $charge->payment_method_details->card->checks;
    }

    return [
        'payment_intent_id' => (string) ($paymentIntent->id ?? $paymentIntentId),
        'payment_intent_status' => (string) ($paymentIntent->status ?? ''),
        'charge_id' => is_object($charge) ? (string) ($charge->id ?? '') : '',
        'cvc_check' => trim((string) ($cardChecks->cvc_check ?? '')),
    ];
}

/**
 * Valida o resultado de CVC em cobranca com cartao salvo.
 *
 * @since 1.0.0
 */
function validateStripeSavedCardCvcResult($stripe, $subscription, $invoice = null): array
{
    $metadata = (array) ($subscription->metadata ?? []);
    $savedCardId = trim((string) ($metadata['saved_card_id'] ?? ''));

    if ($savedCardId === '') {
        return [
            'applicable' => false,
            'passed' => true,
            'payment_intent_id' => '',
            'payment_intent_status' => '',
            'charge_id' => '',
            'cvc_check' => '',
        ];
    }

    $resolvedInvoice = $invoice ?: ($subscription->latest_invoice ?? null);
    $paymentIntentId = getStripeInvoicePaymentIntentId($resolvedInvoice);

    if ($paymentIntentId === '') {
        return [
            'applicable' => true,
            'passed' => false,
            'payment_intent_id' => '',
            'payment_intent_status' => '',
            'charge_id' => '',
            'cvc_check' => '',
        ];
    }

    $verification = getStripePaymentIntentVerificationDetails($stripe, $paymentIntentId);
    $verification['applicable'] = true;
    $verification['passed'] = strtolower((string) ($verification['cvc_check'] ?? '')) === 'pass';

    return $verification;
}

/**
 * Registra falha de verificacao CVC para assinatura.
 *
 * @since 1.0.0
 */
function failStripeSavedCardCvcVerification(
    PDO $db,
    $stripe,
    string $subscriptionId,
    string $userId,
    ?int $subscriptionRowId,
    array $verification
): void {
    rejectStripeSubscriptionAfterFailedApproval(
        $db,
        $stripe,
        $subscriptionId,
        $userId,
        $subscriptionRowId,
        [
            'payment_intent_id' => $verification['payment_intent_id'] ?? '',
            'charge_id' => $verification['charge_id'] ?? '',
            'reason_codes' => ['cvc_check_failed'],
            'blocking_errors' => ['A verificacao do codigo de seguranca do cartao nao foi aprovada.'],
        ]
    );
}

/**
 * Cancela assinatura e reembolsa quando a aprovacao falha.
 *
 * @since 1.0.0
 */
function rejectStripeSubscriptionAfterFailedApproval(
    PDO $db,
    $stripe,
    string $subscriptionId,
    string $userId,
    ?int $subscriptionRowId,
    array $validationResult
): void {
    $paymentIntentId = trim((string) ($validationResult['payment_intent_id'] ?? ''));
    $chargeId = trim((string) ($validationResult['charge_id'] ?? ''));
    $reasonCodes = array_values(array_unique(array_map('strval', (array) ($validationResult['reason_codes'] ?? []))));
    $blockingErrors = array_values(array_unique(array_map('strval', (array) ($validationResult['blocking_errors'] ?? []))));
    $failureReason = !empty($blockingErrors)
        ? implode(' | ', $blockingErrors)
        : 'Pagamento bloqueado pela validacao antifraude.';
    $providerRefundId = '';
    $providerRefundDetails = [];

    if ($paymentIntentId !== '') {
        try {
            $refund = $stripe->refunds->create([
                'payment_intent' => $paymentIntentId,
                'reason' => 'requested_by_customer',
                'metadata' => [
                    'user_id' => $userId,
                    'provider_subscription_id' => $subscriptionId,
                    'refund_origin' => 'stripe_payment_validation',
                    'reason_codes' => implode(',', $reasonCodes),
                ],
            ]);
            $providerRefundId = trim((string) ($refund->id ?? ''));
            $providerRefundDetails = extractStripeRefundDetails($refund);
        } catch (Throwable $refundError) {
            error_log('Stripe antifraud refund warning: ' . $refundError->getMessage());
        }
    }

    try {
        $stripe->subscriptions->cancel($subscriptionId, []);
    } catch (Throwable $cancelError) {
        error_log('Stripe antifraud cancellation warning: ' . $cancelError->getMessage());
    }

    if ($subscriptionRowId) {
        $db->prepare("
            UPDATE user_subscriptions
            SET status = 'canceled',
                auto_renew = 0,
                cancel_at_period_end = 1,
                antifraud_blocked = 1,
                antifraud_reason = :antifraud_reason
            WHERE id = :id
        ")->execute([
            ':antifraud_reason' => $failureReason,
            ':id' => $subscriptionRowId,
        ]);
    } else {
        $db->prepare("
            UPDATE user_subscriptions
            SET status = 'canceled',
                auto_renew = 0,
                cancel_at_period_end = 1,
                antifraud_blocked = 1,
                antifraud_reason = :antifraud_reason
            WHERE provider_subscription_id = :provider_subscription_id
        ")->execute([
            ':antifraud_reason' => $failureReason,
            ':provider_subscription_id' => $subscriptionId,
        ]);
    }

    $db->prepare("
        UPDATE users
        SET plan = 'Gratuito',
            current_plan_id = NULL,
            subscription_end = NULL
        WHERE id = :user_id
    ")->execute([
        ':user_id' => $userId,
    ]);

    if ($paymentIntentId !== '') {
        $transactionRefundStatus = $providerRefundId !== '' ? 'refunded' : 'refund_requested';
        $refundedAtExpression = $providerRefundId !== '' ? 'NOW()' : 'refunded_at';

        $db->prepare("
            UPDATE transactions
            SET status = :status,
                refund_reason = :refund_reason,
                refund_requested_at = NOW(),
                refunded_at = {$refundedAtExpression},
                provider_refund_id = :provider_refund_id,
                provider_refund_details_json = :provider_refund_details_json
            WHERE provider_payment_intent_id = :provider_payment_intent_id
               OR provider_invoice_id = :provider_payment_intent_id
               OR external_id = :provider_payment_intent_id
        ")->execute([
            ':status' => $transactionRefundStatus,
            ':refund_reason' => $failureReason,
            ':provider_refund_id' => $providerRefundId,
            ':provider_refund_details_json' => json_encode($providerRefundDetails, JSON_UNESCAPED_UNICODE),
            ':provider_payment_intent_id' => $paymentIntentId,
        ]);
    }
}

/**
 * Resolve o total de ciclos do termo Stripe.
 *
 * @since 1.0.0
 */
function resolveStripeTermCycleCount(?array $subscriptionRow = null, ?array $metadata = null, ?array $plan = null): int
{
    $rowCycles = (int) ($subscriptionRow['total_installments'] ?? 0);
    if ($rowCycles > 0) {
        return $rowCycles;
    }

    $metadataCycles = (int) (($metadata['billing_term_cycles'] ?? $metadata['term_cycles'] ?? 0));
    if ($metadataCycles > 0) {
        return $metadataCycles;
    }

    if ($plan) {
        return getPlanCommitmentCycleCount(
            (string) ($plan['interval_unit'] ?? 'month'),
            (int) ($plan['interval_count'] ?? 1),
            (string) ($plan['name'] ?? '')
        );
    }

    return 1;
}

/**
 * Converte valor monetario para centavos.
 *
 * @since 1.0.0
 */
function formatMoneyToCents(float $amount): int
{
    return (int) round($amount * 100);
}

/**
 * Extrai o id de objetos Stripe ou arrays.
 *
 * @since 1.0.0
 */
function getStripeObjectId($value): string
{
    if (is_string($value)) {
        return trim($value);
    }

    if (is_object($value) && isset($value->id)) {
        return trim((string) $value->id);
    }

    if (is_object($value)) {
        try {
            $objectId = $value->id;
            if (is_scalar($objectId) && trim((string) $objectId) !== '') {
                return trim((string) $objectId);
            }
        } catch (Throwable $e) {
            // StripeObject pode expor propriedades dinamicas via __get.
        }
    }

    if ($value instanceof ArrayAccess && isset($value['id'])) {
        return trim((string) $value['id']);
    }

    if ($value instanceof ArrayAccess) {
        try {
            $arrayId = $value['id'];
            if (is_scalar($arrayId) && trim((string) $arrayId) !== '') {
                return trim((string) $arrayId);
            }
        } catch (Throwable $e) {
            // Mantem fallback sem quebrar objetos SDK que nao suportam offset direto.
        }
    }

    if (is_object($value) && method_exists($value, 'toArray')) {
        $payload = $value->toArray();
        if (is_array($payload) && !empty($payload['id'])) {
            return trim((string) $payload['id']);
        }
    }

    if (is_array($value) && !empty($value['id'])) {
        return trim((string) $value['id']);
    }

    return '';
}

/**
 * Resolve timestamps do ciclo da assinatura Stripe.
 *
 * @since 1.0.0
 */
function getStripeSubscriptionPeriodTimestamps($stripeSubscription): array
{
    $subscriptionItem = null;
    if (isset($stripeSubscription->items) && isset($stripeSubscription->items->data[0])) {
        $subscriptionItem = $stripeSubscription->items->data[0];
    }

    $startTimestamp = 0;
    if (isset($stripeSubscription->current_period_start) && is_numeric($stripeSubscription->current_period_start)) {
        $startTimestamp = (int) $stripeSubscription->current_period_start;
    } elseif ($subscriptionItem && isset($subscriptionItem->current_period_start) && is_numeric($subscriptionItem->current_period_start)) {
        $startTimestamp = (int) $subscriptionItem->current_period_start;
    }

    $endTimestamp = 0;
    if (isset($stripeSubscription->current_period_end) && is_numeric($stripeSubscription->current_period_end)) {
        $endTimestamp = (int) $stripeSubscription->current_period_end;
    } elseif ($subscriptionItem && isset($subscriptionItem->current_period_end) && is_numeric($subscriptionItem->current_period_end)) {
        $endTimestamp = (int) $subscriptionItem->current_period_end;
    }

    return [
        'start' => $startTimestamp,
        'end' => $endTimestamp,
    ];
}

/**
 * Formata timestamp para o padrao do banco.
 *
 * @since 1.0.0
 */
function formatStripeTimestampToDb(?int $timestamp, ?int $fallbackTimestamp = null): string
{
    $resolvedTimestamp = $timestamp ?: ($fallbackTimestamp ?: time());
    return date('Y-m-d H:i:s', $resolvedTimestamp);
}

/**
 * Recupera o valor recorrente da assinatura Stripe.
 *
 * @since 1.0.0
 */
function getStripeSubscriptionRecurringAmount($stripeSubscription): float
{
    $unitAmount = 0;

    if (isset($stripeSubscription->items) && isset($stripeSubscription->items->data[0]->price->unit_amount)) {
        $unitAmount = (float) $stripeSubscription->items->data[0]->price->unit_amount;
    } elseif (isset($stripeSubscription->plan) && isset($stripeSubscription->plan->amount)) {
        $unitAmount = (float) $stripeSubscription->plan->amount;
    }

    return $unitAmount > 0 ? $unitAmount / 100 : 0.0;
}

/**
 * Resolve o PaymentIntent id a partir do invoice Stripe.
 *
 * @since 1.0.0
 */
function getStripeInvoicePaymentIntentId($invoice): string
{
    if (!is_object($invoice)) {
        return '';
    }

    if (isset($invoice->payment_intent)) {
        $paymentIntentId = getStripeObjectId($invoice->payment_intent);
        if ($paymentIntentId !== '') {
            return $paymentIntentId;
        }
    }

    if (isset($invoice->payments) && isset($invoice->payments->data) && is_iterable($invoice->payments->data)) {
        foreach ($invoice->payments->data as $invoicePayment) {
            if (!isset($invoicePayment->payment)) {
                continue;
            }

            if (is_string($invoicePayment->payment) && str_starts_with($invoicePayment->payment, 'pi_')) {
                return $invoicePayment->payment;
            }

            if (!is_object($invoicePayment->payment)) {
                continue;
            }

            $paymentType = (string) ($invoicePayment->payment->type ?? '');
            if ($paymentType !== '' && $paymentType !== 'payment_intent') {
                $fallbackPaymentId = getStripeObjectId($invoicePayment->payment->payment_intent ?? null);
                if ($fallbackPaymentId !== '') {
                    return $fallbackPaymentId;
                }

                continue;
            }

            $paymentIntentId = getStripeObjectId($invoicePayment->payment->payment_intent ?? null);
            if ($paymentIntentId !== '') {
                return $paymentIntentId;
            }

            $paymentObjectId = getStripeObjectId($invoicePayment->payment);
            if (str_starts_with($paymentObjectId, 'pi_')) {
                return $paymentObjectId;
            }
        }
    }

    return '';
}

/**
 * Resolve o status do PaymentIntent a partir do invoice Stripe.
 *
 * @since 1.0.0
 */
function getStripeInvoicePaymentIntentStatus($invoice): string
{
    if (is_object($invoice) && isset($invoice->payment_intent) && is_object($invoice->payment_intent) && !empty($invoice->payment_intent->status)) {
        return (string) $invoice->payment_intent->status;
    }

    if (is_object($invoice) && isset($invoice->payments) && isset($invoice->payments->data) && is_iterable($invoice->payments->data)) {
        foreach ($invoice->payments->data as $invoicePayment) {
            if (!isset($invoicePayment->payment) || !is_object($invoicePayment->payment)) {
                continue;
            }

            $paymentType = (string) ($invoicePayment->payment->type ?? '');
            if ($paymentType !== '' && $paymentType !== 'payment_intent') {
                continue;
            }

            if (isset($invoicePayment->payment->payment_intent) && is_object($invoicePayment->payment->payment_intent) && !empty($invoicePayment->payment->payment_intent->status)) {
                return (string) $invoicePayment->payment->payment_intent->status;
            }
        }
    }

    return '';
}

/**
 * Resolve o metodo de pagamento padrao da assinatura Stripe.
 *
 * @since 1.0.0
 */
function getStripeSubscriptionDefaultPaymentMethodId($stripeSubscription): string
{
    if (isset($stripeSubscription->default_payment_method)) {
        $defaultPaymentMethodId = getStripeObjectId($stripeSubscription->default_payment_method);
        if ($defaultPaymentMethodId !== '') {
            return $defaultPaymentMethodId;
        }
    }

    if (isset($stripeSubscription->latest_invoice) && is_object($stripeSubscription->latest_invoice)) {
        $latestInvoice = $stripeSubscription->latest_invoice;

        if (isset($latestInvoice->default_payment_method)) {
            $invoicePaymentMethodId = getStripeObjectId($latestInvoice->default_payment_method);
            if ($invoicePaymentMethodId !== '') {
                return $invoicePaymentMethodId;
            }
        }

        if (isset($latestInvoice->payment_intent) && is_object($latestInvoice->payment_intent) && isset($latestInvoice->payment_intent->payment_method)) {
            $intentPaymentMethodId = getStripeObjectId($latestInvoice->payment_intent->payment_method);
            if ($intentPaymentMethodId !== '') {
                return $intentPaymentMethodId;
            }
        }
    }

    return '';
}

/**
 * Garante o produto Stripe do plano e devolve o id.
 *
 * @since 1.0.0
 */
function getOrCreateStripeProductId(PDO $db, array $plan, $stripe = null): string
{
    ensurePaymentProviderSchema($db);

    $stripe = $stripe ?: getStripeClient();
    $planId = (int) ($plan['id'] ?? 0);
    $existingProductId = trim((string) ($plan['stripe_product_id'] ?? ''));

    if ($existingProductId !== '') {
        try {
            $product = $stripe->products->retrieve($existingProductId, []);
            if ($product && empty($product->deleted)) {
                return $existingProductId;
            }
        } catch (Throwable $e) {
            $existingProductId = '';
        }
    }

    $product = $stripe->products->create([
        'name' => (string) ($plan['name'] ?? 'Plano ConcursoMestre'),
        'description' => (string) (($plan['description'] ?? '') ?: "Assinatura {$plan['name']}"),
        'metadata' => [
            'plan_id' => (string) $planId,
            'payment_provider' => 'stripe',
        ],
    ]);

    if ($planId > 0) {
        $db->prepare("UPDATE plans SET stripe_product_id = :stripe_product_id WHERE id = :plan_id")
            ->execute([
                ':stripe_product_id' => $product->id,
                ':plan_id' => $planId,
            ]);
    }

    return (string) $product->id;
}

/**
 * Cancela assinaturas Stripe incompletas antigas.
 *
 * @since 1.0.0
 */
function cancelStaleIncompleteStripeSubscriptions(PDO $db, string $userId, string $customerId, $stripe = null): void
{
    if ($customerId === '') {
        return;
    }

    $stripe = $stripe ?: getStripeClient();

    try {
        $subscriptions = $stripe->subscriptions->all([
            'customer' => $customerId,
            'status' => 'all',
            'limit' => 20,
        ]);
    } catch (Throwable $e) {
        error_log('Stripe stale subscription list error: ' . $e->getMessage());
        return;
    }

    $cancelledIds = [];
    foreach (($subscriptions->data ?? []) as $subscription) {
        $subscriptionId = trim((string) ($subscription->id ?? ''));
        $subscriptionStatus = strtolower(trim((string) ($subscription->status ?? '')));

        if ($subscriptionId === '' || $subscriptionStatus !== 'incomplete') {
            continue;
        }

        try {
            $stripe->subscriptions->cancel($subscriptionId, []);
            $cancelledIds[] = $subscriptionId;
        } catch (Throwable $e) {
            error_log('Stripe stale subscription cleanup error: ' . $e->getMessage());
        }
    }

    if (empty($cancelledIds)) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($cancelledIds), '?'));
    $params = array_merge([$userId], $cancelledIds);
    $stmt = $db->prepare("
        UPDATE user_subscriptions
        SET status = 'canceled',
            auto_renew = 0,
            cancel_at_period_end = 0,
            current_period_end = CASE
                WHEN current_period_end IS NULL OR current_period_end > NOW() THEN NOW()
                ELSE current_period_end
            END,
            provider_current_period_end = CASE
                WHEN provider_current_period_end IS NULL OR provider_current_period_end > NOW() THEN NOW()
                ELSE provider_current_period_end
            END,
            next_renewal_amount = NULL,
            next_renewal_date = NULL,
            next_renewal_price_source = NULL,
            next_renewal_cycle_label = NULL,
            next_renewal_snapshot_json = NULL
        WHERE user_id = ?
          AND payment_provider = 'stripe'
          AND provider_subscription_id IN ($placeholders)
    ");
    $stmt->execute($params);
}

/**
 * Calcula a data final da assinatura.
 *
 * @since 1.0.0
 */
function calculateSubscriptionPeriodEnd(string $intervalUnit, int $intervalCount, ?int $fromTimestamp = null): string
{
    return calculateSubscriptionPeriodRange($intervalUnit, $intervalCount, $fromTimestamp)['end'];
}
