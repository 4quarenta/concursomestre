<?php

declare(strict_types=1);

require_once __DIR__ . '/SeoInstanceReadiness.php';
require_once dirname(__DIR__, 3) . '/shared/policies/ContentPublicationPolicy.php';

final class SeoInstanceReadinessAssembler
{
    private const PROFILES = [
        'default', 'question', 'exam', 'material', 'material_listing',
        'simulation', 'contest', 'blog_article',
    ];

    /**
     * @param array<string,mixed> $publication
     * @param array<string,mixed> $quality
     * @param array<string,mixed>|null $explicitReadiness
     * @param array<string,mixed> $signals
     * @return array{status:string,reasonCodes:list<string>}
     */
    public function assemble(
        array $publication,
        array $quality,
        bool $currentImplementationReady,
        ?array $explicitReadiness = null,
        string $profile = 'default',
        array $signals = []
    ): array {
        $reasons = [];
        if (!$currentImplementationReady) {
            $reasons[] = 'instance_readiness.current_implementation_not_ready';
        }
        if (($publication['status'] ?? null) !== 'published'
            || ($publication['visibility'] ?? null) !== 'public'
            || ($publication['access'] ?? null) !== 'allowed') {
            $reasons[] = 'instance_readiness.publication_blocked';
        }

        $explicitStatus = null;
        if ($explicitReadiness !== null) {
            $validated = SeoInstanceReadiness::validate($explicitReadiness);
            $explicitStatus = $validated['status'];
            if ($explicitStatus !== 'READY') {
                $reasons = array_merge($reasons, $validated['reasonCodes']);
            }
        }

        $profileReadiness = $this->fromProfile($profile, $signals);
        if ($profileReadiness['status'] !== 'READY') {
            $reasons = array_merge($reasons, $profileReadiness['reasonCodes']);
        }

        if ($profile === 'default' && $explicitReadiness === null) {
            $reasons = array_merge($reasons, $this->defaultReasons($quality));
        }
        $reasons = $this->normalizeReasons($reasons);
        $status = $reasons === []
            ? 'READY'
            : ($explicitStatus === 'NOT_APPLICABLE'
                && $reasons === ['instance_readiness.not_applicable'] ? 'NOT_APPLICABLE' : 'NOT_READY');
        return SeoInstanceReadiness::validate(['status' => $status, 'reasonCodes' => $reasons]);
    }

    /**
     * Adapter unico para runtimes publicos que ainda recebem estado editorial
     * cru. O resultado final continua sendo produzido por assemble().
     *
     * @param array<string,mixed> $publicationInput
     * @param array<string,mixed> $signals
     * @return array{status:string,reasonCodes:list<string>}
     */
    public function assemblePublicEntity(
        string $profile,
        array $publicationInput,
        array $signals,
        bool $currentImplementationReady = true
    ): array {
        $visibility = strtolower(trim((string) ($publicationInput['visibility'] ?? '')));
        $publication = (new ContentPublicationPolicy())->decide($publicationInput, [
            'existingAccessAllowed' => $visibility === 'public',
        ]);
        return $this->assemble(
            $publication,
            ['status' => 'PASS', 'reasonCodes' => [], 'checks' => []],
            $currentImplementationReady,
            null,
            $profile,
            $signals
        );
    }

    /** @param array<string,mixed> $signals
     *  @return array{status:string,reasonCodes:list<string>}
     */
    public function fromProfile(string $profile, array $signals): array
    {
        if (!in_array($profile, self::PROFILES, true)) {
            throw new InvalidArgumentException('Perfil de InstanceReadiness invalido.');
        }
        if ($profile === 'default') return ['status' => 'READY', 'reasonCodes' => []];

        $reasons = [];
        if (($signals['entityExists'] ?? true) !== true) $reasons[] = 'instance_readiness.entity_missing';
        if (($signals['validSlug'] ?? true) !== true) {
            $reasons[] = 'instance_readiness.invalid_slug';
            $reasons[] = 'instance_readiness.canonical_invalid';
        }
        if (($signals['hasDefinition'] ?? true) !== true) $reasons[] = 'instance_readiness.invalid_definition';
        if (($signals['notArchived'] ?? true) !== true) $reasons[] = 'instance_readiness.publication_blocked';

        if (in_array($profile, ['material', 'material_listing'], true)) {
            if (($signals['definitionApproved'] ?? false) !== true) $reasons[] = 'instance_readiness.invalid_definition';
            if (($signals['rightsAllowed'] ?? false) !== true) $reasons[] = 'instance_readiness.protected';
            if (($signals['hasAsset'] ?? false) !== true) $reasons[] = 'instance_readiness.invalid_definition';
            if ($profile === 'material_listing' && ($signals['commerciallyValid'] ?? false) !== true) {
                $reasons[] = 'instance_readiness.invalid_definition';
            }
        }
        if ($profile === 'simulation' && ($signals['hasQuestion'] ?? false) !== true) {
            $reasons[] = 'instance_readiness.invalid_definition';
        }
        if ($profile === 'contest' && ($signals['hasOrganization'] ?? false) !== true) {
            $reasons[] = 'instance_readiness.invalid_definition';
        }

        $reasons = $this->normalizeReasons($reasons);
        return ['status' => $reasons === [] ? 'READY' : 'NOT_READY', 'reasonCodes' => $reasons];
    }

    /** @param array<string,mixed> $quality @return list<string> */
    private function defaultReasons(array $quality): array
    {
        if (($quality['status'] ?? null) === 'PASS') return [];
        $qualityReasons = is_array($quality['reasonCodes'] ?? null) ? $quality['reasonCodes'] : [];
        return [in_array('quality.taxonomy.invalid_hierarchy', $qualityReasons, true)
            ? 'instance_readiness.invalid_hierarchy'
            : 'instance_readiness.not_evaluated'];
    }

    /** @param list<string> $reasons @return list<string> */
    private function normalizeReasons(array $reasons): array
    {
        $reasons = array_values(array_unique($reasons));
        sort($reasons, SORT_STRING);
        return $reasons;
    }
}
