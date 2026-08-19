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

require_once __DIR__ . '/../repositories/FiltersRepository.php';
require_once __DIR__ . '/../validators/FiltersValidator.php';
require_once __DIR__ . '/../../seo/services/PublicSeoEnvelopeService.php';
require_once __DIR__ . '/../projections/PublicKnowledgeTaxonomyProjection.php';
require_once __DIR__ . '/../projections/PublicOrganizationProjection.php';
require_once __DIR__ . '/../../seo/routes/PublicRouteBuilder.php';
require_once __DIR__ . '/../../seo/services/SeoSlugService.php';
require_once __DIR__ . '/../../seo/taxonomy/PublicTaxonomyExposurePolicy.php';
require_once __DIR__ . '/../../seo/taxonomy/KnowledgeTaxonomyHierarchyValidator.php';

/**
 * Service do dominio de filtros/taxonomias.
 * Agrupa as taxonomias para o app e centraliza o CRUD administrativo.
 *
 * @since 1.0.0
 */
class FiltersService
{
    private FiltersRepository $repository;
    private FiltersValidator $validator;
    private PublicSeoEnvelopeService $publicSeoEnvelope;

    /**
     * Inicializa o service de filtros.
     *
     * @since 1.0.0
     */
    public function __construct(
        FiltersRepository $repository,
        FiltersValidator $validator
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
        $this->publicSeoEnvelope = new PublicSeoEnvelopeService();
    }

    /**
     * Retorna a lista de filtros agrupada por tipo.
     *
     * @since 1.0.0
     */
    public function list(): array
    {
        return $this->groupRows($this->repository->fetchAll());
    }

    /**
     * Contrato leve usado pelos seletores da pagina de pratica.
     */
    public function listPracticeCatalog(): array
    {
        return $this->groupRows($this->repository->fetchPracticeCatalog());
    }

    /**
     * Converte registros canonicos para o contrato historico de taxonomias.
     * O agrupamento e compartilhado para evitar divergencia entre o catalogo
     * administrativo completo e o catalogo publico reduzido.
     */
    private function groupRows(array $rows): array
    {
        $result = [
            'bancas' => [],
            'orgaos' => [],
            'assuntos' => [],
            'cargos' => [],
            'anos' => [],
            'carreiras' => [],
            'areas' => [],
        ];

        $rowsById = [];
        foreach ($rows as $entry) {
            $rowsById[(int) ($entry['id'] ?? 0)] = $entry;
        }

        foreach ($rows as $row) {
            $item = [
                'id' => $row['id'],
                'nome' => $row['name'],
                'slug' => $row['slug'],
                'sigla' => $row['acronym'] ?: null,
                'description' => $row['description'],
                'website' => $row['website'],
                'assetUrl' => $row['asset_url'],
                'iconKey' => $row['icon_key'],
                'keywords' => $this->decodeStringList($row['keywords_json'] ?? null),
                'aliases' => array_values($row['aliases'] ?? []),
            ];

            switch ($row['type']) {
                case 'banca':
                    $result['bancas'][] = $item;
                    break;

                case 'orgao':
                    $result['orgaos'][] = $item;
                    break;

                case 'assunto':
                    $taxonomyLevel = strtolower(trim((string) ($row['taxonomy_level'] ?? '')));
                    if (!in_array($taxonomyLevel, ['materia', 'topico', 'subtopico', 'assunto'], true)) {
                        if (!empty($row['meta_materia'])) {
                            $taxonomyLevel = 'materia';
                        } else {
                            $parentId = (int) ($row['parent_id'] ?? 0);
                            $parent = $parentId > 0 ? ($rowsById[$parentId] ?? null) : null;
                            if ($parent && empty($parent['meta_materia'])) {
                                $parentTaxonomyLevel = strtolower(trim((string) ($parent['taxonomy_level'] ?? '')));
                                $taxonomyLevel = $parentTaxonomyLevel === 'topico' ? 'subtopico' : ($parentTaxonomyLevel === 'subtopico' ? 'assunto' : 'topico');
                            } else {
                                $taxonomyLevel = 'topico';
                            }
                        }
                    }

                    $item['materia'] = (bool) ($row['meta_materia'] ?? 0);
                    $item['pai'] = $row['parent_id'];
                    $item['taxonomy_level'] = $taxonomyLevel;
                    $result['assuntos'][] = $item;
                    break;

                case 'cargo':
                    $item['descricao'] = $row['name'];
                    $item['carreira'] = (bool) ($row['meta_carreira'] ?? 0);
                    $item['pai'] = $row['parent_id'];
                    $result['cargos'][] = $item;
                    break;

                case 'carreira':
                    $item['pai'] = $row['parent_id'];
                    $result['carreiras'][] = $item;
                    break;

                case 'area':
                    $item['pai'] = $row['parent_id'];
                    $result['areas'][] = $item;
                    break;

                case 'ano':
                    $result['anos'][] = (int) $row['name'];
                    break;
            }
        }

        return $result;
    }

