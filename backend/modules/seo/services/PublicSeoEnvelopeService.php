<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/shared/policies/ContentPublicationPolicy.php';
require_once __DIR__ . '/SeoFactsAssembler.php';
require_once dirname(__DIR__) . '/policies/SeoQualityPolicy.php';
require_once dirname(__DIR__) . '/policies/StructuralRoutePolicy.php';
require_once dirname(__DIR__) . '/promotion/DefaultEditorialSeoPromotionProvider.php';
require_once __DIR__ . '/SeoSlugService.php';
require_once __DIR__ . '/SeoPolicyService.php';

/**
 * Adiciona os contratos SEO v1 aos DTOs publicos em shadow mode.
 *
 * O servico trabalha somente com a projecao que o endpoint ja carregou. Ele
 * nao recebe PDO, nao consulta repositories e nao aplica a decisao calculada
 * ao status HTTP, ao canonical ou a qualquer outra parte do runtime atual.
 */
final class PublicSeoEnvelopeService
{
    /** @var list<string> */
    private const PUBLIC_PUBLICATION_REASON_CODES = [
        'publication.unpublished',
        'publication.scheduled',
        'publication.embargo_active',
        'publication.visibility_authenticated',
        'publication.visibility_restricted',
        'publication.access_denied',
        'publication.blocked',
    ];

    private readonly ContentPublicationPolicy $publicationPolicy;
    private readonly SeoFactsAssembler $factsAssembler;
    private readonly SeoQualityPolicy $qualityPolicy;
    private readonly SeoPolicyService $seoPolicy;

