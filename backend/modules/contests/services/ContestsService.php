<?php

declare(strict_types=1);

require_once __DIR__ . '/../repositories/ContestsRepository.php';
require_once __DIR__ . '/../projections/PublicContestProjection.php';
require_once __DIR__ . '/../../filters/professional/ProfessionalTaxonomyReadinessValidator.php';
require_once __DIR__ . '/../../seo/routes/PublicRouteBuilder.php';
require_once __DIR__ . '/../../seo/services/SeoSlugService.php';

final class ContestsService
{
    private const STATUSES = [
        'announced', 'authorized', 'notice_published', 'registration_open', 'registration_closed',
        'exam_scheduled', 'exam_completed', 'results', 'completed', 'suspended', 'cancelled',
    ];

    public function __construct(private readonly ContestsRepository $repository) {}

    /** @return array<string,mixed> */
    public function directory(array $query, bool $openOnly = false): array
    {
        $page = max(1, (int) ($query['pagina'] ?? 1));
        $search = mb_substr(trim((string) ($query['busca'] ?? '')), 0, 120);
        $year = isset($query['ano']) && preg_match('/^\d{4}$/', (string) $query['ano']) ? (int) $query['ano'] : null;
        $status = trim((string) ($query['status'] ?? ''));
        if ($status !== '' && !in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException('Status de concurso invalido.');
        }
        $result = $this->repository->listPublic($page, 24, $search, $year, $status ?: null, $openOnly);
        $routes = new PublicRouteBuilder();
        $items = array_map(static function (array $row) use ($routes): array {
            $row['path'] = $routes->contestDetail((string) ($row['slug'] ?? ''));
            return PublicContestProjection::summary($row);
        }, $result['rows']);
        return [
            'items' => $items,
            'pageInfo' => [
                'page' => (int) $result['page'], 'pages' => (int) $result['pages'],
                'limit' => (int) $result['limit'], 'total' => (int) $result['total'],
            ],
        ];
    }

    /** @return array<string,mixed>|null */
    public function detail(string $slug): ?array
    {
        $slug = trim($slug);
        if ($slug === '' || strlen($slug) > 190 || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) !== 1) return null;
        $data = $this->repository->findPublicBySlug($slug);
        if ($data === null) return null;
        if (isset($data['redirectSlug'])) return ['redirectSlug' => (string) $data['redirectSlug']];

        $contest = $data['contest'];
        if ((int) ($contest['id'] ?? 0) <= 0 || trim((string) ($contest['title'] ?? '')) === '') return null;
        $routes = new PublicRouteBuilder();
        $slugger = new SeoSlugService();
        $canonicalPath = $routes->contestDetail((string) $contest['slug']);
        $data['canonicalPath'] = $canonicalPath;
        $data['organizations'] = array_map(static function (array $item) use ($routes): array {
            $item['path'] = $routes->organizationDetail((string) ($item['slug'] ?? ''));
            return $item;
        }, $data['organizations']);
        $data['board'] = !empty($contest['board_id']) ? [
            'id' => (int) $contest['board_id'], 'slug' => (string) $contest['board_slug'],
            'name' => (string) $contest['board_name'], 'acronym' => $contest['board_acronym'] ?: null,
            'path' => $routes->boardDetail((string) $contest['board_slug']),
        ] : null;
        $data['positions'] = array_map(static function (array $item) use ($routes): array {
            $item['path'] = $routes->positionDetail((string) ($item['slug'] ?? ''));
            return $item;
        }, array_values(array_filter(
            $data['positions'],
            static fn (mixed $item): bool => is_array($item)
                && ProfessionalTaxonomyReadinessValidator::evaluate($item + ['type' => 'cargo'], 'position')['status'] === 'READY'
        )));
        $data['exams'] = array_map(static function (array $item) use ($routes): array {
            $item['path'] = $routes->examDetail((string) ($item['slug'] ?? ''));
            return $item;
        }, $data['exams']);
        $data['questions'] = array_map(static function (array $item) use ($routes, $slugger): array {
            $id = (int) ($item['id'] ?? 0);
            $item['path'] = $routes->questionDetail($id, $slugger->slug((string) ($item['excerpt'] ?? ''), 'questao', $id));
            return $item;
        }, $data['questions']);
        $data['breadcrumbs'] = [
            ['label' => 'Inicio', 'canonicalPath' => '/'],
            ['label' => 'Concursos', 'canonicalPath' => $routes->contestsIndex()],
            ['label' => (string) $contest['title'], 'canonicalPath' => $canonicalPath],
        ];
        return PublicContestProjection::detail($data);
    }
}