    /**
     * Lista a biblioteca administrativa de taxonomias de forma paginada.
     */
    public function listPage(int $page, int $perPage, string $type = 'all', string $search = ''): array
    {
        $pageData = $this->repository->fetchPage($page, $perPage, $type, $search);
        $filterIds = array_map(static fn (array $row): int => (int) $row['id'], $pageData['rows']);
        $usageByFilterId = $this->repository->fetchUsageOverview($filterIds);

        $rows = array_map(function (array $row) use ($usageByFilterId): array {
            return [
                'id' => (int) $row['id'],
                'type' => $this->resolveUiType($row),
                'name' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'sigla' => $row['acronym'] ?: null,
                'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
                'parentName' => $row['parent_name'] ?: null,
                'description' => $row['description'],
                'website' => $row['website'],
                'assetUrl' => $row['asset_url'],
                'iconKey' => $row['icon_key'],
                'aliases' => array_values($row['aliases'] ?? []),
                'keywords' => $this->decodeStringList($row['keywords_json'] ?? null),
                'taxonomyLevel' => $row['taxonomy_level'] ?: null,
                'relationships' => array_values($row['relationships'] ?? []),
                'usage' => $usageByFilterId[(int) $row['id']] ?? $this->emptyUsage(),
            ];
        }, $pageData['rows']);

        return [
            'rows' => $rows,
            'total' => $pageData['total'],
            'page' => $pageData['page'],
            'perPage' => $pageData['perPage'],
            'pages' => $pageData['pages'],
            'usage' => $this->repository->fetchUsageSummary(),
        ];
    }

