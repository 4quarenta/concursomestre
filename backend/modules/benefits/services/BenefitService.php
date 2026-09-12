<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../config/payment_provider.php';

/**
 * Autoridade unica para Benefits. O servico nao altera users.plan, nao cria
 * assinatura Stripe e nao considera uma extensao de cobranca aplicada antes
 * de uma confirmacao explicita do provedor.
 */
final class BenefitService
{
    public const EVENT_BENEFIT_APPLIED = 'BENEFIT_APPLIED';
    public const EVENT_BENEFIT_ACCESS_GRANTED = 'BENEFIT_ACCESS_GRANTED';
    public const EVENT_BILLING_EXTENSION_CONFIRMED = 'BILLING_EXTENSION_CONFIRMED';
    public const EVENT_REFUND_RETENTION_OFFER_CREATED = 'REFUND_RETENTION_OFFER_CREATED';
    public const EVENT_REFUND_RETENTION_ACCEPTED = 'REFUND_RETENTION_ACCEPTED';
    public const EVENT_REFUND_RETENTION_DECLINED = 'REFUND_RETENTION_DECLINED';
    public const EVENT_REFUND_RETENTION_EXPIRED = 'REFUND_RETENTION_EXPIRED';
    public const EVENT_REFUND_COMPLETED = 'REFUND_COMPLETED';
    private const DOMAIN_EVENTS = [
        self::EVENT_BENEFIT_APPLIED,
        self::EVENT_BENEFIT_ACCESS_GRANTED,
        self::EVENT_BILLING_EXTENSION_CONFIRMED,
        self::EVENT_REFUND_RETENTION_OFFER_CREATED,
        self::EVENT_REFUND_RETENTION_ACCEPTED,
        self::EVENT_REFUND_RETENTION_DECLINED,
        self::EVENT_REFUND_RETENTION_EXPIRED,
        self::EVENT_REFUND_COMPLETED,
        'BENEFIT_REVOKED',
        'BENEFIT_APPLICATION_FAILED',
    ];
    private const MODES = ['ACCESS_ONLY', 'BILLING_EXTENSION_ONLY', 'ACCESS_AND_BILLING_EXTENSION'];
    private const STACKING_POLICIES = ['DENY', 'EXTEND', 'REPLACE_IF_BETTER', 'PARALLEL'];
    private const PLANS = ['Gratuito', 'Essencial', 'Pro', 'Elite'];

    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Registra somente o fato de dominio. A entrega de comunicacoes pertence
     * ao M20F-07 e nao e executada por este servico.
     */
    public function recordDomainEvent(
        string $eventType,
        ?string $userId,
        ?string $benefitGrantId,
        string $sourceType,
        ?string $sourceReference,
        array $payload,
        ?string $actorId = null
    ): string {
        $eventType = strtoupper(trim($eventType));
        if (!in_array($eventType, self::DOMAIN_EVENTS, true)) {
            throw new InvalidArgumentException('Evento de dominio de Benefit invalido.');
        }
        $sourceType = strtoupper(trim($sourceType));
        if ($sourceType === '') {
            throw new InvalidArgumentException('Origem do evento de dominio ausente.');
        }
        $safePayload = $this->sanitizeDomainPayload($payload);
        $payloadJson = json_encode($safePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $eventId = hash('sha256', implode('|', [
            $eventType,
            $userId !== null ? trim($userId) : '',
            $benefitGrantId !== null ? trim($benefitGrantId) : '',
            $sourceType,
            $sourceReference !== null ? trim($sourceReference) : '',
            $payloadJson,
        ]));
        $stmt = $this->db->prepare(
            'INSERT INTO benefit_domain_events (
                event_id, event_type, user_id, benefit_grant_id, source_type,
                source_reference, payload_json, occurred_at
            ) VALUES (
                :event_id, :event_type, :user_id, :grant_id, :source_type,
                :source_reference, :payload_json, UTC_TIMESTAMP(6)
            ) ON DUPLICATE KEY UPDATE event_id = event_id'
        );
        $stmt->execute([
            ':event_id' => $eventId,
            ':event_type' => $eventType,
            ':user_id' => $userId !== null && trim($userId) !== '' ? trim($userId) : null,
            ':grant_id' => $benefitGrantId !== null && trim($benefitGrantId) !== '' ? trim($benefitGrantId) : null,
            ':source_type' => $sourceType,
            ':source_reference' => $sourceReference !== null && trim($sourceReference) !== '' ? mb_substr(trim($sourceReference), 0, 180) : null,
            ':payload_json' => $payloadJson,
        ]);
        return $eventId;
    }

    public static function planTier(string $plan): int
    {
        return match (strtolower(trim($plan))) {
            'elite' => 4,
            'pro' => 3,
            'essencial', 'essential' => 2,
            default => 1,
        };
    }

    /**
     * Resolves paid tier plus active grants without ever restoring a stale
     * previous plan after a temporary grant expires.
     */
    public static function resolveEffectivePlan(string $paidPlan, array $activeGrants): string
    {
        $bestPlan = self::canonicalPlan($paidPlan);
        $bestTier = self::planTier($bestPlan);
        foreach ($activeGrants as $grant) {
            if (strtoupper((string) ($grant['status'] ?? '')) !== 'APPLIED') {
                continue;
            }
            $candidate = self::canonicalPlan((string) ($grant['access_plan'] ?? ''));
            $candidateTier = self::planTier($candidate);
            if ($candidateTier > $bestTier) {
                $bestPlan = $candidate;
                $bestTier = $candidateTier;
            }
        }
        return $bestPlan;
    }

