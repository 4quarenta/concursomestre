<?php

declare(strict_types=1);

require_once __DIR__ . '/PublicSimulationsRepository.php';
require_once __DIR__ . '/PublicSimulationProjection.php';
require_once __DIR__ . '/PublicSimulationReadinessValidator.php';
require_once __DIR__ . '/../../seo/routes/PublicRouteBuilder.php';
require_once __DIR__ . '/../../seo/services/SeoSlugService.php';

final class PublicSimulationsService
{
    public function __construct(private readonly PublicSimulationsRepository $repository) {}

    /** @return array<string,mixed> */
    public function directory(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $search = mb_substr(trim((string) ($query['search'] ?? '')), 0, 120);
        $result = $this->repository->listReady($page, 24, $search);
        $routes = new PublicRouteBuilder();
        $items = array_map(static function (array $row) use ($routes): array {
            $row['path'] = $routes->simulationDetail((string) ($row['slug'] ?? ''));
            return PublicSimulationProjection::summary($row);
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

        $simulation = $data['simulation'];
        $routes = new PublicRouteBuilder();
        $slugger = new SeoSlugService();
        $canonicalPath = $routes->simulationDetail((string) ($simulation['slug'] ?? ''));
        $data['canonicalPath'] = $canonicalPath;
        $data['questionCount'] = (int) ($simulation['question_count'] ?? 0);
        $data['readiness'] = PublicSimulationReadinessValidator::evaluate($simulation);
        $data['practicePath'] = '/simulation';
        $data['questions'] = array_map(static function (array $item) use ($routes, $slugger): array {
            $id = (int) ($item['id'] ?? 0);
            $item['path'] = $routes->questionDetail($id, $slugger->slug((string) ($item['excerpt'] ?? ''), 'questao', $id));
            return $item;
        }, $data['questions']);
        $data['taxonomies'] = array_values(array_filter(array_map(static function (array $item) use ($routes): ?array {
            $slug = (string) ($item['slug'] ?? '');
            $item['path'] = match ($item['relationType'] ?? '') {
                'discipline' => $routes->disciplineDetail($slug),
                'topic' => $routes->topicDetail($slug),
                'subject' => $routes->subjectDetail($slug),
                'career' => $routes->careerDetail($slug),
                'position' => $routes->positionDetail($slug),
                'board' => $routes->boardDetail($slug),
                'organization' => $routes->organizationDetail($slug),
                default => null,
            };
            return $item['path'] === null ? null : $item;
        }, $data['taxonomies'])));
        $data['contests'] = array_map(static function (array $item) use ($routes): array {
            $item['path'] = $routes->contestDetail((string) ($item['slug'] ?? ''));
            return $item;
        }, $data['contests']);
        $data['exams'] = array_map(static function (array $item) use ($routes): array {
            $item['path'] = $routes->examDetail((string) ($item['slug'] ?? ''));
            return $item;
        }, $data['exams']);
        $data['breadcrumbs'] = [
            ['label' => 'Inicio', 'canonicalPath' => '/'],
            ['label' => 'Simulados', 'canonicalPath' => $routes->simulationsIndex()],
            ['label' => (string) ($simulation['title'] ?? ''), 'canonicalPath' => $canonicalPath],
        ];
        return PublicSimulationProjection::detail($data);
    }
}