    /**
     * Contrato publico minimo para diretorios de taxonomias e entidades.
     */
    public function listPublicDirectory(
        string $directoryType,
        int $page,
        int $perPage,
        string $search = '',
        string $letter = ''
    ): array {
        if (!in_array($directoryType, ['subjects', 'boards', 'organizations'], true)) {
            throw new InvalidArgumentException('Tipo de diretorio publico invalido.');
        }

        $pageData = $this->repository->fetchPublicDirectory(
            $directoryType,
            $page,
            $perPage,
            $search,
            $letter
        );

        $rows = $pageData['rows'];
        if ($directoryType === 'organizations') {
            $exposure = new PublicTaxonomyExposurePolicy();
            $rows = array_values(array_filter($rows, static fn (array $row): bool => $exposure->allowsOrganization(
                $row + ['type' => 'orgao', 'taxonomy_level' => null]
            )));
        }

        $items = array_map(function (array $row) use ($directoryType): array {
            $item = [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'acronym' => $row['acronym'] ?: null,
                'description' => $row['description'] ?: null,
                'imageUrl' => $row['asset_url'] ?: null,
                'questionCount' => (int) $row['question_count'],
                'examCount' => (int) ($row['exam_count'] ?? 0),
            ];

            if ($directoryType === 'boards') {
                return $this->publicSeoEnvelope->attachBoard($item);
            }
            if ($directoryType === 'organizations') {
                return $this->publicSeoEnvelope->attachOrganization($item);
            }

            $taxonomyPayload = $this->publicSeoEnvelope->attachTaxonomy($item + ['taxonomyLevel' => 'materia']);
            unset($taxonomyPayload['taxonomyLevel']);
            return $taxonomyPayload;
        }, $rows);

        return [
            'items' => $items,
            'pageInfo' => [
                'page' => (int) $pageData['page'],
                'perPage' => (int) $pageData['perPage'],
                'pages' => (int) $pageData['pages'],
                'total' => (int) $pageData['total'],
                'hasPrevious' => (int) $pageData['page'] > 1,
                'hasMore' => (int) $pageData['page'] < (int) $pageData['pages'],
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public function getPublicDisciplineProjection(string $slug): ?array
    {
        return $this->getPublicKnowledgeTaxonomyProjection($slug, 'materia');
    }

    /** @return array<string, mixed>|null */
    public function getPublicKnowledgeTaxonomyProjection(string $slug, string $level): ?array
    {
        $slug = strtolower(trim($slug));
        if (!in_array($level, ['materia', 'topico', 'assunto'], true)
            || $slug === '' || strlen($slug) > 190 || preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
            return null;
        }

        $data = $level === 'materia'
            ? $this->repository->fetchPublicDisciplineProjectionData($slug)
            : $this->repository->fetchPublicKnowledgeTaxonomyProjectionData($slug, $level);
        if ($data === null) {
            return null;
        }
        $identity = is_array($data['identity'] ?? null) ? $data['identity'] : [];
        if (!(new PublicTaxonomyExposurePolicy())->allowsKnowledgeTaxonomy($identity, $level)) {
            return null;
        }

        $routes = new PublicRouteBuilder();
        $slugger = new SeoSlugService();
        $persistedSlug = (string) ($identity['slug'] ?? '');
        $data['requestedSlug'] = (string) ($identity['requested_slug'] ?? $slug);
        $data['taxonomyLevel'] = $level;
        $data['readiness'] = KnowledgeTaxonomyHierarchyValidator::evaluate($identity, $level);
        $invalidTaxonomyChain = in_array(
            'instance_readiness.invalid_taxonomy_chain',
            $data['readiness']['reasonCodes'] ?? [],
            true
        );
        $data['canonicalPath'] = match ($level) {
            'materia' => $routes->disciplineDetail($persistedSlug),
            'topico' => $routes->topicDetail($persistedSlug),
            'assunto' => $routes->subjectDetail($persistedSlug),
        };
        $data['questionsPath'] = $routes->questionsIndex([
            match ($level) { 'materia' => 'materia', 'topico' => 'topico', default => 'assunto' }
                => (string) ($identity['name'] ?? ''),
        ]);

        $parent = $invalidTaxonomyChain ? null : $this->publicKnowledgeAncestor($identity, 'parent');
        $grandparent = $this->publicKnowledgeAncestor($identity, 'grandparent');
        $greatGrandparent = $this->publicKnowledgeAncestor($identity, 'great_grandparent');
        $data['parent'] = $parent;
        $root = null;
        $topic = null;
        if ($level === 'topico' && ($parent['taxonomyLevel'] ?? '') === 'materia') {
            $root = $parent;
            $topic = $this->publicKnowledgeIdentity($identity);
        } elseif ($level === 'assunto' && ($parent['taxonomyLevel'] ?? '') === 'topico') {
            $topic = $parent;
            $root = ($grandparent['taxonomyLevel'] ?? '') === 'materia' ? $grandparent : null;
        } elseif ($level === 'assunto' && ($parent['taxonomyLevel'] ?? '') === 'subtopico') {
            $topic = ($grandparent['taxonomyLevel'] ?? '') === 'topico' ? $grandparent : null;
            $root = ($greatGrandparent['taxonomyLevel'] ?? '') === 'materia' ? $greatGrandparent : null;
        }
        $data['root'] = $root;
        $data['topic'] = $topic;
        $data['subtopic'] = $level === 'assunto' && ($parent['taxonomyLevel'] ?? '') === 'subtopico'
            ? $parent
            : null;

        $children = !$invalidTaxonomyChain && is_array($data['children'] ?? null)
            ? array_values(array_filter($data['children'], 'is_array'))
            : [];
        $data['topics'] = [];
        $data['subtopics'] = [];
        $data['subjects'] = [];
        foreach ($children as $child) {
            $childLevel = strtolower(trim((string) ($child['taxonomy_level'] ?? '')));
            if (!(new PublicTaxonomyExposurePolicy())->allowsKnowledgeTaxonomy($child, $childLevel)) continue;
            if (!$this->publicKnowledgeChildIsReady($child, $identity, $level)) continue;
            if ($childLevel === 'topico') {
                $child['path'] = $routes->topicDetail((string) ($child['slug'] ?? ''));
                $child['questionsPath'] = $routes->questionsIndex(['topico' => (string) ($child['name'] ?? '')]);
                $data['topics'][] = $child;
            } elseif ($childLevel === 'subtopico') {
                $data['subtopics'][] = $child;
            } elseif ($childLevel === 'assunto') {
                $child['path'] = $routes->subjectDetail((string) ($child['slug'] ?? ''));
                $child['questionsPath'] = $routes->questionsIndex(['assunto' => (string) ($child['name'] ?? '')]);
                $child['subtopicId'] = (int) (($child['parent_id'] ?? 0) === (int) ($identity['id'] ?? 0) ? 0 : ($child['parent_id'] ?? 0));
                $child['subtopicName'] = $child['subtopicId'] > 0 ? ($child['parent_name'] ?? null) : null;
                $data['subjects'][] = $child;
            }
        }
        $data['exams'] = array_map(static function (array $exam) use ($routes): array {
            $exam['path'] = $routes->examDetail((string) ($exam['slug'] ?? ''));
            return $exam;
        }, is_array($data['exams'] ?? null) ? $data['exams'] : []);
        $data['contests'] = array_map(static function (array $contest) use ($routes): array {
            $contest['path'] = $routes->contestDetail((string) ($contest['slug'] ?? ''));
            return $contest;
        }, is_array($data['contests'] ?? null) ? $data['contests'] : []);
        $data['boards'] = array_map(static function (array $board) use ($routes): array {
            $board['path'] = $routes->boardDetail((string) ($board['slug'] ?? ''));
            return $board;
        }, is_array($data['boards'] ?? null) ? $data['boards'] : []);
        $exposure = new PublicTaxonomyExposurePolicy();
        $data['organizations'] = array_map(static function (array $organization) use ($routes): array {
            $organization['path'] = $routes->organizationDetail((string) ($organization['slug'] ?? ''));
            return $organization;
        }, array_values(array_filter(
            is_array($data['organizations'] ?? null) ? $data['organizations'] : [],
            static fn (mixed $organization): bool => is_array($organization) && $exposure->allowsOrganization($organization)
        )));
        $data['questions'] = array_map(static function (array $question) use ($routes, $slugger): array {
            $id = (int) ($question['id'] ?? 0);
            $question['path'] = $routes->questionDetail(
                $id,
                $slugger->slug((string) ($question['excerpt'] ?? ''), 'questao', $id)
            );
            return $question;
        }, is_array($data['questions'] ?? null) ? $data['questions'] : []);
        $breadcrumbs = [
            ['label' => 'Início', 'canonicalPath' => '/'],
            ['label' => 'Disciplinas', 'canonicalPath' => '/disciplinas'],
        ];
        if ($level !== 'materia' && is_array($data['root']) && ($data['root']['path'] ?? '') !== '') {
            $breadcrumbs[] = ['label' => (string) $data['root']['name'], 'canonicalPath' => (string) $data['root']['path']];
        }
        if ($level === 'assunto' && is_array($data['topic']) && ($data['topic']['path'] ?? '') !== '') {
            $breadcrumbs[] = ['label' => (string) $data['topic']['name'], 'canonicalPath' => (string) $data['topic']['path']];
        }
        $breadcrumbs[] = ['label' => (string) ($identity['name'] ?? ''), 'canonicalPath' => $data['canonicalPath']];

        $projection = PublicKnowledgeTaxonomyProjection::fromRepositoryData($data, $breadcrumbs);
        return $this->publicSeoEnvelope->attachTaxonomy($projection);
    }

    /** @param array<string, mixed> $child @param array<string, mixed> $parent */
    private function publicKnowledgeChildIsReady(array $child, array $parent, string $parentLevel): bool
    {
        $childLevel = strtolower(trim((string) ($child['taxonomy_level'] ?? '')));
        if (!in_array($childLevel, ['topico', 'assunto'], true)) {
            return $childLevel === 'subtopico';
        }

        $identity = [
            'id' => (int) ($child['id'] ?? 0),
            'type' => (string) ($child['type'] ?? ''),
            'taxonomy_level' => $childLevel,
            'meta_materia' => (int) ($child['meta_materia'] ?? 0),
            'slug' => (string) ($child['slug'] ?? ''),
            'name' => (string) ($child['name'] ?? ''),
            'own_parent_id' => (int) ($child['parent_id'] ?? 0),
        ];

        if ($childLevel === 'topico' && $parentLevel === 'materia') {
            $this->copyKnowledgeAncestor($identity, 'parent', $parent);
        } elseif ($childLevel === 'assunto' && $parentLevel === 'topico') {
            if ((int) ($child['parent_id'] ?? 0) === (int) ($parent['id'] ?? 0)) {
                $this->copyKnowledgeAncestor($identity, 'parent', $parent);
                $this->copyKnowledgeAncestor($identity, 'grandparent', $this->publicKnowledgeAncestor($parent, 'parent') ?? []);
            } else {
                $subtopic = [
                    'id' => (int) ($child['parent_id'] ?? 0),
                    'parent_id' => (int) ($parent['id'] ?? 0),
                    'type' => 'assunto',
                    'taxonomy_level' => 'subtopico',
                    'meta_materia' => 0,
                    'slug' => (string) ($child['parent_slug'] ?? ''),
                    'name' => (string) ($child['parent_name'] ?? ''),
                ];
                if (!(new PublicTaxonomyExposurePolicy())->allowsKnowledgeTaxonomy($subtopic, 'subtopico')) return false;
                $this->copyKnowledgeAncestor($identity, 'parent', $subtopic);
                $this->copyKnowledgeAncestor($identity, 'grandparent', $parent);
                $this->copyKnowledgeAncestor($identity, 'great_grandparent', $this->publicKnowledgeAncestor($parent, 'parent') ?? []);
            }
        }

        return KnowledgeTaxonomyHierarchyValidator::evaluate($identity, $childLevel)['status'] === 'READY';
    }

    /** @param array<string, mixed> $identity @param array<string, mixed> $ancestor */
    private function copyKnowledgeAncestor(array &$identity, string $prefix, array $ancestor): void
    {
        $identity[$prefix . '_id'] = (int) ($ancestor['id'] ?? 0);
        $identity[$prefix . '_parent_id'] = (int) ($ancestor['own_parent_id'] ?? $ancestor['parent_id'] ?? 0);
        $identity[$prefix . '_type'] = (string) ($ancestor['type'] ?? 'assunto');
        $identity[$prefix . '_taxonomy_level'] = (string) ($ancestor['taxonomy_level'] ?? $ancestor['taxonomyLevel'] ?? '');
        $identity[$prefix . '_meta_materia'] = (int) ($ancestor['meta_materia'] ?? 0);
        $identity[$prefix . '_slug'] = (string) ($ancestor['slug'] ?? '');
        $identity[$prefix . '_name'] = (string) ($ancestor['name'] ?? '');
    }

    /** @param array<string, mixed> $identity @return array<string, mixed>|null */
    private function publicKnowledgeAncestor(array $identity, string $prefix): ?array
    {
        $id = (int) ($identity[$prefix . '_id'] ?? 0);
        if ($id <= 0) return null;
        $item = [
            'id' => $id,
            'slug' => (string) ($identity[$prefix . '_slug'] ?? ''),
            'name' => (string) ($identity[$prefix . '_name'] ?? ''),
            'taxonomyLevel' => !empty($identity[$prefix . '_meta_materia'])
                ? 'materia'
                : (string) ($identity[$prefix . '_taxonomy_level'] ?? ''),
        ];
        $routes = new PublicRouteBuilder();
        $item['path'] = match ($item['taxonomyLevel']) {
            'materia' => $routes->disciplineDetail($item['slug']),
            'topico' => $routes->topicDetail($item['slug']),
            'assunto' => $routes->subjectDetail($item['slug']),
            default => '',
        };
        return $item;
    }

    /** @param array<string, mixed> $identity @return array<string, mixed> */
    private function publicKnowledgeIdentity(array $identity): array
    {
        return [
            'id' => (int) ($identity['id'] ?? 0),
            'slug' => (string) ($identity['slug'] ?? ''),
            'name' => (string) ($identity['name'] ?? ''),
            'taxonomyLevel' => !empty($identity['meta_materia']) ? 'materia' : (string) ($identity['taxonomy_level'] ?? ''),
            'path' => (new PublicRouteBuilder())->topicDetail((string) ($identity['slug'] ?? '')),
        ];
    }

    /** @return array<string, mixed>|null */
    public function getPublicOrganizationProjection(string $slug): ?array
    {
        $slug = strtolower(trim($slug));
        if ($slug === '' || strlen($slug) > 190 || preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
            return null;
        }

        $data = $this->repository->fetchPublicOrganizationProjectionData($slug);
        if ($data === null) {
            return null;
        }
        $identity = is_array($data['identity'] ?? null) ? $data['identity'] : [];
        if (!(new PublicTaxonomyExposurePolicy())->allowsOrganization($identity)) {
            return null;
        }

        $routes = new PublicRouteBuilder();
        $slugger = new SeoSlugService();
        $persistedSlug = (string) ($identity['slug'] ?? '');
        $organizationName = (string) ($identity['name'] ?? '');
        $data['canonicalPath'] = $routes->organizationDetail($persistedSlug);
        $data['questionsPath'] = $routes->questionsIndex(['orgao' => $organizationName]);
        $data['roles'] = array_map(static function (array $role) use ($routes): array {
            $role['questionsPath'] = $routes->questionsIndex(['cargo' => (string) ($role['name'] ?? '')]);
            return $role;
        }, is_array($data['roles'] ?? null) ? $data['roles'] : []);
        $data['disciplines'] = array_map(static function (array $discipline) use ($routes): array {
            $discipline['path'] = $routes->disciplineDetail((string) ($discipline['slug'] ?? ''));
            return $discipline;
        }, is_array($data['disciplines'] ?? null) ? $data['disciplines'] : []);
        $data['boards'] = array_map(static function (array $board) use ($routes): array {
            $board['path'] = $routes->boardDetail((string) ($board['slug'] ?? ''));
            return $board;
        }, is_array($data['boards'] ?? null) ? $data['boards'] : []);
        $data['exams'] = array_map(static function (array $exam) use ($routes): array {
            $exam['path'] = $routes->examDetail((string) ($exam['slug'] ?? ''));
            return $exam;
        }, is_array($data['exams'] ?? null) ? $data['exams'] : []);
        $data['questions'] = array_map(static function (array $question) use ($routes, $slugger): array {
            $id = (int) ($question['id'] ?? 0);
            $question['path'] = $routes->questionDetail(
                $id,
                $slugger->slug((string) ($question['excerpt'] ?? ''), 'questao', $id)
            );
            return $question;
        }, is_array($data['questions'] ?? null) ? $data['questions'] : []);

        $projection = PublicOrganizationProjection::fromRepositoryData($data, [
            ['label' => 'Início', 'canonicalPath' => '/'],
            ['label' => 'Órgãos', 'canonicalPath' => $routes->organizationsIndex()],
            ['label' => $organizationName, 'canonicalPath' => $routes->organizationDetail($persistedSlug)],
        ]);
        return $this->publicSeoEnvelope->attachOrganization($projection);
    }

    public function getPublicBoardDetail(string $slug, int $page, int $perPage, string $status = 'all'): ?array
    {
        $slug = strtolower(trim($slug));
        if ($slug === '' || strlen($slug) > 190 || preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
            throw new InvalidArgumentException('Banca invalida.');
        }
        if (!in_array($status, ['all', 'open', 'upcoming', 'completed', 'unknown'], true)) {
            throw new InvalidArgumentException('Status de concurso invalido.');
        }

        $data = $this->repository->fetchPublicBoardDetail($slug, $page, $perPage, $status);
        if ($data === null) {
            return null;
        }

        $board = $data['board'];
        $profile = [];
        foreach ($data['questionProfile'] as $row) {
            $profile[] = [
                'modality' => (string) ($row['modality'] ?? 'nao_informado'),
                'difficulty' => (int) ($row['difficulty'] ?? 0),
                'questionCount' => (int) ($row['question_count'] ?? 0),
            ];
        }

        $payload = [
            'board' => [
                'id' => (int) $board['id'],
                'name' => (string) $board['name'],
                'slug' => (string) $board['slug'],
                'acronym' => $board['acronym'] ?: null,
                'description' => $board['description'] ?: null,
                'website' => $board['website'] ?: null,
                'imageUrl' => $board['asset_url'] ?: null,
                'questionCount' => (int) ($board['question_count'] ?? 0),
                'examCount' => (int) ($board['exam_count'] ?? 0),
            ],
            'examSummary' => [
                'total' => (int) ($data['examSummary']['total'] ?? 0),
                'open' => (int) ($data['examSummary']['open_count'] ?? 0),
                'upcoming' => (int) ($data['examSummary']['upcoming_count'] ?? 0),
                'completed' => (int) ($data['examSummary']['completed_count'] ?? 0),
                'unknown' => (int) ($data['examSummary']['unknown_count'] ?? 0),
            ],
            'topSubjects' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'questionCount' => (int) ($row['question_count'] ?? 0),
            ], $data['topSubjects']),
            'questionProfile' => $profile,
            'exams' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'title' => (string) $row['nome'],
                'slug' => (string) $row['slug'],
                'year' => (int) ($row['ano'] ?? 0),
                'registrationStart' => $row['inscricoes_inicio'] ?? null,
                'registrationEnd' => $row['inscricoes_fim'] ?? null,
                'examDate' => $row['data_prova'] ?? null,
                'resultDate' => $row['resultado_data'] ?? null,
                'questionCount' => (int) ($row['question_count'] ?? 0),
                'organizations' => array_values(array_filter(explode('||', (string) ($row['organizations'] ?? '')))),
                'status' => (string) ($row['public_status'] ?? 'unknown'),
            ], $data['exams']),
            'pageInfo' => [
                'page' => (int) $data['page'],
                'perPage' => (int) $data['perPage'],
                'pages' => (int) $data['pages'],
                'total' => (int) $data['total'],
                'hasPrevious' => (int) $data['page'] > 1,
                'hasMore' => (int) $data['page'] < (int) $data['pages'],
            ],
        ];

