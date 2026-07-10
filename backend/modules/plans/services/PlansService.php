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

require_once __DIR__ . '/../repositories/PlansRepository.php';
require_once __DIR__ . '/../validators/PlansValidator.php';
require_once __DIR__ . '/../../../config/payment_provider.php';

/**
 * Service do dominio de planos.
 * Normaliza o catalogo comercial para a API publica do frontend.
 *
 * @since 1.0.0
 */
class PlansService
{
    private PlansRepository $repository;
    private PlansValidator $validator;

    /**
     * Inicializa o service de planos.
     *
     * @since 1.0.0
     */
    public function __construct(
        PlansRepository $repository,
        PlansValidator $validator
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Lista os planos com estrutura normalizada.
     *
     * @since 1.0.0
     */
    public function list(): array
    {
        $this->validator->validateListRequest();

        $plansByCycle = [];
        $planDetails = getSystemSettingValue($this->repository->getConnection(), 'planDetails', []);
        foreach ($this->repository->fetchAll() as $row) {
            $canonicalName = canonicalUserPlanValue((string) ($row['name'] ?? ''));
            $features = $this->resolveFeatures($row, $canonicalName, is_array($planDetails) ? $planDetails : []);

            $catalogActive = true;
            if (array_key_exists('active', $row)) {
                $catalogActive = filter_var($row['active'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
                if ($catalogActive === null) {
                    $catalogActive = ((int) $row['active']) > 0;
                }
            } elseif (array_key_exists('is_active', $row)) {
                $catalogActive = filter_var($row['is_active'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
                if ($catalogActive === null) {
                    $catalogActive = ((int) $row['is_active']) > 0;
                }
            }

            $row['price'] = isset($row['price']) ? (float) $row['price'] : 0.0;
            $row['interval_count'] = isset($row['interval_count']) ? (int) $row['interval_count'] : 1;
            $row['features'] = $features;
            $row['canonical_name'] = $canonicalName;
            $row['is_active'] = $catalogActive && isPlanCommerciallyEnabled($this->repository->getConnection(), (string) ($row['name'] ?? ''));

            $cycleKey = $this->publicBillingCycleKey($row);
            if (!$this->isPublicCatalogPlan($row, $cycleKey)) {
                continue;
            }

            $dedupeKey = $canonicalName === 'Gratuito'
                ? 'Gratuito:free'
                : $canonicalName . ':' . $cycleKey;

            if (
                !isset($plansByCycle[$dedupeKey])
                || $this->shouldReplacePublicPlan($plansByCycle[$dedupeKey], $row, (string) $cycleKey)
            ) {
                $plansByCycle[$dedupeKey] = $row;
            }
        }

        $plans = array_values($plansByCycle);
        usort($plans, fn(array $left, array $right): int => $this->comparePublicPlans($left, $right));

        return $plans;
    }

    /**
     * Resolve beneficios vindos do catalogo, com fallback para planDetails.
     *
     * @since 1.0.0
     */
    private function resolveFeatures(array $row, string $canonicalName, array $planDetails): array
    {
        $features = [];
        if (!empty($row['features'])) {
            $decoded = json_decode((string) $row['features'], true);
            if (is_array($decoded)) {
                $features = $decoded;
            }
        }

        if ($features !== []) {
            return $features;
        }

        $configuredFeatures = $planDetails[$canonicalName]['features'] ?? null;
        return is_array($configuredFeatures) ? $configuredFeatures : [];
    }

    /**
     * Mantem somente ciclos comerciais publicos.
     *
     * @since 1.0.0
     */
    private function publicBillingCycleKey(array $row): ?string
    {
        $unit = strtolower(trim((string) ($row['interval_unit'] ?? '')));
        $count = max(1, (int) ($row['interval_count'] ?? 1));

        if ($unit === 'year' || ($unit === 'month' && $count >= 12)) {
            return 'annual';
        }

        if ($unit === 'month' && $count === 3) {
            return 'quarterly';
        }

        if ($unit === 'month' && $count === 1) {
            return 'monthly';
        }

        if (($unit === 'day' || $unit === 'week') && $count >= 1 && $count <= 30) {
            return 'short';
        }

        return null;
    }

    private function isPublicCatalogPlan(array $row, ?string $cycleKey): bool
    {
        if (empty($row['is_active']) || $cycleKey === null) {
            return false;
        }

        $canonicalName = (string) ($row['canonical_name'] ?? 'Gratuito');
        $price = round((float) ($row['price'] ?? 0), 2);

        if ($this->isTestPlan($row)) {
            return $cycleKey === 'short' && $price > 0;
        }

        if ($canonicalName === 'Gratuito') {
            return $cycleKey === 'monthly' && $price <= 0;
        }

        return $price > 0;
    }

    private function isTestPlan(array $row): bool
    {
        if (array_key_exists('is_test_plan', $row)) {
            $isTestPlan = filter_var($row['is_test_plan'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($isTestPlan !== null) {
                return $isTestPlan;
            }

            if ((int) $row['is_test_plan'] > 0) {
                return true;
            }
        }

        $name = function_exists('mb_strtolower')
            ? mb_strtolower((string) ($row['name'] ?? ''), 'UTF-8')
            : strtolower((string) ($row['name'] ?? ''));

        return $name !== '' && preg_match('/\b(teste|test|trial)\b/u', $name) === 1;
    }

    private function shouldReplacePublicPlan(array $current, array $candidate, string $cycleKey): bool
    {
        $candidateName = (string) ($candidate['name'] ?? '');
        $currentName = (string) ($current['name'] ?? '');
        $candidateLooksCanonicalCycle = $this->nameMatchesCycle($candidateName, $cycleKey);
        $currentLooksCanonicalCycle = $this->nameMatchesCycle($currentName, $cycleKey);

        if ($candidateLooksCanonicalCycle !== $currentLooksCanonicalCycle) {
            return $candidateLooksCanonicalCycle;
        }

        return (int) ($candidate['id'] ?? 0) > (int) ($current['id'] ?? 0);
    }

    private function nameMatchesCycle(string $name, string $cycleKey): bool
    {
        $normalized = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);

        return match ($cycleKey) {
            'monthly' => strpos($normalized, 'mensal') !== false,
            'quarterly' => strpos($normalized, 'trimestral') !== false,
            'annual' => strpos($normalized, 'anual') !== false,
            default => false,
        };
    }

    private function comparePublicPlans(array $left, array $right): int
    {
        $leftTier = canonicalPlanTier((string) ($left['canonical_name'] ?? $left['name'] ?? 'Gratuito'));
        $rightTier = canonicalPlanTier((string) ($right['canonical_name'] ?? $right['name'] ?? 'Gratuito'));
        if ($leftTier !== $rightTier) {
            return $leftTier <=> $rightTier;
        }

        $cycleOrder = ['short' => 0, 'monthly' => 1, 'quarterly' => 2, 'annual' => 3];
        $leftCycle = $cycleOrder[$this->publicBillingCycleKey($left) ?? 'monthly'] ?? 99;
        $rightCycle = $cycleOrder[$this->publicBillingCycleKey($right) ?? 'monthly'] ?? 99;

        return $leftCycle <=> $rightCycle;
    }
}