    public function __construct()
    {
        $routes = new StructuralRoutePolicy();
        $this->publicationPolicy = new ContentPublicationPolicy();
        $this->factsAssembler = new SeoFactsAssembler();
        $this->qualityPolicy = new SeoQualityPolicy();
        $this->seoPolicy = new SeoPolicyService(
            $routes,
            new DefaultEditorialSeoPromotionProvider(),
            new SeoSlugService()
        );
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    public function attachQuestion(array $payload): array
    {
        return $this->attach($payload, $this->questionProjection($payload));
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    public function attachExam(array $payload): array
    {
        return $this->attach($payload, $this->examProjection($payload));
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    public function attachBoard(array $payload): array
    {
        return $this->attach($payload, $this->boardProjection($payload));
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    public function attachTaxonomy(array $payload): array
    {
        return $this->attach($payload, $this->taxonomyProjection($payload));
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    public function attachLaw(array $payload): array
    {
        return $this->attach($payload, $this->lawProjection($payload));
    }

    /**
     * Entrada publica usada por relatorios e testes de compatibilidade.
     *
     * @param array<string, mixed> $projection
     * @return array{publicationDecision:array<string,mixed>,seoDecision:array<string,mixed>,seoFacts:array<string,mixed>}
     */
    public function buildEnvelope(array $projection): array
    {
        $resourceType = (string) ($projection['resourceType'] ?? '');
        $resourceId = trim((string) ($projection['resourceId'] ?? ''));
        if ($resourceId === '') {
            throw new InvalidArgumentException('Envelope SEO exige resourceId.');
        }

        $publicationInput = is_array($projection['publicationInput'] ?? null)
            ? $projection['publicationInput']
            : [];
        $visibility = strtolower(trim((string) ($publicationInput['visibility'] ?? '')));
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
        $decision = $this->seoPolicy->decide([
            'resourceType' => $resourceType,
            'resourceId' => $resourceId,
            'existence' => $projection['existence'] ?? 'exists',
            'publicationDecision' => $publication,
            'seoFacts' => $facts,
            'seoQuality' => $quality,
            'routeFamily' => $projection['routeFamily'] ?? '',
            'routeParameters' => $projection['routeParameters'] ?? [],
            'requestedSlug' => $projection['requestedSlug'] ?? '',
            'canonicalEnvironment' => $projection['canonicalEnvironment'] ?? true,
        ]);

        return [
            'publicationDecision' => $this->publicPublicationDecision($publication),
            'seoDecision' => $decision,
            'seoFacts' => $facts,
        ];
    }

    /** @param array<string, mixed> $payload
     *  @param array<string, mixed> $projection
     *  @return array<string, mixed>
     */
    private function attach(array $payload, array $projection): array
    {
        try {
            return array_merge($payload, $this->buildEnvelope($projection));
        } catch (Throwable $error) {
            error_log(json_encode([
                'event' => 'seo_shadow_envelope_failed',
                'resourceType' => (string) ($projection['resourceType'] ?? 'unknown'),
                'resourceId' => (string) ($projection['resourceId'] ?? ''),
                'errorClass' => get_class($error),
            ], JSON_UNESCAPED_SLASHES));
            return $payload;
        }
    }

    /** @param array<string, mixed> $decision
     *  @return array<string, mixed>
     */
    private function publicPublicationDecision(array $decision): array
    {
        $decision['reasonCodes'] = array_values(array_intersect(
            is_array($decision['reasonCodes'] ?? null) ? $decision['reasonCodes'] : [],
            self::PUBLIC_PUBLICATION_REASON_CODES
        ));
        $errors = SeoContractValidator::validatePublicationDecision($decision);
        if ($errors !== []) {
            throw new LogicException('PublicationDecision publica invalida.');
        }
        return $decision;
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    private function questionProjection(array $payload): array
    {
        $id = (string) ($payload['id'] ?? '');
        $content = is_array($payload['content'] ?? null) ? $payload['content'] : [];
        $filters = is_array($payload['filters'] ?? null) ? $payload['filters'] : [];
        $publication = is_array($payload['publication'] ?? null) ? $payload['publication'] : [];
        $assets = is_array($payload['assets'] ?? null) ? $payload['assets'] : [];
        $contexts = is_array($payload['contexts'] ?? null) ? $payload['contexts'] : [];
        $alternatives = is_array($payload['alternatives'] ?? null)
            ? $payload['alternatives']
            : (is_array($payload['itens'] ?? null) ? $payload['itens'] : []);
        $statement = (string) ($content['statement'] ?? $payload['enunciado_clean'] ?? $payload['enunciado'] ?? '');
        $supportText = (string) ($content['supportText'] ?? $payload['introText'] ?? '');
        $year = $this->firstYear($filters['years'] ?? [], $payload['provas'] ?? $payload['examSummary'] ?? []);

        $evidence = [
            'hasVisual' => $assets !== [] || $this->contextsHaveAssets($contexts),
            'alternativesValid' => count($alternatives) >= 2 && $this->allAlternativesHaveContent($alternatives),
            'taxonomyValid' => $this->hasAnyTaxonomy($filters),
            'assetsValid' => $this->assetsAreResolvable($assets) && $this->contextAssetsAreResolvable($contexts),
        ];
        if ($contexts === []) {
            $evidence['contextCoherent'] = true;
        }

        return [
            'resourceType' => 'question',
            'resourceId' => $id,
            'existence' => 'exists',
            'routeFamily' => 'question_detail',
            'routeParameters' => [],
            'publicationInput' => [
                'status' => $publication['status'] ?? $payload['publishStatus'] ?? $payload['publish_status'] ?? 'published',
                'visibility' => $publication['visibility'] ?? $payload['visibilityStatus'] ?? $payload['visibility_status'] ?? 'public',
                'scheduledAt' => $publication['scheduledAt'] ?? $payload['scheduledAt'] ?? null,
                'provenanceStatus' => 'unknown',
                'rightsStatus' => 'not_evaluable',
            ],
            'publicData' => [
                'id' => $id,
                'displayName' => 'Questao ' . $id,
                'statement' => $statement,
                'supportText' => $supportText,
                'subjectName' => $this->firstTaxonomyLabel($filters['subjects'] ?? []),
                'topicName' => $this->firstTaxonomyLabel($filters['topics'] ?? []),
                'boardName' => $this->firstTaxonomyLabel($filters['examBoards'] ?? $filters['bancas'] ?? []),
                'organizationName' => $this->firstTaxonomyLabel($filters['organizations'] ?? $filters['orgaos'] ?? []),
                'roleName' => $this->firstTaxonomyLabel($filters['roles'] ?? $filters['cargos'] ?? []),
                'year' => $year,
                'publishedAt' => $publication['publishedAt'] ?? $payload['publishedAt'] ?? null,
                'updatedAt' => $payload['updatedAt'] ?? $payload['createdAt'] ?? null,
                'primaryImage' => $this->primaryImage($assets),
                'breadcrumbs' => [],
            ],
            'qualityEvidence' => $evidence,
        ];
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    private function examProjection(array $payload): array
    {
        $id = (string) ($payload['id'] ?? '');
        $files = is_array($payload['files'] ?? null) ? $payload['files'] : [];
        $questionCount = max(0, (int) ($payload['questionCount'] ?? 0));
        return [
            'resourceType' => 'exam',
            'resourceId' => $id,
            'existence' => 'exists',
            'routeFamily' => 'exam_detail',
            'routeParameters' => [],
            'publicationInput' => $this->implicitPublicInput(),
            'publicData' => [
                'id' => $id,
                'displayName' => (string) ($payload['title'] ?? ''),
                'shortName' => $payload['shortTitle'] ?? null,
                'summary' => (string) ($payload['officialTitle'] ?? ''),
                'boardName' => $this->taxonomyName($payload['board'] ?? null),
                'organizationNames' => $this->taxonomyNames($payload['organizations'] ?? []),
                'roleNames' => $this->taxonomyNames($payload['roles'] ?? []),
                'year' => $payload['year'] ?? null,
                'levelName' => $payload['level'] ?? null,
                'publishedAt' => $payload['publishedAt'] ?? null,
                'updatedAt' => $payload['updatedAt'] ?? null,
                'breadcrumbs' => [],
            ],
            'qualityEvidence' => [
                'relationsValid' => $this->taxonomyName($payload['board'] ?? null) !== null
                    || $this->taxonomyNames($payload['organizations'] ?? []) !== []
                    || $this->taxonomyNames($payload['roles'] ?? []) !== [],
                'officialFileCount' => count($files),
                'publicQuestionCount' => $questionCount,
            ],
        ];
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    private function boardProjection(array $payload): array
    {
        $board = is_array($payload['board'] ?? null) ? $payload['board'] : $payload;
        $id = (string) ($board['id'] ?? '');
        return [
            'resourceType' => 'board',
            'resourceId' => $id,
            'existence' => 'exists',
            'routeFamily' => 'board_detail',
            'routeParameters' => [],
            'publicationInput' => $this->implicitPublicInput(),
            'publicData' => [
                'id' => $id,
                'displayName' => (string) ($board['name'] ?? ''),
                'acronym' => $board['acronym'] ?? null,
                'fullName' => $board['name'] ?? null,
                'website' => $board['website'] ?? null,
                'publicDescription' => (string) ($board['description'] ?? ''),
                'publicQuestionCount' => (int) ($board['questionCount'] ?? 0),
                'publicExamCount' => (int) ($board['examCount'] ?? 0),
                'primaryImage' => $this->imageFromUrl($board['imageUrl'] ?? null, (string) ($board['name'] ?? '')),
                'breadcrumbs' => [],
            ],
            'qualityEvidence' => [],
        ];
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    private function taxonomyProjection(array $payload): array
    {
        $id = (string) ($payload['id'] ?? '');
        $kind = $this->taxonomyKind($payload);
        $parentRequired = in_array($kind, ['topic', 'subject'], true);
        $parentName = trim((string) ($payload['parentName'] ?? '')) ?: null;
        return [
            'resourceType' => 'taxonomy',
            'resourceId' => $id,
            'existence' => 'exists',
            'routeFamily' => match ($kind) {
                'discipline' => 'discipline_detail',
                'topic' => 'topic_detail',
                default => 'subject_detail',
            },
            'routeParameters' => [],
            'publicationInput' => $this->implicitPublicInput(),
            'publicData' => [
                'id' => $id,
                'displayName' => (string) ($payload['name'] ?? ''),
                'taxonomyKind' => $kind,
                'publicDescription' => (string) ($payload['description'] ?? ''),
                'parentName' => $parentName,
                'rootName' => $payload['rootName'] ?? null,
                'publicItemCount' => (int) ($payload['questionCount'] ?? 0) + (int) ($payload['examCount'] ?? 0),
                'primaryImage' => $this->imageFromUrl($payload['imageUrl'] ?? null, (string) ($payload['name'] ?? '')),
                'breadcrumbs' => [],
            ],
            'qualityEvidence' => [
                'hierarchyValid' => !$parentRequired || $parentName !== null || (int) ($payload['parentId'] ?? 0) > 0,
            ],
        ];
    }

    /** @param array<string, mixed> $payload
     *  @return array<string, mixed>
     */
    private function lawProjection(array $payload): array
    {
        $id = (string) ($payload['id'] ?? '');
        $articles = is_array($payload['articles'] ?? null) ? $payload['articles'] : [];
        $identifier = trim(implode(' ', array_filter([
            (string) ($payload['lawNumber'] ?? $payload['number'] ?? ''),
            (string) ($payload['lawYear'] ?? $payload['year'] ?? ''),
        ])));
        return [
            'resourceType' => 'law',
            'resourceId' => $id,
            'existence' => 'exists',
            'routeFamily' => 'law_detail',
            'routeParameters' => [],
            'publicationInput' => [
                'status' => $payload['status'] ?? 'published',
                'visibility' => 'public',
                'scheduledAt' => $payload['publishedAt'] ?? $payload['date'] ?? null,
                'provenanceStatus' => 'unknown',
                'rightsStatus' => 'not_evaluable',
            ],
            'publicData' => [
                'id' => $id,
                'displayName' => (string) ($payload['title'] ?? $payload['name'] ?? ''),
                'shortName' => $payload['shortTitle'] ?? null,
                'publicDescription' => (string) ($payload['description'] ?? $payload['summary'] ?? ''),
                // Conteudo editorial da lei permanece fora do SeoFacts publico.
                'commentaryExcerpt' => '',
                'identifier' => $identifier !== '' ? $identifier : null,
                'jurisdiction' => $payload['jurisdiction'] ?? null,
                'articleCount' => count($articles),
                'publishedAt' => $payload['publishedAt'] ?? $payload['date'] ?? null,
                'updatedAt' => $payload['updatedAt'] ?? null,
                'breadcrumbs' => [],
            ],
            'qualityEvidence' => [],
        ];
    }

    /** @return array<string, string> */
    private function implicitPublicInput(): array
    {
        return [
            'status' => 'published',
            'visibility' => 'public',
            'provenanceStatus' => 'unknown',
            'rightsStatus' => 'not_evaluable',
        ];
    }

    private function firstTaxonomyLabel(mixed $items): ?string
    {
        if (!is_array($items) || !is_array($items[0] ?? null)) {
            return null;
        }
        return $this->taxonomyName($items[0]);
    }

    private function taxonomyName(mixed $item): ?string
    {
        if (is_string($item)) {
            $name = trim($item);
        } elseif (is_array($item)) {
            $name = trim((string) ($item['label'] ?? $item['name'] ?? $item['nome'] ?? $item['acronym'] ?? ''));
        } else {
            $name = '';
        }
        return $name !== '' ? $name : null;
    }

    /** @return list<string> */
    private function taxonomyNames(mixed $items): array
    {
        if (!is_array($items)) {
            return [];
        }
        $names = [];
        foreach ($items as $item) {
            $name = $this->taxonomyName($item);
            if ($name !== null) {
                $names[$name] = true;
            }
        }
        return array_keys($names);
    }

    private function firstYear(mixed $years, mixed $exams): ?int
    {
        if (is_array($years)) {
            foreach ($years as $year) {
                $value = is_array($year) ? ($year['label'] ?? $year['name'] ?? null) : $year;
                if (is_numeric($value) && (int) $value >= 1900 && (int) $value <= 2200) {
                    return (int) $value;
                }
            }
        }
        if (is_array($exams)) {
            foreach ($exams as $exam) {
                if (is_array($exam) && is_numeric($exam['year'] ?? $exam['ano'] ?? null)) {
                    return (int) ($exam['year'] ?? $exam['ano']);
                }
            }
        }
        return null;
    }

    /** @param array<mixed> $alternatives */
    private function allAlternativesHaveContent(array $alternatives): bool
    {
        foreach ($alternatives as $alternative) {
            if (!is_array($alternative)) {
                return false;
            }
            $text = trim(strip_tags((string) ($alternative['text'] ?? $alternative['corpo'] ?? '')));
            $assets = is_array($alternative['assets'] ?? null) ? $alternative['assets'] : [];
            if ($text === '' && $assets === []) {
                return false;
            }
        }
        return true;
    }

    /** @param array<string, mixed> $filters */
    private function hasAnyTaxonomy(array $filters): bool
    {
        foreach (['subjects', 'topics', 'subtopics', 'examBoards', 'organizations', 'roles', 'assuntos', 'bancas', 'orgaos', 'cargos'] as $key) {
            if (is_array($filters[$key] ?? null) && $filters[$key] !== []) {
                return true;
            }
        }
        return false;
    }

    /** @param array<mixed> $assets */
    private function assetsAreResolvable(array $assets): bool
    {
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                return false;
            }
            $url = trim((string) ($asset['url'] ?? $asset['publicUrl'] ?? ''));
            $base64 = trim((string) ($asset['base64'] ?? ''));
            if (($url === '' && $base64 === '') || str_starts_with($url, 'blob:')) {
                return false;
            }
        }
        return true;
    }

    /** @param array<mixed> $contexts */
    private function contextAssetsAreResolvable(array $contexts): bool
    {
        foreach ($contexts as $context) {
            if (is_array($context) && !$this->assetsAreResolvable(is_array($context['assets'] ?? null) ? $context['assets'] : [])) {
                return false;
            }
        }
        return true;
    }

    /** @param array<mixed> $contexts */
    private function contextsHaveAssets(array $contexts): bool
    {
        foreach ($contexts as $context) {
            if (is_array($context) && is_array($context['assets'] ?? null) && $context['assets'] !== []) {
                return true;
            }
        }
        return false;
    }

    /** @param array<mixed> $assets
     *  @return array<string, mixed>|null
     */
    private function primaryImage(array $assets): ?array
    {
        foreach ($assets as $asset) {
            if (!is_array($asset) || ($asset['type'] ?? 'image') !== 'image') {
                continue;
            }
            $image = $this->imageFromUrl($asset['url'] ?? $asset['publicUrl'] ?? null, (string) ($asset['alt'] ?? ''));
            if ($image !== null) {
                return $image;
            }
        }
        return null;
    }

    /** @return array{url:string,alt:string,width:null,height:null}|null */
    private function imageFromUrl(mixed $urlValue, string $alt): ?array
    {
        $url = trim((string) $urlValue);
        if ($url === '' || str_starts_with($url, 'blob:') || !(str_starts_with($url, '/') || str_starts_with($url, 'https://'))) {
            return null;
        }
        return ['url' => $url, 'alt' => trim($alt), 'width' => null, 'height' => null];
    }

    /** @param array<string, mixed> $payload */
    private function taxonomyKind(array $payload): string
    {
        $level = strtolower(trim((string) ($payload['taxonomyLevel'] ?? $payload['taxonomy_level'] ?? '')));
        return match ($level) {
            'materia', 'discipline' => 'discipline',
            'topico', 'topic' => 'topic',
            default => 'subject',
        };
    }
}
