<?php

declare(strict_types=1);

require_once __DIR__ . '/PublicMaterialsRepository.php';
require_once __DIR__ . '/PublicMaterialProjection.php';
require_once __DIR__ . '/PublicMaterialReadiness.php';
require_once __DIR__ . '/../../seo/routes/PublicRouteBuilder.php';

final class PublicMaterialsService
{
    public function __construct(private readonly PublicMaterialsRepository $repository) {}

    /** @return array<string,mixed> */
    public function directory(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $search = mb_substr(trim((string) ($query['search'] ?? '')), 0, 120);
        $scope = (string) ($query['scope'] ?? 'materials');
        if (!in_array($scope, ['materials', 'marketplace'], true)) throw new InvalidArgumentException('Escopo publico invalido.');
        $result = $this->repository->directory($page, 24, $search, $scope === 'marketplace');
        $routes = new PublicRouteBuilder();
        return [
            'items' => array_map(static function (array $row) use ($routes): array {
                $row['path'] = $routes->materialDetail((string) $row['slug']);
                return PublicMaterialProjection::summary($row);
            }, $result['rows']),
            'pageInfo' => [
                'page' => $result['page'], 'pages' => $result['pages'], 'limit' => $result['limit'], 'total' => $result['total'],
            ],
            'scope' => $scope,
        ];
    }

    /** @return array<string,mixed>|null */
    public function detail(string $slug): ?array
    {
        $slug = trim($slug);
        if (!PublicMaterialReadiness::validSlug($slug)) return null;
        $material = $this->repository->findPublicBySlug($slug);
        if ($material === null || isset($material['redirectSlug'])) return $material;
        $routes = new PublicRouteBuilder();
        $canonicalPath = $routes->materialDetail((string) $material['slug']);
        $taxonomies = array_values(array_map(static function (array $row) use ($routes): array {
            $row['path'] = ($row['relationType'] ?? '') === 'discipline'
                ? $routes->disciplineDetail((string) $row['slug'])
                : $routes->topicDetail((string) $row['slug']);
            return $row;
        }, $material['taxonomies'] ?? []));
        return PublicMaterialProjection::detail([
            'material' => $material,
            'canonicalPath' => $canonicalPath,
            'taxonomies' => $taxonomies,
            'breadcrumbs' => [
                ['label' => 'Inicio', 'canonicalPath' => '/'],
                ['label' => 'Materiais', 'canonicalPath' => $routes->materialsIndex()],
                ['label' => (string) $material['title'], 'canonicalPath' => $canonicalPath],
            ],
            'readiness' => PublicMaterialReadiness::material($material),
            'listingReadiness' => PublicMaterialReadiness::listing($material),
        ]);
    }

    public function legacyCanonicalSlug(string $id): ?string
    {
        $id = trim($id);
        if ($id === '' || strlen($id) > 64 || preg_match('/^[A-Za-z0-9-]+$/', $id) !== 1) return null;
        return $this->repository->findCanonicalSlugByLegacyId($id);
    }
}
