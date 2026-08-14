<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/contracts/SeoContractValidator.php';
require_once dirname(__DIR__) . '/policies/StructuralRoutePolicy.php';
require_once dirname(__DIR__) . '/promotion/EditorialSeoPromotionProvider.php';
require_once __DIR__ . '/SeoSlugService.php';

/**
 * Consolida as decisoes SEO em shadow mode. Nenhum chamador operacional do
 * backend importa este servico no Checkpoint 2.
 */
final class SeoPolicyService
{
    public function __construct(
        private readonly StructuralRoutePolicy $routes,
        private readonly EditorialSeoPromotionProvider $promotions,
        private readonly SeoSlugService $slugs,
        private readonly string $canonicalBaseUrl = 'https://concursomestre.com'
    ) {
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function decide(array $input): array
    {
        $resourceType = (string) ($input['resourceType'] ?? 'page');
        $resourceId = trim((string) ($input['resourceId'] ?? ''));
        if ($resourceId === '') {
            throw new InvalidArgumentException('SeoPolicyService exige resourceId.');
        }
        $existence = (string) ($input['existence'] ?? 'exists');
        if (!in_array($existence, SeoContractEnums::EXISTENCE_STATES, true)) {
            throw new InvalidArgumentException('Estado de existencia invalido.');
        }

        if ($existence !== 'exists') {
            return $this->nonexistentDecision($resourceType, $resourceId, $existence, $input);
        }

        $publication = $input['publicationDecision'] ?? null;
        $facts = $input['seoFacts'] ?? null;
        $quality = $input['seoQuality'] ?? null;
        if (!is_array($publication) || SeoContractValidator::validatePublicationDecision($publication) !== []) {
            throw new InvalidArgumentException('PublicationDecision invalida para SeoPolicyService.');
        }
        if (!is_array($facts) || SeoContractValidator::validateSeoFacts($facts) !== []) {
            throw new InvalidArgumentException('SeoFacts invalido para SeoPolicyService.');
        }
        if (($facts['resourceType'] ?? null) !== $resourceType) {
            throw new InvalidArgumentException('SeoFacts pertence a outro tipo de recurso.');
        }
        if (!is_array($quality)
            || !in_array($quality['status'] ?? null, SeoContractEnums::QUALITY_STATUSES, true)
            || !is_array($quality['reasonCodes'] ?? null)) {
            throw new InvalidArgumentException('Resultado de quality invalido para SeoPolicyService.');
        }

        $familyId = (string) ($input['routeFamily'] ?? '');
        $family = $this->routes->family($familyId);
        $displayName = (string) ($facts['identity']['displayName'] ?? '');
        $slug = $this->slugs->slug($displayName, $resourceType, $resourceId);
        $routeParameters = is_array($input['routeParameters'] ?? null) ? $input['routeParameters'] : [];
        $routeParameters['id'] = $resourceId;
        $routeParameters['slug'] = $slug;
        $canonicalPath = $this->routes->buildPath($familyId, $routeParameters);
        $promotion = $this->promotions->resolve($family, [
            'type' => $resourceType,
            'id' => $resourceId,
            'facts' => $facts,
        ]);

        $indexReasonCodes = [];
        if (($publication['status'] ?? null) !== 'published'
            || ($publication['visibility'] ?? null) !== 'public'
            || ($publication['access'] ?? null) !== 'allowed') {
            $indexReasonCodes[] = 'indexability.non_public';
        }
        if (($quality['status'] ?? null) === 'FAIL') {
            $indexReasonCodes[] = 'indexability.quality_failed';
        } elseif (($quality['status'] ?? null) !== 'PASS') {
            $indexReasonCodes[] = 'indexability.quality_not_evaluated';
        }
        if (($family['defaultIndexability'] ?? 'NOINDEX') !== 'INDEX') {
            $indexReasonCodes[] = 'indexability.structural_noindex';
        }
        if (($promotion['status'] ?? null) === 'pending') {
            $indexReasonCodes[] = 'indexability.editorial_promotion_required';
        }
        if (($input['canonicalEnvironment'] ?? true) !== true) {
            $indexReasonCodes[] = 'indexability.non_canonical_environment';
        }
        if ($canonicalPath === null) {
            $indexReasonCodes[] = 'indexability.missing_canonical_identity';
        }

        $requestedSlug = trim((string) ($input['requestedSlug'] ?? ''));
        $slugMismatch = $requestedSlug !== '' && !hash_equals($slug, $requestedSlug);
        if ($slugMismatch) {
            $indexReasonCodes[] = 'indexability.non_canonical_request';
        }
        $indexReasonCodes = array_values(array_unique($indexReasonCodes));
        $wouldIndex = $indexReasonCodes === [];

        $canonical = $canonicalPath !== null ? [
            'path' => $canonicalPath,
            'url' => rtrim($this->canonicalBaseUrl, '/') . $canonicalPath,
            'slug' => $slug,
        ] : null;
        $resolution = ['action' => 'render', 'httpStatus' => 200, 'target' => null];
        if ($slugMismatch && $canonicalPath !== null) {
            $resolution = ['action' => 'redirect', 'httpStatus' => 308, 'target' => $canonicalPath];
            $canonical = null;
            $wouldIndex = false;
        }

        $decision = [
            'policyVersion' => SeoContractEnums::SEO_POLICY_VERSION,
            'resource' => ['type' => $resourceType, 'id' => $resourceId],
            'existence' => 'exists',
            'quality' => [
                'status' => (string) $quality['status'],
                'reasonCodes' => array_values($quality['reasonCodes']),
            ],
            'indexability' => [
                'status' => $wouldIndex ? 'INDEX' : 'NOINDEX',
                'reasonCodes' => $indexReasonCodes,
            ],
            'resolution' => $resolution,
            'robots' => [
                'index' => $wouldIndex,
                'follow' => $resolution['action'] === 'render',
                'archive' => $wouldIndex,
                'imageIndex' => $wouldIndex,
            ],
            'sitemap' => [
                'eligible' => $wouldIndex && $resolution['action'] === 'render',
                'section' => $wouldIndex ? $this->sitemapSection($familyId) : null,
                'lastModified' => $wouldIndex ? ($facts['dates']['updatedAt'] ?? $facts['dates']['publishedAt'] ?? null) : null,
            ],
        ];
        if ($canonical !== null) {
            $decision['canonical'] = $canonical;
        }

        $this->assertValid($decision);
        return $decision;
    }

    /** @param array<string, mixed> $input
     *  @return array<string, mixed>
     */
    private function nonexistentDecision(string $resourceType, string $resourceId, string $existence, array $input): array
    {
        $replacementTarget = trim((string) ($input['replacementTarget'] ?? ''));
        if ($existence === 'removed' && $replacementTarget !== '') {
            $resolution = ['action' => 'redirect', 'httpStatus' => 308, 'target' => $replacementTarget];
            $resolutionReasons = ['resolution.removed', 'resolution.replacement_available'];
        } else {
            $resolution = $existence === 'missing'
                ? ['action' => 'not_found', 'httpStatus' => 404, 'target' => null]
                : ['action' => 'gone', 'httpStatus' => 410, 'target' => null];
            $resolutionReasons = [$existence === 'missing' ? 'resolution.missing' : 'resolution.removed'];
        }

        $decision = [
            'policyVersion' => SeoContractEnums::SEO_POLICY_VERSION,
            'resource' => ['type' => $resourceType, 'id' => $resourceId],
            'existence' => $existence,
            'quality' => ['status' => 'NOT_EVALUATED', 'reasonCodes' => ['quality.not_evaluated']],
            'indexability' => ['status' => 'NOINDEX', 'reasonCodes' => ['indexability.quality_not_evaluated']],
            'resolution' => $resolution,
            'robots' => ['index' => false, 'follow' => false, 'archive' => false, 'imageIndex' => false],
            'sitemap' => ['eligible' => false, 'section' => null, 'lastModified' => null],
        ];

        // O contrato v1 ainda nao possui reasonCodes dentro de resolution. Os
        // motivos ficam disponiveis ao relatorio sem alterar o DTO validado.
        unset($resolutionReasons);
        $this->assertValid($decision);
        return $decision;
    }

    /** @param array<string, mixed> $decision */
    private function assertValid(array $decision): void
    {
        $errors = SeoContractValidator::validateSeoDecision($decision);
        if ($errors !== []) {
            throw new LogicException('SeoDecision calculada e invalida: ' . implode(' | ', $errors));
        }
    }

    private function sitemapSection(string $familyId): string
    {
        return match ($familyId) {
            'question_detail', 'questions_hub' => 'questions',
            'exam_detail', 'exam_hub' => 'exams',
            'board_detail', 'board_hub', 'discipline_detail', 'discipline_hub', 'topic_detail', 'subject_detail' => 'taxonomies',
            'law_detail', 'law_hub' => 'laws',
            'blog_article', 'blog_hub' => 'articles',
            default => 'pages',
        };
    }
}