    public function createDefinition(array $input, string $actorId): array
    {
        $key = $this->required($input, 'definition_key', 120);
        $name = $this->required($input, 'name', 180);
        $mode = strtoupper(trim((string) ($input['benefit_mode'] ?? '')));
        $this->assertIn($mode, self::MODES, 'Modo de Benefit invalido.');
        $accessPlan = trim((string) ($input['access_plan'] ?? ''));
        if ($mode === 'BILLING_EXTENSION_ONLY') {
            $accessPlan = '';
        } elseif ($accessPlan !== '') {
            $accessPlan = self::canonicalPlan($accessPlan);
        } elseif ($mode === 'ACCESS_ONLY' && $accessPlan === '') {
            throw new InvalidArgumentException('Benefit de acesso exige plano temporario.');
        } elseif ($mode === 'ACCESS_AND_BILLING_EXTENSION' && $accessPlan === '') {
            throw new InvalidArgumentException('Benefit de acesso e cobranca exige plano temporario.');
        }

        $accessDurationDays = max(0, (int) ($input['access_duration_days'] ?? 0));
        if (in_array($mode, ['ACCESS_ONLY', 'ACCESS_AND_BILLING_EXTENSION'], true) && $accessDurationDays < 1) {
            throw new InvalidArgumentException('Benefit de acesso exige duracao temporaria.');
        }
        if ($accessDurationDays > 3660) {
            throw new InvalidArgumentException('Duracao de acesso acima do limite operacional.');
        }

        $days = max(0, (int) ($input['billing_extension_days'] ?? 0));
        if (in_array($mode, ['BILLING_EXTENSION_ONLY', 'ACCESS_AND_BILLING_EXTENSION'], true) && $days < 1) {
            throw new InvalidArgumentException('Benefit de extensao exige pelo menos um dia.');
        }
        if ($days > 366) {
            throw new InvalidArgumentException('Extensao de cobranca acima do limite operacional.');
        }

        $stacking = strtoupper(trim((string) ($input['stacking_policy'] ?? 'DENY')));
        $this->assertIn($stacking, self::STACKING_POLICIES, 'Politica de stacking invalida.');
        $sourceScope = strtoupper(trim((string) ($input['source_scope'] ?? 'ANY')));
        $this->assertIn($sourceScope, ['ANY', 'ADMIN_MANUAL', 'MARKETING', 'SUPPORT_COMPENSATION', 'GAMIFICATION', 'CODE_REDEMPTION', 'REFUND_RETENTION_OFFER'], 'Escopo de origem invalido.');
        $startsAt = $this->nullableDate($input['starts_at'] ?? null, 'starts_at');
        $expiresAt = $this->nullableDate($input['expires_at'] ?? null, 'expires_at');
        if ($startsAt !== null && $expiresAt !== null && strtotime($expiresAt) <= strtotime($startsAt)) {
            throw new InvalidArgumentException('Janela de Benefit invalida.');
        }
        $id = self::uuid();
        $eligibility = $this->json($input['eligibility'] ?? null);

        $stmt = $this->db->prepare(
            'INSERT INTO benefit_definitions (
                id, definition_key, name, benefit_mode, access_plan,
                access_duration_days, billing_extension_days, stacking_policy, eligibility_json,
                starts_at, expires_at, active, source_scope, created_by, updated_by
            ) VALUES (
                :id, :definition_key, :name, :benefit_mode, :access_plan,
                :access_duration_days, :billing_extension_days, :stacking_policy, :eligibility_json,
                :starts_at, :expires_at, :active, :source_scope, :created_by, :updated_by
            )'
        );
        $stmt->execute([
            ':id' => $id,
            ':definition_key' => $key,
            ':name' => $name,
            ':benefit_mode' => $mode,
            ':access_plan' => $accessPlan !== '' ? $accessPlan : null,
            ':access_duration_days' => $accessDurationDays,
            ':billing_extension_days' => $days,
            ':stacking_policy' => $stacking,
            ':eligibility_json' => $eligibility,
            ':starts_at' => $startsAt,
            ':expires_at' => $expiresAt,
            ':active' => array_key_exists('active', $input) ? (!empty($input['active']) ? 1 : 0) : 1,
            ':source_scope' => $sourceScope,
            ':created_by' => $actorId,
            ':updated_by' => $actorId,
        ]);
        $this->audit(null, null, $actorId, 'definition.created', ['definition_key' => $key, 'mode' => $mode]);

