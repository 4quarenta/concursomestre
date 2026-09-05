<?php

declare(strict_types=1);

final class MarketingCampaignService
{
    private const STATUSES = ['draft', 'scheduled', 'active', 'paused', 'ended', 'archived'];
    private const OBJECTIVES = ['CRIAR_CONTA', 'INICIAR_TESTE', 'ESCOLHER_PLANO', 'ASSINAR_PRO', 'ASSINAR_ELITE', 'FAZER_SIMULADO', 'RESPONDER_QUESTOES', 'REATIVAR_USUARIO', 'UPGRADE_PLANO'];
    private const INTERACTIONS = ['impression', 'dismissal', 'cta_clicked'];
    private const CHANNELS = ['in_app', 'email', 'notification', 'banner'];
    private const PLACEMENTS = ['topbar', 'home-hero', 'question-sidebar', 'practice-sidebar', 'checkout', 'marketplace', 'plans', 'promo'];
    private const RULE_FIELDS = ['account_age_days', 'plan', 'role'];
    private const RULE_OPERATORS = ['eq', 'neq', 'gte', 'lte'];

    public function __construct(private readonly MarketingCampaignRepository $repository)
    {
        $this->repository->ensureSchema();
    }

    public function listCampaigns(?string $search, ?string $status): array
    {
        return $this->repository->listCampaigns($search, $status);
    }

    public function listSegments(?string $search): array
    {
        return $this->repository->listSegments($search);
    }

    public function evaluateSegment(string $segmentId, ?string $userId): array
    {
        $segment = $this->repository->findSegment($segmentId);
        if ($segment === null) {
            throw new InvalidArgumentException('Segmento nao encontrado.');
        }
        if ($userId === null || trim($userId) === '') {
            return ['eligible' => false, 'reason' => 'USER_CONTEXT_REQUIRED', 'matchedRules' => [], 'segmentId' => $segmentId];
        }
        if ((string) $segment['status'] !== 'active') {
            return ['eligible' => false, 'reason' => 'SEGMENT_NOT_ACTIVE', 'matchedRules' => [], 'segmentId' => $segmentId];
        }
        $profile = $this->repository->findUserProfile($userId);
        if ($profile === null) {
            return ['eligible' => false, 'reason' => 'USER_NOT_FOUND', 'matchedRules' => [], 'segmentId' => $segmentId];
        }
        $rules = $this->normalizeRules($segment['rules_json'] ?? []);
        $matchedRules = [];
        foreach ($rules as $rule) {
            $actual = $this->segmentValue($profile, (string) $rule['field']);
            $matched = $this->compareRule($actual, (string) $rule['operator'], $rule['value']);
            $matchedRules[] = ['field' => $rule['field'], 'operator' => $rule['operator'], 'expected' => $rule['value'], 'actual' => $actual, 'matched' => $matched];
            if (!$matched) {
                return ['eligible' => false, 'reason' => 'RULE_MISMATCH', 'matchedRules' => $matchedRules, 'segmentId' => $segmentId];
            }
        }
        return ['eligible' => true, 'reason' => 'ALL_RULES_MATCHED', 'matchedRules' => $matchedRules, 'segmentId' => $segmentId];
    }

    public function listPublicCampaigns(): array
    {
        return $this->repository->listPublicCampaigns();
    }

