<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/launch/SeoLaunchMode.php';
require_once dirname(__DIR__) . '/launch/SeoProductionPageMap.php';

/**
 * Espelho PHP da decisao transversal usada pelo runtime Next. A autoridade de
 * familia continua sendo o Production Page Map; este servico apenas aplica a
 * ordem de publicacao, ambiente, readiness, quality, resolucao e canonical.
 */
final class SeoIndexPolicy
{
    /** @var array<string,mixed> */
    private array $contract;

    public function __construct(
        private readonly ?SeoProductionPageMap $pageMap = null,
        ?string $contractPath = null
    ) {
        $path = $contractPath ?? dirname(__DIR__, 4) . '/config/seo/index-policy-phase-6.v1.json';
        $raw = file_get_contents($path);
        $contract = $raw === false ? null : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($contract)
            || ($contract['version'] ?? null) !== 'index-policy-phase-6.v1'
            || !is_array($contract['quality'] ?? null)) {
            throw new RuntimeException('Contrato da Index Policy da Fase 6 invalido.');
        }
        $this->contract = $contract;
    }

    /**
     * @param array<string,mixed> $input
     * @return array{indexability:string,sitemapEligible:bool,reasonCodes:list<string>}
     */
    public function evaluate(string $familyId, array $input): array
    {
        $family = ($this->pageMap ?? new SeoProductionPageMap())->family($familyId);
        $launchMode = SeoLaunchMode::normalize($input['launchMode'] ?? null);
        $publicationAllowed = ($input['publicationAllowed'] ?? false) === true;
        $readiness = strtoupper(trim((string) ($input['readiness'] ?? 'NOT_READY')));
        $qualityStatus = strtoupper(trim((string) ($input['qualityStatus'] ?? 'NOT_EVALUATED')));
        $resolution = strtolower(trim((string) ($input['resolutionAction'] ?? 'not_found')));
        $httpStatus = (int) ($input['httpStatus'] ?? 0);
        $canonicalValid = ($input['canonicalValid'] ?? false) === true;
        $canonicalEnvironment = ($input['canonicalEnvironment'] ?? false) === true;
        $activationAllowed = ($input['productionActivationAllowed'] ?? false) === true;
        $reasons = [];

        if (!$publicationAllowed) $reasons[] = 'indexability.non_public';
        if ($launchMode === SeoLaunchMode::PRELAUNCH) $reasons[] = 'indexability.launch_prelaunch';
        if ($launchMode === SeoLaunchMode::GO_CANDIDATE) $reasons[] = 'indexability.launch_go_candidate';
        if (($family['launchStatus'] ?? null) !== 'ACTIVE') $reasons[] = 'indexability.launch_not_active';
        if (($family['familyEligibility'] ?? null) === 'PERMANENT_NOINDEX') {
            $reasons[] = 'indexability.family_permanent_noindex';
        }
        if ($readiness !== 'READY') $reasons[] = 'indexability.instance_not_ready';
        if ($this->qualityRequired($familyId) && $qualityStatus === 'FAIL') {
            $reasons[] = 'indexability.quality_failed';
        } elseif ($this->qualityRequired($familyId) && $qualityStatus !== 'PASS') {
            $reasons[] = 'indexability.quality_not_evaluated';
        }
        if (!$canonicalEnvironment) $reasons[] = 'indexability.non_canonical_environment';
        if (!$activationAllowed) $reasons[] = 'indexability.production_activation_missing';
        if ($resolution !== 'render' || $httpStatus !== 200 || !$canonicalValid) {
            $reasons[] = 'indexability.missing_canonical_identity';
        }

        $reasons = array_values(array_unique($reasons));
        $indexability = $launchMode === SeoLaunchMode::PRODUCTION
            && ($family['targetProductionIndexability'] ?? null) === 'INDEX'
            && $reasons === []
                ? 'INDEX'
                : 'NOINDEX';

        return [
            'indexability' => $indexability,
            'sitemapEligible' => $indexability === 'INDEX'
                && ($family['sitemapTarget'] ?? null) === 'INCLUDE_WHEN_READY',
            'reasonCodes' => $reasons,
        ];
    }

    public function qualityRequired(string $familyId): bool
    {
        $quality = $this->contract['quality'];
        return ($quality['defaultPolicy'] ?? null) === 'REQUIRED'
            || in_array($familyId, $quality['requiredFamilies'] ?? [], true);
    }
}