        return ['id' => $id, 'definition_key' => $key, 'benefit_mode' => $mode, 'access_plan' => $accessPlan ?: null, 'access_duration_days' => $accessDurationDays, 'billing_extension_days' => $days];
    }

    public function createCode(array $input, string $actorId): array
    {
        $definitionId = $this->required($input, 'benefit_definition_id', 36);
        $rawCode = trim((string) ($input['code'] ?? ''));
        if (strlen($rawCode) < 8 || strlen($rawCode) > 128) {
            throw new InvalidArgumentException('Codigo de Benefit deve ter entre 8 e 128 caracteres.');
        }
        $scope = strtoupper(trim((string) ($input['code_scope'] ?? 'PUBLIC')));
        $this->assertIn($scope, ['PUBLIC', 'SEGMENT', 'USER_EXCLUSIVE', 'SINGLE_USE'], 'Escopo de codigo invalido.');
        $assignedUser = trim((string) ($input['assigned_user_id'] ?? ''));
        if ($scope === 'USER_EXCLUSIVE' && $assignedUser === '') {
            throw new InvalidArgumentException('Codigo exclusivo exige usuario vinculado.');
        }
        $segmentId = trim((string) ($input['segment_id'] ?? ''));
        if ($scope === 'SEGMENT' && $segmentId === '') {
            throw new InvalidArgumentException('Codigo segmentado exige segmento vinculado.');
        }
        $codeStartsAt = $this->nullableDate($input['starts_at'] ?? null, 'starts_at');
        $codeExpiresAt = $this->nullableDate($input['expires_at'] ?? null, 'expires_at');
        if ($codeStartsAt !== null && $codeExpiresAt !== null && strtotime($codeExpiresAt) <= strtotime($codeStartsAt)) {
            throw new InvalidArgumentException('Janela de codigo invalida.');
        }
        $codeStacking = !empty($input['stacking_policy']) ? strtoupper((string) $input['stacking_policy']) : null;
        if ($codeStacking !== null) {
            $this->assertIn($codeStacking, self::STACKING_POLICIES, 'Politica de stacking do codigo invalida.');
        }
        $this->assertDefinitionExists($definitionId);
        if ($scope === 'SINGLE_USE') {
            $input['max_total_redemptions'] = 1;
            $input['max_redemptions_per_user'] = 1;
        }
        $id = self::uuid();
        $hash = hash('sha256', self::normalizeCode($rawCode));
        $stmt = $this->db->prepare(
            'INSERT INTO benefit_codes (
                id, benefit_definition_id, code_hash, code_hint, code_scope,
                assigned_user_id, segment_id, campaign_id, starts_at, expires_at,
                max_total_redemptions, max_redemptions_per_user, stacking_policy,
                status, created_by, updated_by
            ) VALUES (
                :id, :definition_id, :code_hash, :code_hint, :code_scope,
                :assigned_user_id, :segment_id, :campaign_id, :starts_at, :expires_at,
                :max_total_redemptions, :max_redemptions_per_user, :stacking_policy,
                :status, :created_by, :updated_by
            )'
        );
        $stmt->execute([
            ':id' => $id,
            ':definition_id' => $definitionId,
            ':code_hash' => $hash,
            ':code_hint' => substr($rawCode, -4),
            ':code_scope' => $scope,
            ':assigned_user_id' => $assignedUser !== '' ? $assignedUser : null,
            ':segment_id' => $segmentId !== '' ? $segmentId : null,
            ':campaign_id' => !empty($input['campaign_id']) ? (string) $input['campaign_id'] : null,
            ':starts_at' => $codeStartsAt,
            ':expires_at' => $codeExpiresAt,
            ':max_total_redemptions' => isset($input['max_total_redemptions']) ? max(1, (int) $input['max_total_redemptions']) : null,
            ':max_redemptions_per_user' => isset($input['max_redemptions_per_user']) ? max(1, (int) $input['max_redemptions_per_user']) : 1,
            ':stacking_policy' => $codeStacking,
            ':status' => 'ACTIVE',
            ':created_by' => $actorId,
            ':updated_by' => $actorId,
        ]);
        $this->audit(null, $id, $actorId, 'code.created', ['scope' => $scope, 'code_hint' => substr($rawCode, -4)]);

        // O segredo cru só existe neste retorno de criação e não é persistido.
        return ['id' => $id, 'code' => $rawCode, 'code_hint' => substr($rawCode, -4), 'scope' => $scope];
    }

    public function grant(string $userId, string $definitionId, array $input, string $actorId): array
    {
        $idempotencyKey = $this->normalizeIdempotency($input['idempotency_key'] ?? '');
        $this->db->beginTransaction();
        try {
            $existing = $this->findGrantByIdempotency($idempotencyKey, true);
            if ($existing) {
                $this->db->commit();
                return $existing;
            }
            $existing = $this->findGrantByStackingIdempotency($idempotencyKey, true);
            if ($existing) {
                $this->db->commit();
                return $existing;
            }
            $definition = $this->findDefinition($definitionId, true);
            if (!$definition) {
                throw new OutOfBoundsException('Benefit nao encontrado.');
            }
            if ((int) ($definition['active'] ?? 0) !== 1) {
                throw new DomainException('Benefit inativo nao pode ser concedido.');
            }
            $now = gmdate('Y-m-d H:i:s');
            $this->assertWindow((string) ($definition['starts_at'] ?? ''), (string) ($definition['expires_at'] ?? ''), $now, 'Benefit fora da janela de disponibilidade.');
            $this->assertStackingPolicy($userId, $definition, (string) $definition['stacking_policy'], $now);
            $grant = $this->extendExistingAccessGrantIfApplicable($userId, $definition, (string) $definition['stacking_policy'], $now, $idempotencyKey)
                ?? $this->insertGrant($userId, $definition, $input, $actorId, $idempotencyKey);
            if (strtoupper((string) ($grant['status'] ?? '')) === 'APPLIED') {
                $this->recordDomainEvent(
                    strtoupper((string) ($definition['benefit_mode'] ?? '')) === 'ACCESS_ONLY'
                        ? self::EVENT_BENEFIT_ACCESS_GRANTED
                        : self::EVENT_BENEFIT_APPLIED,
                    $userId,
                    (string) $grant['id'],
                    (string) ($input['source_type'] ?? 'ADMIN_MANUAL'),
                    !empty($input['source_reference']) ? (string) $input['source_reference'] : null,
                    [
                        'benefit_mode' => $definition['benefit_mode'],
                        'access_plan' => $definition['access_plan'] ?? null,
                        'billing_extension_days' => (int) ($grant['billing_extension_days'] ?? 0),
                    ],
                    $actorId
                );
            }
            $this->db->commit();
            return $grant;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Concede uma compensacao legada sem alterar plano, assinatura ou Stripe
     * diretamente. A extensao de cobranca fica pendente ate a confirmacao do
     * provedor; contas sem assinatura Stripe recebem somente acesso temporario.
     */
    public function grantSupportCompensation(string $userId, int $days, array $input, string $actorId): array
    {
        if (trim($userId) === '' || $days < 1 || $days > 366) {
            throw new InvalidArgumentException('Compensacao de suporte invalida.');
        }

        $subscription = $this->findCurrentSubscription($userId);
        $paidPlan = self::canonicalPlan((string) ($subscription['plan_name'] ?? 'Gratuito'));
        $requestedAccessPlan = self::canonicalPlan((string) ($input['access_plan'] ?? ''));
        $ticketReference = trim((string) ($input['ticket_reference'] ?? ''));
        $reason = trim((string) ($input['reason'] ?? ''));
        if ($ticketReference === '' || strlen($ticketReference) > 160) {
            throw new InvalidArgumentException('Ticket ou referencia obrigatoria para compensacao.');
        }
        if ($reason === '' || strlen($reason) > 500) {
            throw new InvalidArgumentException('Motivo obrigatorio para compensacao.');
        }
        $forceTemporaryAccess = $requestedAccessPlan !== 'Gratuito';
        $hasStripeSubscription = $subscription !== null
            && normalizePaymentProvider((string) ($subscription['payment_provider'] ?? '')) === 'stripe'
            && trim((string) ($subscription['provider_subscription_id'] ?? '')) !== ''
            && in_array(strtolower((string) ($subscription['status'] ?? '')), ['active', 'trialing', 'past_due'], true);
        $mode = $forceTemporaryAccess || !$hasStripeSubscription ? 'ACCESS_ONLY' : 'BILLING_EXTENSION_ONLY';
        $idempotencyInput = trim((string) ($input['idempotency_key'] ?? ''));
        if ($idempotencyInput === '') {
            $idempotencyInput = implode('|', [
                'support-compensation',
                $userId,
                $days,
                $requestedAccessPlan,
                $ticketReference,
            ]);
        }
        $idempotencyKey = hash('sha256', $idempotencyInput);
        $existingGrant = $this->findGrantByIdempotency($idempotencyKey);
        if ($existingGrant) {
            $existingMode = ((int) ($existingGrant['billing_extension_days'] ?? 0)) > 0
                ? 'BILLING_EXTENSION_ONLY'
                : 'ACCESS_ONLY';
            $this->audit((string) $existingGrant['id'], null, $actorId, 'support_compensation.idempotent_replay', [
                'idempotency_key' => $idempotencyKey,
                'ticket_reference' => $ticketReference,
            ]);
            return [
                'grant' => $existingGrant,
                'mode' => $existingMode,
                'paid_plan' => $paidPlan,
                'provider_required' => $existingMode === 'BILLING_EXTENSION_ONLY',
            ];
        }
        $definitionKey = 'support-compensation-' . hash('sha256', $idempotencyInput);
        $definition = $this->createDefinition([
            'definition_key' => $definitionKey,
            'name' => 'Compensacao de suporte',
            'benefit_mode' => $mode,
            'access_plan' => $mode === 'ACCESS_ONLY' ? ($forceTemporaryAccess ? $requestedAccessPlan : $paidPlan) : null,
            'access_duration_days' => $mode === 'ACCESS_ONLY' ? $days : 0,
            'billing_extension_days' => $mode === 'BILLING_EXTENSION_ONLY' ? $days : 0,
            'stacking_policy' => 'EXTEND',
            'source_scope' => 'SUPPORT_COMPENSATION',
            'active' => 1,
        ], $actorId);

        $grant = $this->grant($userId, (string) $definition['id'], [
            'source_type' => 'SUPPORT_COMPENSATION',
            'source_reference' => $ticketReference,
            'reason' => $reason,
            'idempotency_key' => $idempotencyInput,
            'metadata' => [
                'legacy_action' => 'add_days',
                'operator_id' => $actorId,
                'ticket_reference' => $ticketReference,
            ],
        ], $actorId);

        if ($mode === 'BILLING_EXTENSION_ONLY' && !empty($input['apply_provider'])) {
            require_once __DIR__ . '/../../../modules/billing/services/BillingExtensionService.php';
            $grant = (new BillingExtensionService($this->db))->apply((string) $grant['id'], $actorId);
        }

        $after = $this->getUserEntitlement($userId);
        $this->audit((string) ($grant['id'] ?? ''), null, $actorId, 'support_compensation.created', [
            'source_type' => 'SUPPORT_COMPENSATION',
            'ticket_reference' => $ticketReference,
            'reason' => $reason,
            'operator_id' => $actorId,
            'idempotency_key' => $idempotencyKey,
            'days' => $days,
            'mode' => $mode,
            'paid_plan_before' => $paidPlan,
            'paid_plan_after' => $after['paid_plan'] ?? $paidPlan,
            'effective_access_before' => $paidPlan,
            'effective_access_after' => $after['effective_access'] ?? $paidPlan,
            'billing_period_before' => $subscription['provider_current_period_end'] ?? $subscription['current_period_end'] ?? null,
            'billing_period_after' => $after['provider_current_period_end'] ?? null,
            'provider_status' => $grant['provider_status'] ?? null,
        ]);

        return [
            'grant' => $grant,
            'mode' => $mode,
            'paid_plan' => $paidPlan,
            'provider_required' => $hasStripeSubscription,
        ];
    }

    public function getGrant(string $grantId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM benefit_grants WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => trim($grantId)]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function markProviderApplying(string $grantId, string $actorId, ?string $oldPeriodEnd = null): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE benefit_grants
             SET status = 'APPLYING', provider_status = 'APPLYING',
                 provider_old_period_end = COALESCE(provider_old_period_end, :old_period_end), updated_at = NOW()
             WHERE id = :id AND status IN ('PENDING_PROVIDER', 'FAILED', 'RECONCILIATION_REQUIRED')"
        );
        $stmt->execute([':id' => $grantId, ':old_period_end' => $oldPeriodEnd]);
        if ($stmt->rowCount() > 0) {
            $this->audit($grantId, null, $actorId, 'billing_extension.provider_applying', []);
            return true;
        }
        return false;
    }

    public function markProviderFailure(string $grantId, string $actorId, string $status, string $reason): void
    {
        $normalizedStatus = in_array($status, ['FAILED', 'RECONCILIATION_REQUIRED'], true) ? $status : 'FAILED';
        $stmt = $this->db->prepare(
            "UPDATE benefit_grants
             SET status = :status, provider_status = :provider_status,
                 reason = :reason, updated_at = NOW()
             WHERE id = :id AND status IN ('PENDING_PROVIDER', 'APPLYING', 'RECONCILIATION_REQUIRED')"
        );
        $stmt->execute([
            ':status' => $normalizedStatus,
            ':provider_status' => $normalizedStatus,
            ':reason' => mb_substr(trim($reason), 0, 500),
            ':id' => $grantId,
        ]);
        if ($stmt->rowCount() > 0) {
            $this->audit($grantId, null, $actorId, 'billing_extension.provider_failed', [
                'status' => $normalizedStatus,
                'reason' => mb_substr(trim($reason), 0, 500),
            ]);
            $grant = $this->getGrant($grantId);
            if ($grant) {
                $this->recordDomainEvent(
                    'BENEFIT_APPLICATION_FAILED',
                    (string) $grant['user_id'],
                    $grantId,
                    (string) ($grant['source_type'] ?? 'BENEFIT'),
                    (string) ($grant['source_reference'] ?? ''),
                    ['status' => $normalizedStatus],
                    $actorId
                );
            }
        }
    }

    /** Campaigns reference Benefits; this service owns the actual grant. */
    public function grantMarketingBenefit(string $userId, string $benefitReference, array $input, string $actorId): array
    {
        $reference = trim($benefitReference);
        if ($reference === '') {
            throw new InvalidArgumentException('Referencia de Benefit de marketing ausente.');
        }
        $stmt = $this->db->prepare('SELECT id, source_scope, active FROM benefit_definitions WHERE id = :id OR definition_key = :definition_key LIMIT 1');
        $stmt->execute([':id' => $reference, ':definition_key' => $reference]);
        $definition = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$definition || (int) ($definition['active'] ?? 0) !== 1) {
            throw new OutOfBoundsException('Benefit de marketing nao encontrado.');
        }
        $sourceScope = strtoupper((string) ($definition['source_scope'] ?? ''));
        if (!in_array($sourceScope, ['ANY', 'MARKETING'], true)) {
            throw new DomainException('Benefit nao habilitado para origem de marketing.');
        }
        return $this->grant($userId, (string) $definition['id'], [
            'source_type' => 'MARKETING',
            'source_reference' => (string) ($input['campaign_reference'] ?? 'marketing'),
            'reason' => (string) ($input['reason'] ?? 'Benefit concedido por campanha.'),
            'idempotency_key' => $input['idempotency_key'] ?? '',
            'metadata' => ['campaign_reference' => (string) ($input['campaign_reference'] ?? '')],
        ], $actorId);
    }

    public function redeemCode(string $userId, string $rawCode, string $idempotencyKey, ?string $now = null): array
    {
        $attempt = 0;
        while (true) {
            try {
                return $this->redeemCodeOnce($userId, $rawCode, $idempotencyKey, $now);
            } catch (PDOException $e) {
                if (!$this->isRetryableTransactionConflict($e)) {
                    throw $e;
                }
                if ($attempt >= 2) {
                    throw new DomainException('Nao foi possivel concluir o resgate agora. Tente novamente.', 0, $e);
                }
                $attempt++;
                usleep(25000 * $attempt);
            }
        }
    }

    private function redeemCodeOnce(string $userId, string $rawCode, string $idempotencyKey, ?string $now = null): array
    {
        $idempotencyKey = $this->normalizeIdempotency($idempotencyKey);
        $normalizedCode = self::normalizeCode($rawCode);
        if ($normalizedCode === '') {
            throw new InvalidArgumentException('Informe um codigo de Benefit.');
        }
        $effectiveNow = $now ?: gmdate('Y-m-d H:i:s');

        $this->db->beginTransaction();
        try {
            $existingRedemption = $this->findRedemption($idempotencyKey, true);
            if ($existingRedemption) {
                $this->db->commit();
                return $existingRedemption;
            }
            $stmt = $this->db->prepare('SELECT * FROM benefit_codes WHERE code_hash = :code_hash FOR UPDATE');
            $stmt->execute([':code_hash' => hash('sha256', $normalizedCode)]);
            $code = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$code || strtoupper((string) $code['status']) !== 'ACTIVE') {
                throw new InvalidArgumentException('Codigo de Benefit invalido ou inativo.');
            }
            $this->assertWindow((string) ($code['starts_at'] ?? ''), (string) ($code['expires_at'] ?? ''), $effectiveNow, 'Codigo fora da janela de resgate.');
            if (strtoupper((string) $code['code_scope']) === 'USER_EXCLUSIVE' && (string) $code['assigned_user_id'] !== $userId) {
                throw new DomainException('Codigo exclusivo nao pertence a este usuario.');
            }
            $total = $this->countRedemptions((string) $code['id'], null, true);
            $perUser = $this->countRedemptions((string) $code['id'], $userId, true);
            if ($code['max_total_redemptions'] !== null && $total >= (int) $code['max_total_redemptions']) {
                throw new DomainException('Limite total de resgates atingido.');
            }
            if ($code['max_redemptions_per_user'] !== null && $perUser >= (int) $code['max_redemptions_per_user']) {
                throw new DomainException('Limite de resgates por usuario atingido.');
            }

            $definition = $this->findDefinition((string) $code['benefit_definition_id'], true);
            if (!$definition || (int) ($definition['active'] ?? 0) !== 1) {
                throw new OutOfBoundsException('Benefit do codigo nao encontrado.');
            }
            $this->assertWindow((string) ($definition['starts_at'] ?? ''), (string) ($definition['expires_at'] ?? ''), $effectiveNow, 'Benefit fora da janela de disponibilidade.');
            $stackingPolicy = (string) ($code['stacking_policy'] ?: $definition['stacking_policy']);
            $this->assertStackingPolicy($userId, $definition, $stackingPolicy, $effectiveNow);
            $grant = $this->extendExistingAccessGrantIfApplicable($userId, $definition, $stackingPolicy, $effectiveNow, $idempotencyKey)
                ?? $this->insertGrant($userId, $definition, [
                'source_type' => 'CODE_REDEMPTION',
                'source_reference' => (string) $code['id'],
                'reason' => 'Benefit Code redemption',
                'grant_starts_at' => $effectiveNow,
                ], $userId, $idempotencyKey);
            $insert = $this->db->prepare('INSERT INTO benefit_code_redemptions (benefit_code_id, benefit_grant_id, user_id, idempotency_key) VALUES (:code_id, :grant_id, :user_id, :idempotency_key)');
            $insert->execute([':code_id' => $code['id'], ':grant_id' => $grant['id'], ':user_id' => $userId, ':idempotency_key' => $idempotencyKey]);
            $this->audit($grant['id'], $code['id'], $userId, 'code.redeemed', ['code_hint' => $code['code_hint'], 'grant_status' => $grant['status']]);
            $this->db->commit();
            return ['redemption_idempotency_key' => $idempotencyKey, 'grant' => $grant, 'code_hint' => $code['code_hint']];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function listUserBenefits(string $userId, ?string $now = null): array
    {
        $now = $now ?: gmdate('Y-m-d H:i:s');
        $stmt = $this->db->prepare(
            "SELECT g.id, g.source_type, g.source_reference, g.status, g.access_plan,
                    g.billing_extension_days, g.grant_starts_at, g.grant_expires_at,
                    g.provider_status, g.provider_old_period_end, g.provider_new_period_end,
                    d.definition_key, d.name, d.benefit_mode, d.stacking_policy
             FROM benefit_grants g
             INNER JOIN benefit_definitions d ON d.id = g.benefit_definition_id
             WHERE g.user_id = :user_id
               AND g.status = 'APPLIED'
               AND g.grant_starts_at <= :now_start
               AND (g.grant_expires_at IS NULL OR g.grant_expires_at > :now_end)
             ORDER BY g.grant_starts_at DESC, g.id DESC"
        );
        $stmt->execute([':user_id' => $userId, ':now_start' => $now, ':now_end' => $now]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function listDefinitions(): array
    {
        $stmt = $this->db->query(
            "SELECT id, definition_key, name, benefit_mode, access_plan,
                    access_duration_days, billing_extension_days, stacking_policy, starts_at, expires_at,
                    active, source_scope, created_at, updated_at
             FROM benefit_definitions
             ORDER BY active DESC, created_at DESC, id DESC"
        );
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findDefinitionByKey(string $definitionKey): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM benefit_definitions WHERE definition_key = :definition_key LIMIT 1');
        $stmt->execute([':definition_key' => trim($definitionKey)]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function getUserEntitlement(string $userId, ?string $now = null): array
    {
        $stmt = $this->db->prepare(
            "SELECT COALESCE(p.name, u.plan, 'Gratuito') AS paid_plan,
                    us.status AS subscription_status,
                    us.provider_current_period_end,
                    us.current_period_end
             FROM users u
             LEFT JOIN user_subscriptions us ON us.id = (
                 SELECT us2.id FROM user_subscriptions us2
                 WHERE us2.user_id = u.id
                 ORDER BY CASE WHEN us2.status IN ('active','trialing','past_due','cancel_at_period_end') THEN 0 ELSE 1 END, us2.id DESC
                 LIMIT 1
             )
             LEFT JOIN plans p ON p.id = us.plan_id
             WHERE u.id = :user_id LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['paid_plan' => 'Gratuito'];
        $grants = $this->listUserBenefits($userId, $now);
        return [
            'paid_plan' => self::canonicalPlan((string) ($row['paid_plan'] ?? 'Gratuito')),
            'effective_access' => self::resolveEffectivePlan((string) ($row['paid_plan'] ?? 'Gratuito'), $grants),
            'subscription_status' => $row['subscription_status'] ?? null,
            'provider_current_period_end' => $row['provider_current_period_end'] ?? $row['current_period_end'] ?? null,
            'active_grants' => $grants,
        ];
    }

    public function confirmProviderBillingExtension(string $grantId, string $providerReference, string $oldPeriodEnd, string $newPeriodEnd, string $actorId): array
    {
        $old = strtotime($oldPeriodEnd);
        $new = strtotime($newPeriodEnd);
        if (!$old || !$new || $new <= $old || trim($providerReference) === '') {
            throw new InvalidArgumentException('Confirmacao de extensao do provedor invalida.');
        }
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('SELECT * FROM benefit_grants WHERE id = :id FOR UPDATE');
            $stmt->execute([':id' => $grantId]);
            $grant = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$grant) {
                throw new OutOfBoundsException('Grant nao encontrado.');
            }
            if ((int) $grant['billing_extension_days'] < 1) {
                throw new InvalidArgumentException('Grant nao possui extensao de cobranca.');
            }
            $definition = $this->findDefinition((string) $grant['benefit_definition_id']);
            $minimumNewPeriod = $old + ((int) $grant['billing_extension_days'] * 86400);
            if (!$definition || $new < $minimumNewPeriod) {
                throw new InvalidArgumentException('O novo periodo do provedor nao comprova a extensao concedida.');
            }
            if (strtoupper((string) $grant['status']) === 'APPLIED') {
                $this->db->commit();
                return $grant;
            }
            $update = $this->db->prepare(
                "UPDATE benefit_grants SET status = 'APPLIED', provider_status = 'CONFIRMED',
                    provider_reference = :reference, provider_old_period_end = :old_end,
                    provider_new_period_end = :new_end, applied_at = NOW(), updated_at = NOW()
                 WHERE id = :id AND status IN ('PENDING_PROVIDER', 'APPLYING', 'RECONCILIATION_REQUIRED')"
            );
            $update->execute([':reference' => $providerReference, ':old_end' => date('Y-m-d H:i:s', $old), ':new_end' => date('Y-m-d H:i:s', $new), ':id' => $grantId]);
            $this->audit($grantId, null, $actorId, 'billing_extension.provider_confirmed', ['provider_reference' => $providerReference, 'old_period_end' => date('Y-m-d H:i:s', $old), 'new_period_end' => date('Y-m-d H:i:s', $new)]);
            $this->recordDomainEvent(self::EVENT_BILLING_EXTENSION_CONFIRMED, (string) $grant['user_id'], $grantId, (string) ($grant['source_type'] ?? 'BENEFIT'), (string) ($grant['source_reference'] ?? ''), [
                'billing_extension_days' => (int) $grant['billing_extension_days'],
                'old_period_end' => date('Y-m-d H:i:s', $old),
                'new_period_end' => date('Y-m-d H:i:s', $new),
                'provider_reference' => $providerReference,
            ], $actorId);
            $this->db->commit();
            $grant['status'] = 'APPLIED';
            $grant['provider_status'] = 'CONFIRMED';
            $grant['provider_reference'] = $providerReference;
            $grant['provider_old_period_end'] = date('Y-m-d H:i:s', $old);
            $grant['provider_new_period_end'] = date('Y-m-d H:i:s', $new);
            return $grant;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function revokeGrant(string $grantId, string $actorId, string $reason): void
    {
        $stmt = $this->db->prepare("UPDATE benefit_grants SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW(), reason = :reason WHERE id = :id AND status IN ('APPLIED','PENDING_PROVIDER')");
        $stmt->execute([':reason' => mb_substr(trim($reason), 0, 500), ':id' => $grantId]);
        if ($stmt->rowCount() > 0) {
            $this->audit($grantId, null, $actorId, 'grant.revoked', ['reason' => mb_substr(trim($reason), 0, 500)]);
            $grant = $this->getGrant($grantId);
            if ($grant) {
                $this->recordDomainEvent('BENEFIT_REVOKED', (string) $grant['user_id'], $grantId, (string) ($grant['source_type'] ?? 'BENEFIT'), (string) ($grant['source_reference'] ?? ''), ['reason' => mb_substr(trim($reason), 0, 500)], $actorId);
            }
        }
    }

    public function buildSupportCompensationRequest(array $input, string $operatorId): array
    {
        $source = strtoupper(trim((string) ($input['source'] ?? '')));
        if ($source !== 'SUPPORT_COMPENSATION') {
            throw new InvalidArgumentException('Origem de compensacao invalida.');
        }
        $reference = $this->required($input, 'ticket_reference', 160);
        $reason = $this->required($input, 'reason', 500);
        $idempotency = $this->normalizeIdempotency($input['idempotency_key'] ?? '');
        return ['source' => $source, 'ticket_reference' => $reference, 'reason' => $reason, 'operator_id' => $operatorId, 'idempotency_key' => $idempotency, 'benefit_definition_id' => $this->required($input, 'benefit_definition_id', 36)];
    }

    public function buildMarketingBenefitRequest(array $input, string $operatorId): array
    {
        $campaignReference = $this->required($input, 'campaign_reference', 160);
        return [
            'source' => 'MARKETING',
            'campaign_reference' => $campaignReference,
            'benefit_definition_id' => $this->required($input, 'benefit_definition_id', 36),
            'idempotency_key' => $this->normalizeIdempotency($input['idempotency_key'] ?? ''),
            'operator_id' => $operatorId,
        ];
    }

    public function buildLevelRewardRequest(array $input, string $operatorId): array
    {
        $level = (int) ($input['level'] ?? 0);
        if ($level < 1 || $level > 1000) {
            throw new InvalidArgumentException('Nivel de recompensa invalido.');
        }
        return [
            'source' => 'LEVEL_REWARD',
            'level' => $level,
            'benefit_definition_id' => $this->required($input, 'benefit_definition_id', 36),
            'idempotency_key' => $this->normalizeIdempotency($input['idempotency_key'] ?? ''),
            'operator_id' => $operatorId,
            'feature_state' => 'DISABLED_PENDING_GATES',
        ];
    }

    private function insertGrant(string $userId, array $definition, array $input, string $actorId, string $idempotencyKey): array
    {
        $mode = strtoupper((string) $definition['benefit_mode']);
        $days = (int) $definition['billing_extension_days'];
        $needsProvider = in_array($mode, ['BILLING_EXTENSION_ONLY', 'ACCESS_AND_BILLING_EXTENSION'], true);
        $status = $needsProvider ? 'PENDING_PROVIDER' : 'APPLIED';
        $grantId = self::uuid();
        $starts = (string) ($input['grant_starts_at'] ?? gmdate('Y-m-d H:i:s'));
        $expires = $input['grant_expires_at'] ?? $definition['expires_at'] ?? null;
        if ((int) ($definition['access_duration_days'] ?? 0) > 0) {
            $startDate = new DateTimeImmutable($starts, new DateTimeZone('UTC'));
            $durationExpires = $startDate->modify('+' . (int) $definition['access_duration_days'] . ' days')->format('Y-m-d H:i:s');
            if ($expires === null || strtotime((string) $expires) > strtotime($durationExpires)) {
                $expires = $durationExpires;
            }
        }
        $stmt = $this->db->prepare(
            'INSERT INTO benefit_grants (
                id, benefit_definition_id, user_id, source_type, source_reference,
                idempotency_key, status, access_plan, billing_extension_days,
                grant_starts_at, grant_expires_at, provider_status, granted_by,
                reason, metadata_json, applied_at
            ) VALUES (
                :id, :definition_id, :user_id, :source_type, :source_reference,
                :idempotency_key, :status, :access_plan, :billing_extension_days,
                :grant_starts_at, :grant_expires_at, :provider_status, :granted_by,
                :reason, :metadata_json, :applied_at
            )'
        );
        $stmt->execute([
            ':id' => $grantId,
            ':definition_id' => $definition['id'],
            ':user_id' => $userId,
            ':source_type' => strtoupper(trim((string) ($input['source_type'] ?? 'ADMIN_MANUAL'))),
            ':source_reference' => !empty($input['source_reference']) ? (string) $input['source_reference'] : null,
            ':idempotency_key' => $idempotencyKey,
            ':status' => $status,
            ':access_plan' => $definition['access_plan'] ?: null,
            ':billing_extension_days' => $days,
            ':grant_starts_at' => $starts,
            ':grant_expires_at' => $expires,
            ':provider_status' => $needsProvider ? 'PENDING' : 'NOT_REQUIRED',
            ':granted_by' => $actorId,
            ':reason' => !empty($input['reason']) ? mb_substr(trim((string) $input['reason']), 0, 500) : null,
            ':metadata_json' => $this->json($input['metadata'] ?? null),
            ':applied_at' => $needsProvider ? null : $starts,
        ]);
        $this->audit($grantId, null, $actorId, 'grant.created', ['source_type' => $input['source_type'] ?? 'ADMIN_MANUAL', 'status' => $status, 'billing_extension_days' => $days]);
        return ['id' => $grantId, 'status' => $status, 'access_plan' => $definition['access_plan'] ?: null, 'billing_extension_days' => $days, 'grant_starts_at' => $starts, 'grant_expires_at' => $expires];
    }

    private function assertStackingPolicy(string $userId, array $definition, string $policy, string $now): void
    {
        $policy = strtoupper(trim($policy));
        $this->assertIn($policy, self::STACKING_POLICIES, 'Politica de stacking invalida.');
        switch ($policy) {
            case 'DENY':
                $stmt = $this->db->prepare("SELECT COUNT(*) FROM benefit_grants WHERE user_id = :user_id AND benefit_definition_id = :definition_id AND status = 'APPLIED' AND grant_starts_at <= :now_start AND (grant_expires_at IS NULL OR grant_expires_at > :now_end)");
                $stmt->execute([':user_id' => $userId, ':definition_id' => $definition['id'], ':now_start' => $now, ':now_end' => $now]);
                if ((int) $stmt->fetchColumn() > 0) {
                    throw new DomainException('Este Benefit ja esta ativo para o usuario.');
                }
                return;
            case 'EXTEND':
                // Access periods are merged below; provider effects remain separate grants.
                return;
            case 'PARALLEL':
                // Independent grants keep their own audit, expiry and provider lifecycle.
                return;
            case 'REPLACE_IF_BETTER':
                $candidatePlan = self::canonicalPlan((string) ($definition['access_plan'] ?? ''));
                if ($candidatePlan === 'Gratuito') {
                    throw new DomainException('Benefit sem plano de acesso nao possui comparacao objetiva.');
                }
                $stmt = $this->db->prepare(
                    "SELECT id, access_plan
                     FROM benefit_grants
                     WHERE user_id = :user_id
                       AND status = 'APPLIED'
                       AND access_plan IS NOT NULL
                       AND grant_starts_at <= :now_start
                       AND (grant_expires_at IS NULL OR grant_expires_at > :now_end)
                     FOR UPDATE"
                );
                $stmt->execute([':user_id' => $userId, ':now_start' => $now, ':now_end' => $now]);
                $candidateRank = self::planTier($candidatePlan);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $existing) {
                    $existingRank = self::planTier(self::canonicalPlan((string) ($existing['access_plan'] ?? '')));
                    if ($existingRank >= $candidateRank) {
                        throw new DomainException('Benefit atual possui nivel igual ou superior.');
                    }
                    $this->db->prepare("UPDATE benefit_grants SET status = 'REVOKED', revoked_at = UTC_TIMESTAMP(6), updated_at = UTC_TIMESTAMP(6), reason = :reason WHERE id = :id AND status = 'APPLIED'")
                        ->execute([':reason' => 'Substituido por Benefit de nivel superior.', ':id' => $existing['id']]);
                    $this->audit((string) $existing['id'], null, $userId, 'grant.replaced', [
                        'replacement_definition_id' => (string) $definition['id'],
                        'replacement_access_plan' => $candidatePlan,
                    ]);
                }
                return;
        }
    }

    private function extendExistingAccessGrantIfApplicable(string $userId, array $definition, string $policy, string $now, string $idempotencyKey): ?array
    {
        if (strtoupper(trim($policy)) !== 'EXTEND' || strtoupper((string) ($definition['benefit_mode'] ?? '')) !== 'ACCESS_ONLY') {
            return null;
        }
        $stmt = $this->db->prepare(
            "SELECT *
             FROM benefit_grants
             WHERE user_id = :user_id
               AND benefit_definition_id = :definition_id
               AND status = 'APPLIED'
               AND grant_starts_at <= :now_start
               AND (grant_expires_at IS NULL OR grant_expires_at > :now_end)
             ORDER BY grant_expires_at DESC, id DESC
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':definition_id' => $definition['id'],
            ':now_start' => $now,
            ':now_end' => $now,
        ]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            return null;
        }
        $expiresAt = trim((string) ($existing['grant_expires_at'] ?? ''));
        $extensionDays = max(1, (int) ($definition['access_duration_days'] ?? 0));
        if ($expiresAt === '' || $extensionDays < 1) {
            throw new DomainException('Benefit EXTEND exige periodo de acesso com duracao definida.');
        }
        $expiryDate = new DateTimeImmutable($expiresAt, new DateTimeZone('UTC'));
        $newExpiresAt = $expiryDate->modify('+' . $extensionDays . ' days')->format('Y-m-d H:i:s');
        $this->db->prepare('UPDATE benefit_grants SET grant_expires_at = :expires_at, updated_at = UTC_TIMESTAMP(6) WHERE id = :id')
            ->execute([':expires_at' => $newExpiresAt, ':id' => $existing['id']]);
        $this->audit((string) $existing['id'], null, $userId, 'grant.stacking_extended', [
            'idempotency_key' => $idempotencyKey,
            'previous_expires_at' => $expiresAt,
            'new_expires_at' => $newExpiresAt,
            'extension_days' => $extensionDays,
        ]);
        $existing['grant_expires_at'] = $newExpiresAt;
        return [
            'id' => (string) $existing['id'],
            'status' => 'APPLIED',
            'access_plan' => $existing['access_plan'] ?? ($definition['access_plan'] ?: null),
            'billing_extension_days' => (int) ($existing['billing_extension_days'] ?? 0),
            'grant_starts_at' => $existing['grant_starts_at'],
            'grant_expires_at' => $newExpiresAt,
        ];
    }

    private function isRetryableTransactionConflict(PDOException $exception): bool
    {
        $errorInfo = $exception->errorInfo ?? [];
        $driverCode = (int) ($errorInfo[1] ?? 0);
        $message = strtolower($exception->getMessage());
        return in_array($driverCode, [1205, 1213, 40001], true)
            || str_contains($message, 'sqlstate[40001]')
            || str_contains($message, 'deadlock')
            || str_contains($message, 'lock wait timeout');
    }

    private function findGrantByStackingIdempotency(string $key, bool $forUpdate = false): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT g.*
             FROM benefit_audit_events a
             INNER JOIN benefit_grants g ON g.id = a.benefit_grant_id
             WHERE a.action = 'grant.stacking_extended'
               AND JSON_UNQUOTE(JSON_EXTRACT(a.details_json, '$.idempotency_key')) = :key
             ORDER BY a.id DESC
             LIMIT 1" . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function findDefinition(string $id, bool $forUpdate = false): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM benefit_definitions WHERE id = :id' . ($forUpdate ? ' FOR UPDATE' : ''));
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function sanitizeDomainPayload(array $payload): array
    {
        $blocked = ['password', 'secret', 'token', 'authorization', 'api_key', 'card', 'cvc', 'payment_method'];
        $sanitize = static function (mixed $value) use (&$sanitize, $blocked): mixed {
            if (!is_array($value)) {
                return is_scalar($value) || $value === null ? $value : (string) $value;
            }
            $result = [];
            foreach ($value as $key => $item) {
                $keyString = strtolower((string) $key);
                foreach ($blocked as $blockedKey) {
                    if (str_contains($keyString, $blockedKey)) {
                        continue 2;
                    }
                }
                $result[(string) $key] = $sanitize($item);
            }
            return $result;
        };
        return $sanitize($payload);
    }

    private function findCurrentSubscription(string $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT us.*, p.name AS plan_name
             FROM user_subscriptions us
             LEFT JOIN plans p ON p.id = us.plan_id
             WHERE us.user_id = :user_id
               AND us.status IN ('active', 'trialing', 'past_due', 'cancel_at_period_end')
             ORDER BY us.id DESC
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function assertDefinitionExists(string $id): void
    {
        if (!$this->findDefinition($id)) {
            throw new OutOfBoundsException('Benefit nao encontrado.');
        }
    }

    private function findGrantByIdempotency(string $key, bool $forUpdate = false): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM benefit_grants WHERE idempotency_key = :key' . ($forUpdate ? ' FOR UPDATE' : ''));
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function findRedemption(string $key, bool $forUpdate = false): ?array
    {
        $stmt = $this->db->prepare('SELECT r.*, g.status AS grant_status FROM benefit_code_redemptions r INNER JOIN benefit_grants g ON g.id = r.benefit_grant_id WHERE r.idempotency_key = :key' . ($forUpdate ? ' FOR UPDATE' : ''));
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function countRedemptions(string $codeId, ?string $userId, bool $forUpdate = false): int
    {
        $sql = 'SELECT COUNT(*) FROM benefit_code_redemptions WHERE benefit_code_id = :code_id';
        $params = [':code_id' => $codeId];
        if ($userId !== null) {
            $sql .= ' AND user_id = :user_id';
            $params[':user_id'] = $userId;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }

    private function audit(?string $grantId, ?string $codeId, ?string $actorId, string $action, array $details): void
    {
        $stmt = $this->db->prepare('INSERT INTO benefit_audit_events (benefit_grant_id, benefit_code_id, actor_user_id, action, details_json) VALUES (:grant_id, :code_id, :actor_id, :action, :details)');
        $stmt->execute([':grant_id' => $grantId, ':code_id' => $codeId, ':actor_id' => $actorId, ':action' => $action, ':details' => $this->json($details)]);
    }

    private function assertWindow(string $startsAt, string $expiresAt, string $now, string $message): void
    {
        $nowTs = strtotime($now) ?: time();
        if ($startsAt !== '' && strtotime($startsAt) > $nowTs) {
            throw new DomainException($message);
        }
        if ($expiresAt !== '' && strtotime($expiresAt) <= $nowTs) {
            throw new DomainException($message);
        }
    }

    private static function canonicalPlan(string $plan): string
    {
        $normalized = strtolower(trim($plan));
        return match ($normalized) {
            'elite' => 'Elite',
            'pro' => 'Pro',
            'essencial', 'essential' => 'Essencial',
            default => 'Gratuito',
        };
    }

    private function required(array $input, string $key, int $maxLength): string
    {
        $value = trim((string) ($input[$key] ?? ''));
        if ($value === '' || strlen($value) > $maxLength) {
            throw new InvalidArgumentException('Campo obrigatorio invalido: ' . $key . '.');
        }
        return $value;
    }

    private function nullableDate($value, string $field): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $normalized = trim((string) $value);
        if (strtotime($normalized) === false) {
            throw new InvalidArgumentException('Data invalida: ' . $field . '.');
        }
        return $normalized;
    }

    private function assertIn(string $value, array $allowed, string $message): void
    {
        if (!in_array($value, $allowed, true)) {
            throw new InvalidArgumentException($message);
        }
    }

    private function normalizeIdempotency($value): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            throw new InvalidArgumentException('Idempotency key obrigatoria.');
        }
        return hash('sha256', $value);
    }

    private static function normalizeCode(string $code): string
    {
        return strtoupper(preg_replace('/\s+/', '', trim($code)) ?: '');
    }

    private function json($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            throw new InvalidArgumentException('JSON de Benefit invalido.');
        }
        return $encoded;
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