    public function saveSegment(array $payload, string $adminUserId): array
    {
        $id = trim((string) ($payload['id'] ?? ''));
        if ($id === '') {
            $id = $this->uuid();
        }
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('O segmento precisa de um nome.');
        }
        $status = strtolower(trim((string) ($payload['status'] ?? 'draft')));
        if (!in_array($status, ['draft', 'active', 'paused', 'archived'], true)) {
            throw new InvalidArgumentException('Status de segmento invalido.');
        }
        $rules = $this->normalizeRules($payload['rules'] ?? $payload['rules_json'] ?? []);
        return $this->repository->saveSegment([
            'id' => $id, 'name' => mb_substr($name, 0, 160),
            'description' => mb_substr(trim((string) ($payload['description'] ?? '')), 0, 500),
            'status' => $status, 'rules_json' => $this->json($rules),
            'created_by' => $adminUserId, 'updated_by' => $adminUserId,
        ]);
    }

    public function saveCampaign(array $payload, string $adminUserId): array
    {
        $id = trim((string) ($payload['id'] ?? '')) ?: $this->uuid();
        $name = trim((string) ($payload['name'] ?? ''));
        $objective = strtoupper(trim((string) ($payload['objective'] ?? '')));
        $status = strtolower(trim((string) ($payload['status'] ?? 'draft')));
        if ($name === '' || mb_strlen($name) > 180) throw new InvalidArgumentException('Nome de campanha invalido.');
        if (!in_array($objective, self::OBJECTIVES, true)) throw new InvalidArgumentException('Objetivo de campanha invalido.');
        if (!in_array($status, self::STATUSES, true)) throw new InvalidArgumentException('Status de campanha invalido.');

        $startsAt = $this->nullableDate($payload['starts_at'] ?? $payload['startsAt'] ?? null);
        $endsAt = $this->nullableDate($payload['ends_at'] ?? $payload['endsAt'] ?? null);
        if ($startsAt !== null && $endsAt !== null && $startsAt >= $endsAt) throw new InvalidArgumentException('A data final precisa ser posterior a inicial.');
        if ($status === 'active' && $startsAt !== null && $startsAt > gmdate('Y-m-d H:i:s.u')) throw new InvalidArgumentException('Campanha futura deve usar status scheduled.');
        $segmentId = trim((string) ($payload['segment_id'] ?? $payload['segmentId'] ?? '')) ?: null;
        if ($segmentId !== null && $this->repository->findSegment($segmentId) === null) throw new InvalidArgumentException('Segmento relacionado nao encontrado.');

        $channels = $this->normalizeStringList($payload['channels'] ?? [], self::CHANNELS);
        $placements = $this->normalizeStringList($payload['placements'] ?? [], self::PLACEMENTS);
        if ($channels === []) throw new InvalidArgumentException('Informe ao menos um canal.');
        if ($placements === []) throw new InvalidArgumentException('Informe ao menos um placement.');

        return $this->repository->saveCampaign([
            'id' => $id, 'name' => mb_substr($name, 0, 180), 'objective' => $objective, 'status' => $status,
            'priority' => max(0, min(10000, (int) ($payload['priority'] ?? 0))), 'starts_at' => $startsAt, 'ends_at' => $endsAt,
            'segment_id' => $segmentId, 'rules_json' => $this->json($this->normalizeRules($payload['rules'] ?? [])),
            'channels_json' => $this->json($channels), 'placements_json' => $this->json($placements),
            'content_json' => $this->json($this->normalizeContent($payload['content'] ?? [])),
            'landing_slug' => $this->nullableString($payload['landing_slug'] ?? $payload['landingSlug'] ?? null, 160),
            'offer_json' => $this->nullableJson($this->normalizeReferenceObject($payload['offer'] ?? null)), 'plan_id' => $this->nullableInt($payload['plan_id'] ?? $payload['planId'] ?? null),
            'coupon_code' => $this->nullableString($payload['coupon_code'] ?? $payload['couponCode'] ?? null, 120),
            'tracking_json' => $this->nullableJson($this->normalizeReferenceObject($payload['tracking'] ?? null)),
            'frequency_cap' => $this->nullablePositiveInt($payload['frequency_cap'] ?? $payload['frequencyCap'] ?? null),
            'cooldown_hours' => $this->nullablePositiveInt($payload['cooldown_hours'] ?? $payload['cooldownHours'] ?? null),
            'max_impressions' => $this->nullablePositiveInt($payload['max_impressions'] ?? $payload['maxImpressions'] ?? null),
            'mutual_exclusion_group' => $this->nullableString($payload['mutual_exclusion_group'] ?? $payload['mutualExclusionGroup'] ?? null, 120),
            'suppress_after_conversion' => !array_key_exists('suppress_after_conversion', $payload) || (bool) $payload['suppress_after_conversion'],
            'created_by' => $adminUserId, 'updated_by' => $adminUserId,
        ]);
    }

    public function transition(string $id, string $nextStatus, string $adminUserId): array
    {
        $campaign = $this->repository->findCampaign($id);
        if ($campaign === null) throw new InvalidArgumentException('Campanha nao encontrada.');
        $nextStatus = strtolower(trim($nextStatus));
        if (!in_array($nextStatus, self::STATUSES, true)) throw new InvalidArgumentException('Status de campanha invalido.');
        $current = (string) $campaign['status'];
        $allowed = [
            'draft' => ['draft', 'scheduled', 'active', 'archived'], 'scheduled' => ['scheduled', 'active', 'paused', 'ended', 'archived'],
            'active' => ['active', 'paused', 'ended', 'archived'], 'paused' => ['paused', 'active', 'ended', 'archived'],
            'ended' => ['ended', 'archived'], 'archived' => ['archived'],
        ];
        if (!in_array($nextStatus, $allowed[$current] ?? [], true)) throw new InvalidArgumentException('Transicao de campanha nao permitida.');
        return $this->repository->updateCampaignStatus($id, $nextStatus, $adminUserId);
    }

    public function recordInteraction(array $payload, ?string $userId = null): array
    {
        $campaignId = trim((string) ($payload['campaign_id'] ?? $payload['campaignId'] ?? ''));
        $type = strtolower(trim((string) ($payload['interaction_type'] ?? $payload['interactionType'] ?? '')));
        $campaign = $this->repository->findCampaign($campaignId);
        if ($campaign === null) throw new InvalidArgumentException('Campanha nao encontrada.');
        if (!in_array((string) $campaign['status'], ['active', 'scheduled'], true)) throw new InvalidArgumentException('Campanha nao esta disponivel.');
        $now = time();
        if ($campaign['starts_at'] !== null && strtotime((string) $campaign['starts_at']) > $now) throw new InvalidArgumentException('Campanha ainda nao iniciou.');
        if ($campaign['ends_at'] !== null && strtotime((string) $campaign['ends_at']) <= $now) throw new InvalidArgumentException('Campanha encerrada.');
        if (!in_array($type, self::INTERACTIONS, true)) throw new InvalidArgumentException('Interacao de campanha invalida.');
        $sessionKey = trim((string) ($payload['session_key'] ?? $payload['sessionKey'] ?? ''));
        if ($userId === null && $sessionKey === '') throw new InvalidArgumentException('Contexto de sessao ausente.');
        $attribution = [];
        foreach (['landing_id', 'placement', 'cta_id', 'source', 'plan_id'] as $key) {
            if (isset($payload[$key]) && is_scalar($payload[$key])) $attribution[$key] = mb_substr(trim((string) $payload[$key]), 0, 80);
        }
        $idempotency = hash('sha256', implode('|', [$campaignId, $userId ?? '', hash('sha256', $sessionKey), $type, $this->json($attribution)]));
        $created = $this->repository->insertInteraction([
            'campaign_id' => $campaignId, 'user_id' => $userId, 'session_key_hash' => $sessionKey !== '' ? hash('sha256', $sessionKey) : null,
            'interaction_type' => $type, 'idempotency_key' => $idempotency, 'attribution_json' => $this->json($attribution),
        ]);
        return ['recorded' => $created, 'idempotencyKey' => $idempotency];
    }

    public function analytics(string $campaignId): array
    {
        if ($this->repository->findCampaign($campaignId) === null) throw new InvalidArgumentException('Campanha nao encontrada.');
        return $this->repository->getCampaignAnalytics($campaignId);
    }

    public function delete(string $id): void
    {
        $campaign = $this->repository->findCampaign($id);
        if ($campaign === null) throw new InvalidArgumentException('Campanha nao encontrada.');
        if (!str_starts_with($id, 'm20f02-')) throw new InvalidArgumentException('Campanhas operacionais devem ser arquivadas, nao removidas.');
        $this->repository->deleteCampaign($id);
    }

    private function normalizeRules(mixed $rules): array
    {
        if (!is_array($rules)) return [];
        $normalized = [];
        foreach (array_slice($rules, 0, 20) as $rule) {
            if (!is_array($rule)) throw new InvalidArgumentException('Regra de segmento invalida.');
            $field = trim((string) ($rule['field'] ?? ''));
            $operator = strtolower(trim((string) ($rule['operator'] ?? '')));
            if (!in_array($field, self::RULE_FIELDS, true) || !in_array($operator, self::RULE_OPERATORS, true)) throw new InvalidArgumentException('Campo ou operador de segmento invalido.');
            $value = $rule['value'] ?? null;
            if (!is_scalar($value) || trim((string) $value) === '') throw new InvalidArgumentException('Valor de regra de segmento invalido.');
            $normalized[] = ['field' => $field, 'operator' => $operator, 'value' => mb_substr(trim((string) $value), 0, 80)];
        }
        return $normalized;
    }

    private function normalizeStringList(mixed $value, array $allowed = []): array
    {
        $items = is_array($value) ? $value : (preg_split('/[,\n]+/', (string) $value) ?: []);
        $normalized = array_values(array_unique(array_filter(array_map(static fn($item): string => mb_substr(trim((string) $item), 0, 80), $items))));
        if ($allowed !== [] && array_diff($normalized, $allowed) !== []) throw new InvalidArgumentException('Canal ou placement de campanha invalido.');
        return $normalized;
    }

    private function nullableDate(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') return null;
        $timestamp = strtotime($value);
        if ($timestamp === false) throw new InvalidArgumentException('Data de campanha invalida.');
        return gmdate('Y-m-d H:i:s.u', $timestamp);
    }

    private function nullableString(mixed $value, int $max): ?string
    {
        $value = trim((string) ($value ?? ''));
        return $value === '' ? null : mb_substr($value, 0, $max);
    }

    private function nullableInt(mixed $value): ?int
    {
        return trim((string) ($value ?? '')) === '' ? null : max(0, (int) $value);
    }

    private function nullablePositiveInt(mixed $value): ?int
    {
        return trim((string) ($value ?? '')) === '' ? null : max(0, (int) $value);
    }

    private function nullableJson(mixed $value): ?string
    {
        return is_array($value) && $value !== [] ? $this->json($value) : null;
    }

    private function normalizeContent(mixed $value): array
    {
        if (!is_array($value)) return [];
        $content = [];
        foreach (['headline' => 180, 'description' => 500, 'ctaLabel' => 80] as $key => $max) {
            if (isset($value[$key]) && is_scalar($value[$key])) $content[$key] = mb_substr(trim((string) $value[$key]), 0, $max);
        }
        return $content;
    }

    private function normalizeReferenceObject(mixed $value): array
    {
        if (!is_array($value)) return [];
        $normalized = [];
        foreach (['plan_id', 'coupon_code', 'benefit_ref', 'campaign_id', 'landing_slug'] as $key) {
            if (isset($value[$key]) && is_scalar($value[$key])) $normalized[$key] = mb_substr(trim((string) $value[$key]), 0, 120);
        }
        return $normalized;
    }

    private function segmentValue(array $profile, string $field): mixed
    {
        if ($field === 'account_age_days') return max(0, (int) floor((time() - strtotime((string) $profile['created_at'])) / 86400));
        return $profile[$field] ?? null;
    }

    private function compareRule(mixed $actual, string $operator, mixed $expected): bool
    {
        $numeric = is_numeric($actual) && is_numeric($expected);
        if ($numeric) { $actual = (float) $actual; $expected = (float) $expected; }
        else { $actual = strtolower(trim((string) $actual)); $expected = strtolower(trim((string) $expected)); }
        return match ($operator) {
            'eq' => $actual === $expected,
            'neq' => $actual !== $expected,
            'gte' => $actual >= $expected,
            'lte' => $actual <= $expected,
            default => false,
        };
    }

    private function json(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function uuid(): string
    {
        return 'm20f02-' . bin2hex(random_bytes(16));
    }
}