        return $this->publicSeoEnvelope->attachBoard($payload);
    }

    /**
     * Contrato publico paginado para expansao progressiva da arvore.
     */
    public function listPublicTaxonomyChildren(int $parentId, int $page, int $perPage): array
    {
        if ($parentId <= 0) {
            throw new InvalidArgumentException('Taxonomia pai invalida.');
        }

        if (!$this->repository->publicKnowledgeTaxonomyExists($parentId)) {
            throw new InvalidArgumentException('Taxonomia pai nao encontrada.');
        }

        $pageData = $this->repository->fetchPublicTaxonomyChildren($parentId, $page, $perPage);

        return [
            'items' => array_map(function (array $row) use ($parentId): array {
                return $this->publicSeoEnvelope->attachTaxonomy([
                    'id' => (int) $row['id'],
                    'name' => (string) $row['name'],
                    'slug' => (string) $row['slug'],
                    'taxonomyLevel' => (string) ($row['taxonomy_level'] ?: 'assunto'),
                    'questionCount' => (int) $row['question_count'],
                    'hasChildren' => (bool) $row['has_children'],
                    'parentId' => $parentId,
                ]);
            }, $pageData['rows']),
            'pageInfo' => [
                'page' => (int) $pageData['page'],
                'perPage' => (int) $pageData['perPage'],
                'pages' => (int) $pageData['pages'],
                'total' => (int) $pageData['total'],
                'hasMore' => (int) $pageData['page'] < (int) $pageData['pages'],
            ],
        ];
    }

    /**
     * Carrega o registro administrativo completo imediatamente antes da
     * edicao. A listagem continua leve e paginada; o modal deixa de depender
     * de uma linha potencialmente antiga mantida no estado do navegador.
     */
    public function getAdminDetail(int $id): array
    {
        $this->validator->validatePositiveId($id, 'Filtro invalido.');
        $row = $this->repository->fetchById($id);
        if ($row === null) {
            throw new InvalidArgumentException('Filtro nao encontrado.');
        }

        $usageByFilterId = $this->repository->fetchUsageOverview([$id]);
        return [
            'id' => (int) $row['id'],
            'type' => $this->resolveUiType($row),
            'name' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'sigla' => $row['acronym'] ?: null,
            'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
            'parentName' => $row['parent_name'] ?: null,
            'description' => $row['description'],
            'website' => $row['website'],
            'assetUrl' => $row['asset_url'],
            'iconKey' => $row['icon_key'],
            'aliases' => array_values($row['aliases'] ?? []),
            'keywords' => $this->decodeStringList($row['keywords_json'] ?? null),
            'taxonomyLevel' => $row['taxonomy_level'] ?: null,
            'relationships' => array_values($row['relationships'] ?? []),
            'sourceIdentities' => array_values($row['sourceIdentities'] ?? []),
            'usage' => $usageByFilterId[$id] ?? $this->emptyUsage(),
        ];
    }

    private function resolveUiType(array $row): string
    {
        if (($row['type'] ?? '') !== 'assunto') {
            return (string) ($row['type'] ?? '');
        }

        $taxonomyLevel = strtolower(trim((string) ($row['taxonomy_level'] ?? '')));
        if (!empty($row['meta_materia']) || $taxonomyLevel === 'materia') {
            return 'materia';
        }
        if ($taxonomyLevel === 'topico') {
            return 'topico';
        }
        return 'assunto';
    }

    private function emptyUsage(): array
    {
        return [
            'questions' => 0,
            'exams' => 0,
            'laws' => 0,
            'total' => 0,
        ];
    }

    /**
     * Salva uma taxonomia validando integridade de slug e hierarquia.
     *
     * @since 1.0.0
     */
    public function save(array $data): array
    {
        $this->validator->validateSavePayload($data);

        $id = isset($data['id']) ? (int) $data['id'] : null;
        $type = trim((string) ($data['type'] ?? ''));
        $name = trim((string) ($data['name'] ?? ''));
        $slug = trim((string) ($data['slug'] ?? strtolower(trim((string) preg_replace('/[^A-Za-z0-9-]+/', '-', $name)))));
        $metadata = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
        $acronym = $this->normalizeAcronym((string) ($data['sigla'] ?? $data['acronym'] ?? $metadata['sigla'] ?? ''));
        $parentId = isset($data['parent_id']) && $data['parent_id'] !== '' ? (int) $data['parent_id'] : null;
        $description = trim((string) ($data['description'] ?? ''));
        $website = trim((string) ($data['website'] ?? ''));
        $assetUrl = trim((string) ($data['assetUrl'] ?? $data['asset_url'] ?? ''));
        $iconKey = trim((string) ($data['iconKey'] ?? $data['icon_key'] ?? ''));
        $aliases = $this->normalizeStringList($data['aliases'] ?? []);
        $keywords = $this->normalizeStringList($data['keywords'] ?? []);
        $taxonomyLevelInput = strtolower(trim((string) ($data['taxonomy_level'] ?? $data['taxonomyLevel'] ?? '')));

        $metaMateria = 0;
        $metaCarreira = 0;
        $taxonomyLevel = null;
        if ($type === 'assunto') {
            $metaMateria = $parentId ? 0 : 1;
            if ($metaMateria === 1) {
                $taxonomyLevel = 'materia';
            } elseif (in_array($taxonomyLevelInput, ['topico', 'subtopico', 'assunto'], true)) {
                $taxonomyLevel = $taxonomyLevelInput;
            } elseif ($parentId) {
                $parent = $this->repository->fetchById($parentId);
                if ($parent) {
                    $parentMetaMateria = !empty($parent['meta_materia']);
                    $parentTaxonomyLevel = strtolower(trim((string) ($parent['taxonomy_level'] ?? '')));
                    if ($parentMetaMateria) {
                        $taxonomyLevel = 'topico';
                    } elseif ($parentTaxonomyLevel === 'topico') {
                        $taxonomyLevel = 'subtopico';
                    } elseif ($parentTaxonomyLevel === 'subtopico') {
                        $taxonomyLevel = 'assunto';
                    } else {
                        $taxonomyLevel = 'topico';
                    }
                } else {
                    $taxonomyLevel = 'topico';
                }
            }
        }
        if ($type === 'cargo') {
            $metaCarreira = $parentId ? 0 : 1;
        }

        $canonicalMatch = null;
        if (($type === 'banca' || $type === 'orgao') && ($id === null || $id <= 0)) {
            $canonicalMatch = $this->repository->findCanonicalMatch($type, $name, $slug, $acronym);
            if (is_array($canonicalMatch)) {
                $id = (int) $canonicalMatch['id'];
                $existingName = trim((string) ($canonicalMatch['name'] ?? ''));
                $existingAcronym = $this->normalizeAcronym((string) ($canonicalMatch['acronym'] ?? ''));
                $existingNameIsAcronym = $this->normalizeLookupText($existingName) !== ''
                    && $this->normalizeLookupText($existingName) === $this->normalizeLookupText($existingAcronym ?: $acronym);
                $incomingNameIsAcronym = $this->normalizeLookupText($name) === $this->normalizeLookupText($acronym);
                if (!$existingNameIsAcronym || $name === '' || $incomingNameIsAcronym) {
                    $name = $existingName ?: $name;
                }
                $acronym = $acronym ?: $existingAcronym;
                if (!$existingNameIsAcronym || $incomingNameIsAcronym) {
                    $slug = trim((string) ($canonicalMatch['slug'] ?? '')) ?: $slug;
                }
                $aliases = $this->normalizeStringList([
                    ...($canonicalMatch['aliases'] ?? []),
                    ...$aliases,
                    $existingName,
                    (string) ($canonicalMatch['acronym'] ?? ''),
                    $name,
                    $acronym,
                ]);
                $description = $description ?: trim((string) ($canonicalMatch['description'] ?? ''));
                $website = $website ?: trim((string) ($canonicalMatch['website'] ?? ''));
                $assetUrl = $assetUrl ?: trim((string) ($canonicalMatch['asset_url'] ?? ''));
                $iconKey = $iconKey ?: trim((string) ($canonicalMatch['icon_key'] ?? ''));
            }
        }

        if ($this->repository->acronymExists($type, $acronym, $id)) {
            throw new RuntimeException("A sigla '{$acronym}' ja pertence a outra taxonomia deste tipo.", 409);
        }

        if ($this->repository->slugExists($type, $slug, $id)) {
            throw new RuntimeException("O slug '{$slug}' ja esta em uso neste tipo de taxonomia.", 409);
        }

        $payload = [
            'id' => $id,
            'type' => $type,
            'name' => $name,
            'slug' => $slug,
            'acronym' => $acronym !== '' ? $acronym : null,
            'parent_id' => $parentId,
            'description' => $description !== '' ? $description : null,
            'website' => $website !== '' ? $website : null,
            'asset_url' => $assetUrl !== '' ? $assetUrl : null,
            'icon_key' => $iconKey !== '' ? $iconKey : null,
            'keywords_json' => $keywords !== [] ? json_encode($keywords, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            'aliases' => $aliases,
            'meta_materia' => $metaMateria,
            'taxonomy_level' => $taxonomyLevel,
            'meta_carreira' => $metaCarreira,
        ];

        if ($id !== null && $id > 0) {
            $this->repository->update($payload);

            return [
                'id' => $id,
                'message' => $canonicalMatch ? 'Taxonomia existente reutilizada e atualizada com sucesso' : 'Filtro atualizado com sucesso',
                'audit_action' => 'filter.update',
                'audit_entity_id' => (string) $id,
                'audit_metadata' => ['type' => $type, 'name' => $name, 'slug' => $slug],
            ];
        }

        $newId = $this->repository->create($payload);

        return [
            'id' => $newId,
            'message' => 'Filtro criado com sucesso',
            'audit_action' => 'filter.create',
            'audit_entity_id' => (string) $newId,
            'audit_metadata' => ['type' => $type, 'name' => $name, 'slug' => $slug],
        ];
    }

    /**
     * Exclui uma taxonomia pelo id informado.
     *
     * @since 1.0.0
     */
    public function delete(int $id): array
    {
        $this->validator->validatePositiveId($id, 'ID nao fornecido');
        $this->repository->delete($id);

        return [
            'message' => 'Filtro excluido com sucesso',
            'audit_action' => 'filter.delete',
            'audit_entity_id' => (string) $id,
        ];
    }

    /**
     * Exclui uma selecao de taxonomias em uma unica operacao administrativa.
     */
    public function deleteMany(mixed $ids): array
    {
        $normalizedIds = $this->validator->normalizeDeleteIds($ids);
        $deletedIds = $this->repository->deleteMany($normalizedIds);

        return [
            'deletedIds' => $deletedIds,
            'deletedCount' => count($deletedIds),
            'message' => count($deletedIds) . ' taxonomia(s) excluida(s) com sucesso.',
            'audit_action' => 'filter.bulk-delete',
            'audit_entity_id' => 'bulk',
            'audit_metadata' => ['ids' => $deletedIds, 'count' => count($deletedIds)],
        ];
    }

    private function normalizeStringList(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/[,;\r\n]+/', $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }
        $normalized = [];
        foreach ($value as $item) {
            $item = trim((string) $item);
            if ($item !== '') {
                $normalized[mb_strtolower($item, 'UTF-8')] = $item;
            }
        }
        return array_values($normalized);
    }

    private function decodeStringList(mixed $value): array
    {
        if (is_array($value)) {
            return $this->normalizeStringList($value);
        }
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        $decoded = json_decode($value, true);
        return $this->normalizeStringList(is_array($decoded) ? $decoded : []);
    }

    private function normalizeAcronym(string $value): string
    {
        $value = trim((string) preg_replace('/\s+/', ' ', $value));
        return mb_substr(mb_strtoupper($value, 'UTF-8'), 0, 40, 'UTF-8');
    }

    private function normalizeLookupText(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $transliterated !== false ? $transliterated : $value;
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $value));
    }
}
