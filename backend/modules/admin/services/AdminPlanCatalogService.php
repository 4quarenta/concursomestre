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

require_once __DIR__ . '/../repositories/AdminPlanCatalogRepository.php';
require_once __DIR__ . '/../validators/AdminPlanCatalogValidator.php';
require_once __DIR__ . '/../../subscriptions/services/SubscriptionsService.php';

/**
 * Service administrativo do catalogo de planos.
 *
 * @since 1.0.0
 */
class AdminPlanCatalogService
{
    public function __construct(
        private readonly AdminPlanCatalogRepository $repository,
        private readonly AdminPlanCatalogValidator $validator
    ) {
    }

    /**
     * Lista o catalogo completo para gestao no painel admin.
     *
     * @since 1.0.0
     */
    public function list(array $query): array
    {
        $filters = $this->validator->validateListFilters($query);
        $this->repository->ensureDefaultTestPlan();
        $plans = $this->repository->listCatalog($filters['search']);

        return [
            'items' => $plans,
            'total' => count($plans),
        ];
    }

    /**
     * Atualiza campos de um plano especifico.
     *
     * @since 1.0.0
     */
    public function update(array $payload, string $adminUserId): array
    {
        $normalized = $this->validator->validateUpdatePayload($payload);
        $planId = (int) $normalized['plan_id'];

        $existing = $this->repository->findById($planId);
        if (!$existing) {
            throw new OutOfBoundsException('Plano nao encontrado.');
        }

        $isIntervalChangeRequested = $normalized['interval_count'] !== null || $normalized['interval_unit'] !== null;
        $canEditInterval = !empty($existing['can_edit_interval']);
        if ($isIntervalChangeRequested && !$canEditInterval) {
            throw new InvalidArgumentException('Ajuste de dias/ciclo permitido apenas para plano de teste.');
        }

        $canToggleActive = !empty($existing['can_toggle_active']);
        if ($normalized['active'] !== null && !$canToggleActive) {
            $normalized['active'] = null;
        }

        $this->repository->updatePlan($planId, $normalized);
        $updated = $this->repository->findById($planId);
        if (!$updated) {
            throw new RuntimeException('Nao foi possivel recarregar o plano apos atualizar.');
        }

        $renewalSync = $this->syncStripeRenewalsAfterCatalogChange();

        $changes = [];
        foreach (['price', 'interval_count', 'interval_unit', 'active'] as $field) {
            if ($normalized[$field] !== null) {
                $changes[$field] = $updated[$field] ?? $normalized[$field];
            }
        }

        return [
            'message' => 'Plano atualizado com sucesso.',
            'data' => $updated,
            'audit_action' => 'plans.catalog.update',
            'audit_entity_type' => 'plan',
            'audit_entity_id' => (string) $planId,
            'audit_metadata' => [
                'plan_id' => $planId,
                'plan_name' => (string) ($updated['name'] ?? ''),
                'admin_user_id' => $adminUserId,
                'changes' => $changes,
                'stripe_renewal_sync' => $renewalSync,
            ],
        ];
    }

    /**
     * Recalcula cobranças futuras quando o catálogo operacional muda.
     *
     * @since v1.0.0
     */
    private function syncStripeRenewalsAfterCatalogChange(): array
    {
        try {
            $subscriptionsService = new SubscriptionsService(
                $this->repository->getDb(),
                new SubscriptionsRepository($this->repository->getDb()),
                new SubscriptionsValidator()
            );

            return $subscriptionsService->syncStripeRenewalProjectionsAfterPricingChange();
        } catch (Throwable $e) {
            error_log('[admin_plan_catalog] Stripe renewal sync warning: ' . $e->getMessage());

            return [
                'configured' => false,
                'checked' => 0,
                'synced' => 0,
                'errors' => 1,
                'warning' => $e->getMessage(),
            ];
        }
    }
}
