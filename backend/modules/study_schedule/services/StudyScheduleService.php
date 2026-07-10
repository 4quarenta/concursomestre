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
 * Regras de negocio do cronograma de estudos.
 *
 * @since 1.0.0
 */
class StudyScheduleService
{
    public function __construct(
        private readonly StudyScheduleRepository $repository,
        private readonly StudyScheduleValidator $validator
    ) {
    }

    /**
     * Carrega o cronograma salvo do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function getSchedule(array $authenticatedUserPayload): array
    {
        $context = $this->resolveAccessContext($authenticatedUserPayload);
        $this->assertCanUseSchedule($context);

        return [
            'schedule' => $this->repository->findByUserId($context['user_id']),
            'access' => $this->buildAccessPayload($context),
        ];
    }

    /**
     * Salva o cronograma do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function saveSchedule(array $payload, array $authenticatedUserPayload): array
    {
        $context = $this->resolveAccessContext($authenticatedUserPayload);
        $this->assertCanUseSchedule($context);

        $normalized = $this->validator->validateSavePayload($payload);

        return [
            'schedule' => $this->repository->upsert($context['user_id'], $normalized),
            'access' => $this->buildAccessPayload($context),
        ];
    }

    /**
     * Remove o cronograma salvo do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function deleteSchedule(array $authenticatedUserPayload): array
    {
        $context = $this->resolveAccessContext($authenticatedUserPayload);
        $this->assertCanUseSchedule($context);

        $this->repository->deleteByUserId($context['user_id']);

        return [
            'deleted' => true,
            'access' => $this->buildAccessPayload($context),
        ];
    }

    private function resolveAccessContext(array $authenticatedUserPayload): array
    {
        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($userId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $role = strtolower(trim((string) ($authenticatedUserPayload['role'] ?? 'user')));
        $isAdmin = in_array($role, ['admin', 'staff'], true);
        $planName = $isAdmin ? 'Elite' : $this->repository->resolveUserPlanName($userId);

        return [
            'user_id' => $userId,
            'role' => $role,
            'is_admin' => $isAdmin,
            'plan_name' => $planName,
            'plan_tier' => $this->planTier($planName),
            'feature_enabled' => $this->repository->isFeatureEnabled(),
        ];
    }

    private function assertCanUseSchedule(array $context): void
    {
        if (!$context['feature_enabled'] && !$context['is_admin']) {
            throw new DomainException('Cronograma de estudos indisponivel no momento.');
        }

        if (!$context['is_admin'] && (int) $context['plan_tier'] < 4) {
            throw new DomainException('Cronograma de estudos e exclusivo do plano Elite.');
        }
    }

    private function buildAccessPayload(array $context): array
    {
        return [
            'planName' => (string) $context['plan_name'],
            'isElite' => (int) $context['plan_tier'] >= 4,
            'featureEnabled' => (bool) $context['feature_enabled'],
        ];
    }

    private function planTier(string $planName): int
    {
        $normalized = strtolower($planName);

        if (str_contains($normalized, 'elite')) {
            return 4;
        }

        if (str_contains($normalized, 'pro')) {
            return 3;
        }

        if (str_contains($normalized, 'essencial')) {
            return 2;
        }

        return 1;
    }
}
