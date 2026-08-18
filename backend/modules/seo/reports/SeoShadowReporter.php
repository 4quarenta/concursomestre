<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/shared/policies/ContentPublicationPolicy.php';
require_once dirname(__DIR__) . '/services/SeoFactsAssembler.php';
require_once dirname(__DIR__) . '/policies/SeoQualityPolicy.php';
require_once dirname(__DIR__) . '/services/SeoPolicyService.php';

final class SeoShadowReporter
{
    public function __construct(
        private readonly ContentPublicationPolicy $publicationPolicy,
        private readonly SeoFactsAssembler $factsAssembler,
        private readonly SeoQualityPolicy $qualityPolicy,
        private readonly SeoPolicyService $seoPolicy
    ) {
    }

    /** @return array<string, mixed> */
    public function emptyReport(): array
    {
        return [
            'mode' => 'shadow_report_only',
            'policyVersion' => SeoContractEnums::SEO_POLICY_VERSION,
            'factsVersion' => SeoContractEnums::SEO_FACTS_VERSION,
            'publicationPolicyVersion' => SeoContractEnums::PUBLICATION_POLICY_VERSION,
            'qualityConfigVersion' => 'quality-gates.v1',
            'generatedAt' => gmdate('c'),
            'resources' => [],
            'quality' => ['PASS' => 0, 'FAIL' => 0, 'NOT_EVALUATED' => 0],
            'indexability' => ['INDEX' => 0, 'NOINDEX' => 0],
            'reasonCodes' => [],
            'publicationReasonCodes' => [],
            'samples' => [],
            'errors' => [],
        ];
    }

    /**
     * @param array<string, mixed> $report
     * @param array<string, mixed> $projection
     */
    public function append(array &$report, array $projection): void
    {
        $resourceType = (string) ($projection['resourceType'] ?? '');
        $resourceId = (string) ($projection['resourceId'] ?? '');
        try {
            $publicationInput = is_array($projection['publicationInput'] ?? null)
                ? $projection['publicationInput']
                : [];
            $visibility = strtolower((string) ($publicationInput['visibility'] ?? ''));
            $publication = $this->publicationPolicy->decide($publicationInput, [
                'existingAccessAllowed' => $visibility === 'public',
            ]);
            $facts = $this->factsAssembler->assemble(
                $resourceType,
                is_array($projection['publicData'] ?? null) ? $projection['publicData'] : []
            );
            $quality = $this->qualityPolicy->evaluate(
                $resourceType,
                $facts,
                is_array($projection['qualityEvidence'] ?? null) ? $projection['qualityEvidence'] : []
            );
            $routeFamily = is_string($projection['routeFamily'] ?? null)
                ? trim((string) $projection['routeFamily'])
                : '';
            $decision = $routeFamily === '' ? null : $this->seoPolicy->decide([
                'resourceType' => $resourceType,
                'resourceId' => $resourceId,
                'existence' => $projection['existence'] ?? 'exists',
                'publicationDecision' => $publication,
                'seoFacts' => $facts,
                'seoQuality' => $quality,
                'routeFamily' => $routeFamily,
                'routeParameters' => $projection['routeParameters'] ?? [],
                'requestedSlug' => $projection['requestedSlug'] ?? '',
                'canonicalEnvironment' => $projection['canonicalEnvironment'] ?? true,
            ]);

            $report['resources'][$resourceType] = (int) ($report['resources'][$resourceType] ?? 0) + 1;
            $qualityStatus = (string) $quality['status'];
            $indexStatus = $decision === null ? 'NOINDEX' : (string) $decision['indexability']['status'];
            $indexReasonCodes = $decision === null
                ? ['indexability.structural_noindex']
                : $decision['indexability']['reasonCodes'];
            $report['quality'][$qualityStatus]++;
            $report['indexability'][$indexStatus]++;
            foreach ($quality['reasonCodes'] as $reasonCode) {
                $report['reasonCodes'][$reasonCode] = (int) ($report['reasonCodes'][$reasonCode] ?? 0) + 1;
            }
            foreach ($indexReasonCodes as $reasonCode) {
                $report['reasonCodes'][$reasonCode] = (int) ($report['reasonCodes'][$reasonCode] ?? 0) + 1;
            }
            foreach ($publication['reasonCodes'] as $reasonCode) {
                $report['publicationReasonCodes'][$reasonCode] = (int) ($report['publicationReasonCodes'][$reasonCode] ?? 0) + 1;
            }
            if (($qualityStatus !== 'PASS' || $indexStatus !== 'INDEX') && count($report['samples']) < 100) {
                $report['samples'][] = [
                    'resourceType' => $resourceType,
                    'resourceId' => $resourceId,
                    'quality' => $qualityStatus,
                    'wouldIndex' => $indexStatus === 'INDEX',
                    'qualityReasonCodes' => $quality['reasonCodes'],
                    'indexabilityReasonCodes' => $indexReasonCodes,
                    'routeAvailable' => $routeFamily !== '',
                    'failedChecks' => array_values(array_filter(
                        $quality['checks'],
                        static fn (array $check): bool => $check['status'] !== 'PASS'
                    )),
                ];
            }
        } catch (Throwable $error) {
            $report['errors'][] = [
                'resourceType' => $resourceType,
                'resourceId' => $resourceId,
                'error' => $error->getMessage(),
            ];
        }
    }

    /** @param array<string, mixed> $report
     *  @return array<string, mixed>
     */
    public function finalize(array $report, int $queryCount, float $durationSeconds): array
    {
        arsort($report['reasonCodes']);
        arsort($report['publicationReasonCodes']);
        $report['metrics'] = [
            'totalResources' => array_sum($report['resources']),
            'queryCount' => $queryCount,
            'durationMs' => (int) round($durationSeconds * 1000),
            'queriesPerResource' => array_sum($report['resources']) > 0
                ? round($queryCount / array_sum($report['resources']), 4)
                : 0.0,
            'cacheIdentityInputs' => [
                'resource.updated_at',
                'publication state',
                'seo-policy.v1',
                'quality-gates.v1',
            ],
        ];
        return $report;
    }
}
