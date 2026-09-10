<?php

declare(strict_types=1);

require_once __DIR__ . '/../repositories/SubscriptionsRepository.php';
require_once __DIR__ . '/../validators/SubscriptionsValidator.php';

/**
 * Autoridade unica para mudancas de plano sobre uma assinatura Stripe existente.
 */
final class CanonicalPlanChangeService
{
    public function __construct(
        private readonly PDO $db,
        private readonly SubscriptionsRepository $repository,
        private readonly SubscriptionsValidator $validator,
        private readonly Closure $reconcile
    ) {
    }

    public function changePlan(string $userId, array $data): array
    {
        $payload = $this->validator->validatePlanChangePayload($data);
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado no backend.');
        }
        $target = $this->repository->findPlanById($payload['plan_id']);
        if (!$target || !$this->isActive($target)) {
            throw new OutOfBoundsException('Plano de destino nao encontrado ou inativo.');
        }

        $providerMutation = false;
        $this->db->beginTransaction();
        try {
            $subscription = $this->repository->findLatestManagedSubscription($userId, true);
            if (!$subscription || trim((string) ($subscription['provider_subscription_id'] ?? '')) === '') {
                throw new OutOfBoundsException('Nenhuma assinatura Stripe ativa encontrada.');
            }
            $currentPlanId = (int) ($subscription['plan_id'] ?? 0);
            $stripe = getStripeClient();
            $targetPriceId = $this->resolvePrice($stripe, $target);
            $providerId = (string) $subscription['provider_subscription_id'];
            $before = $stripe->subscriptions->retrieve($providerId, ['expand' => ['items.data.price', 'schedule']]);
            $metadata = $this->normalizeMetadata($before->metadata ?? []);
            $providerPriceId = getStripeObjectId($before->items->data[0]->price ?? null);
            if ($currentPlanId === (int) $target['id'] && $providerPriceId === $targetPriceId) {
                $this->db->commit();
                return $this->result('NOOP', ($metadata['plan_change_id'] ?? '') === $payload['idempotency_key'] ? 'idempotent_replay' : 'already_current', $subscription, $target, $metadata['scheduled_effective_at'] ?? $subscription['current_period_end'] ?? null);
            }
            $operation = (int) ($target['tier'] ?? 0) >= (int) ($subscription['tier'] ?? 0)
                ? 'UPGRADE'
                : 'SCHEDULED_DOWNGRADE';
            if (($metadata['plan_change_id'] ?? '') === $payload['idempotency_key'] && $providerPriceId === $targetPriceId) {
                $this->db->commit();
                return $this->result($operation, 'idempotent_replay', $subscription, $target, $metadata['scheduled_effective_at'] ?? $subscription['current_period_end'] ?? null);
            }

            $periods = getStripeSubscriptionPeriodTimestamps($before);
            $beforeStart = formatStripeTimestampToDb((int) ($periods['start'] ?? 0));
            $beforeEnd = formatStripeTimestampToDb((int) ($periods['end'] ?? 0));
            $item = $before->items->data[0] ?? null;
            $itemId = is_object($item) ? trim((string) ($item->id ?? '')) : '';
            if ($itemId === '') {
                throw new RuntimeException('A assinatura Stripe nao possui item de preco atual.');
            }

            if ($operation === 'UPGRADE') {
                $scheduleId = getStripeObjectId($before->schedule ?? null);
                if ($scheduleId !== '') {
                    try { $stripe->subscriptionSchedules->release($scheduleId, []); } catch (Throwable $error) { throw new RuntimeException('Nao foi possivel cancelar o schedule anterior.', 0, $error); }
                }
                $providerMutation = true;
                $stripe->subscriptionItems->update($itemId, [
                    'price' => $targetPriceId,
                    'proration_behavior' => 'none',
                ], ['idempotency_key' => 'plan_change_' . $payload['idempotency_key']]);
                $stripe->subscriptions->update($providerId, [
                    'metadata' => [
                        'user_id' => $userId,
                        'plan_id' => (string) $target['id'],
                        'plan_name' => (string) $target['name'],
                        'plan_change_id' => $payload['idempotency_key'],
                        'plan_change_operation' => 'UPGRADE',
                        'reconciliation_state' => 'CONFIRMED',
                    ],
                ], ['idempotency_key' => 'plan_change_metadata_' . $payload['idempotency_key']]);
                $after = $stripe->subscriptions->retrieve($providerId, ['expand' => ['items.data.price', 'schedule']]);
                if (getStripeObjectId($after->items->data[0]->price ?? null) !== $targetPriceId) {
                    throw new RuntimeException('Stripe nao confirmou o preco do upgrade.');
                }
                $afterPeriods = getStripeSubscriptionPeriodTimestamps($after);
                $afterStart = formatStripeTimestampToDb((int) ($afterPeriods['start'] ?? 0), (int) ($periods['start'] ?? 0));
                $afterEnd = formatStripeTimestampToDb((int) ($afterPeriods['end'] ?? 0), (int) ($periods['end'] ?? 0));
                $this->repository->updateSubscriptionPlanState((int) $subscription['id'], (int) $target['id'], (float) $target['price'], $afterStart, $afterEnd, $afterStart, $afterEnd);
                $this->repository->updateUserPlanAssignment($userId, (int) $target['id'], canonicalUserPlanValue((string) $target['name']), $afterEnd);
                $subscription['plan_id'] = (int) $target['id'];
                $effectiveAt = $afterEnd;
                $afterPriceId = $targetPriceId;
                $afterStartAudit = $afterStart;
                $afterEndAudit = $afterEnd;
            } else {
                if ($beforeEnd === '' || strtotime($beforeEnd) <= time()) {
                    throw new DomainException('A assinatura nao possui periodo futuro para agendar o downgrade.');
                }
                $scheduleId = getStripeObjectId($before->schedule ?? null);
                if ($scheduleId === '') {
                    $providerMutation = true;
                    $schedule = $stripe->subscriptionSchedules->create(['from_subscription' => $providerId], ['idempotency_key' => 'plan_change_schedule_' . $payload['idempotency_key']]);
                    $scheduleId = (string) ($schedule->id ?? '');
                }
                if ($scheduleId === '') {
                    throw new RuntimeException('Stripe nao criou o schedule do downgrade.');
                }
                $providerMutation = true;
                $stripe->subscriptionSchedules->update($scheduleId, [
                    'end_behavior' => 'release',
                    'phases' => [
                        ['start_date' => (int) ($periods['start'] ?? 0), 'end_date' => (int) ($periods['end'] ?? 0), 'proration_behavior' => 'none', 'items' => [$this->currentItemPayload($before)]],
                        ['start_date' => (int) ($periods['end'] ?? 0), 'iterations' => 1, 'proration_behavior' => 'none', 'items' => [['price' => $targetPriceId, 'quantity' => max(1, (int) ($item->quantity ?? 1))]], 'metadata' => ['user_id' => $userId, 'plan_id' => (string) $target['id'], 'plan_name' => (string) $target['name'], 'plan_change_id' => $payload['idempotency_key'], 'plan_change_operation' => 'SCHEDULED_DOWNGRADE', 'reconciliation_state' => 'SCHEDULED']],
                    ],
                    'metadata' => ['user_id' => $userId, 'pending_plan_id' => (string) $target['id'], 'pending_plan_name' => (string) $target['name'], 'plan_change_id' => $payload['idempotency_key'], 'plan_change_operation' => 'SCHEDULED_DOWNGRADE', 'scheduled_effective_at' => $beforeEnd, 'reconciliation_state' => 'SCHEDULED'],
                ], ['idempotency_key' => 'plan_change_schedule_update_' . $payload['idempotency_key']]);
                $snapshot = json_encode(['scheduled_plan_change' => ['operation' => 'SCHEDULED_DOWNGRADE', 'target_plan_id' => (int) $target['id'], 'target_plan_name' => (string) $target['name'], 'effective_at' => $beforeEnd, 'idempotency_key' => $payload['idempotency_key'], 'provider_schedule_id' => $scheduleId, 'reconciliation_state' => 'SCHEDULED']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $this->repository->updateSubscriptionPlanState((int) $subscription['id'], $currentPlanId, (float) ($subscription['recurring_amount'] ?? $subscription['price'] ?? 0), $beforeStart, $beforeEnd, $beforeStart, $beforeEnd, $scheduleId, $snapshot !== false ? $snapshot : null);
                $effectiveAt = $beforeEnd;
                $afterPriceId = getStripeObjectId($item->price ?? null);
                $afterStartAudit = $beforeStart;
                $afterEndAudit = $beforeEnd;
            }

            $this->audit($userId, $subscription, $target, $operation, [
                'provider_state_before' => ['price_id' => getStripeObjectId($item->price ?? null), 'period_start' => $beforeStart, 'period_end' => $beforeEnd],
                'provider_state_after' => ['price_id' => $afterPriceId, 'period_start' => $afterStartAudit, 'period_end' => $afterEndAudit],
                'period_before' => $beforeEnd,
                'period_after' => $effectiveAt,
                'scheduled_effective_at' => $operation === 'UPGRADE' ? null : $effectiveAt,
                'result' => 'CONFIRMED',
                'reconciliation_state' => $operation === 'UPGRADE' ? 'CONFIRMED' : 'SCHEDULED',
                'idempotency_key' => $payload['idempotency_key'],
            ]);
            $this->db->commit();
            return $this->result($operation, 'confirmed', $subscription, $target, $effectiveAt);
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            if ($providerMutation) {
                try { ($this->reconcile)($userId); } catch (Throwable $reconcileError) { error_log('[subscriptions_service] plan change reconciliation failed: ' . $reconcileError->getMessage()); }
            }
            throw $error;
        }
    }

    private function isActive(array $plan): bool
    {
        foreach (['active', 'is_active'] as $key) if (array_key_exists($key, $plan)) return filter_var($plan[$key], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? ((int) $plan[$key] > 0);
        return true;
    }

    private function resolvePrice($stripe, array &$plan): string
    {
        $priceId = trim((string) ($plan['stripe_price_id'] ?? ''));
        if ($priceId !== '') return $priceId;
        $productId = trim((string) ($plan['stripe_product_id'] ?? '')) ?: getOrCreateStripeProductId($this->db, $plan, $stripe);
        if ($productId === '') throw new DomainException('O plano de destino nao possui produto Stripe configurado.');
        $price = $stripe->prices->create(['product' => $productId, 'currency' => 'brl', 'unit_amount' => formatMoneyToCents((float) ($plan['price'] ?? 0)), 'recurring' => ['interval' => (string) ($plan['interval_unit'] ?? 'month'), 'interval_count' => max(1, (int) ($plan['interval_count'] ?? 1))], 'metadata' => ['plan_id' => (string) $plan['id'], 'source' => 'canonical_plan_change']], ['idempotency_key' => 'plan_catalog_price_' . (int) $plan['id']]);
        $priceId = trim((string) ($price->id ?? ''));
        if ($priceId === '') throw new RuntimeException('Stripe nao retornou o preco canonico do plano.');
        $this->repository->updatePlanStripePriceId((int) $plan['id'], $priceId);
        return $priceId;
    }

    private function normalizeMetadata($metadata): array
    {
        if (is_array($metadata)) return $metadata;
        if (is_object($metadata) && method_exists($metadata, 'toArray')) return $metadata->toArray();
        $decoded = json_decode((string) json_encode($metadata), true);
        return is_array($decoded) ? $decoded : [];
    }

    private function currentItemPayload($subscription): array
    {
        $item = $subscription->items->data[0] ?? null;
        $price = is_object($item) ? ($item->price ?? null) : null;
        $priceId = getStripeObjectId($price);
        if ($priceId === '') throw new RuntimeException('Preco atual Stripe ausente no schedule.');
        return ['price' => $priceId, 'quantity' => max(1, (int) ($item->quantity ?? 1))];
    }

    private function result(string $operation, string $status, array $subscription, array $target, ?string $effectiveAt): array
    {
        return ['operation' => $operation, 'status' => $status, 'subscription_id' => (int) $subscription['id'], 'provider_subscription_id' => (string) $subscription['provider_subscription_id'], 'current_plan_id' => (int) $subscription['plan_id'], 'target_plan_id' => (int) $target['id'], 'target_plan_name' => (string) $target['name'], 'effective_at' => $effectiveAt, 'message' => $operation === 'UPGRADE' ? 'Upgrade aplicado com sucesso na assinatura atual.' : 'Downgrade agendado para o fim do periodo atual.'];
    }

    private function audit(string $userId, array $subscription, array $target, string $operation, array $details): void
    {
        $payload = array_merge(['actor_source' => 'authenticated_user', 'user_id' => $userId, 'subscription_id' => (int) $subscription['id'], 'provider_subscription_id' => (string) $subscription['provider_subscription_id'], 'previous_plan_id' => (int) $subscription['plan_id'], 'target_plan_id' => (int) $target['id'], 'target_plan_name' => (string) $target['name'], 'operation' => $operation], $details);
        try {
            $this->db->prepare("INSERT INTO admin_audit_logs (admin_user_id, action, resource_type, resource_id, details_json, ip_address, user_agent, created_at) VALUES (:actor, 'subscription.plan_change', 'subscription', :resource, :details, '', '', NOW())")->execute([':actor' => $userId, ':resource' => (string) $subscription['id'], ':details' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
        } catch (Throwable $error) {
            throw new RuntimeException('Nao foi possivel registrar a auditoria da mudanca de plano.', 0, $error);
        }
    }
}
