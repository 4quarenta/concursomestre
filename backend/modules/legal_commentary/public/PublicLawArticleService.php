<?php

declare(strict_types=1);

require_once __DIR__ . '/PublicLawArticleRepository.php';
require_once __DIR__ . '/PublicLawArticleProjection.php';
require_once __DIR__ . '/PublicLawArticleReadiness.php';
require_once __DIR__ . '/../../seo/routes/PublicRouteBuilder.php';

final class PublicLawArticleService
{
    public function __construct(private readonly PublicLawArticleRepository $repository) {}

    /** @return array<string,mixed>|null */
    public function detail(string $lawSlug, string $articleSlug): ?array
    {
        $lawSlug = trim($lawSlug);
        $articleSlug = trim($articleSlug);
        if (!self::validSlug($lawSlug, 160) || !self::validSlug($articleSlug, 180)) return null;

        $row = $this->repository->findByCanonicalSlugs($lawSlug, $articleSlug);
        $redirect = false;
        if ($row === null) {
            $row = $this->repository->findByLawAlias($lawSlug, $articleSlug);
            $redirect = $row !== null;
        }
        if ($row === null || !PublicLawArticleReadiness::isPublicRecord($row)) return null;

        $routes = new PublicRouteBuilder();
        $canonicalPath = $routes->lawArticleDetail((string) $row['law_slug'], (string) $row['article_slug']);
        if ($redirect) return ['redirectPath' => $canonicalPath];

        $navigation = $this->repository->fetchNavigation(
            (int) $row['law_id'], (int) $row['article_sort_order'], (int) $row['article_id']
        );
        foreach (['previous', 'next'] as $direction) {
            if (is_array($navigation[$direction])) {
                $navigation[$direction]['path'] = $routes->lawArticleDetail(
                    (string) $row['law_slug'], (string) $navigation[$direction]['slug']
                );
            }
        }
        $lawLabel = trim((string) ($row['law_short_title'] ?: $row['law_title']));
        $articleLabel = 'Art. ' . trim((string) $row['article_number']);
        $readiness = PublicLawArticleReadiness::evaluate($row);
        return PublicLawArticleProjection::detail([
            'article' => $row,
            'blocks' => $this->repository->fetchOfficialBlocks((int) $row['article_id']),
            'previous' => $navigation['previous'],
            'next' => $navigation['next'],
            'canonicalPath' => $canonicalPath,
            'breadcrumbs' => [
                ['label' => 'Inicio', 'path' => '/'],
                ['label' => 'Lei Comentada', 'path' => $routes->lawsIndex()],
                ['label' => $lawLabel, 'path' => $routes->lawDetail((string) $row['law_slug'])],
                ['label' => $articleLabel, 'path' => $canonicalPath],
            ],
            'readiness' => $readiness,
        ]);
    }

    private static function validSlug(string $slug, int $limit): bool
    {
        return $slug !== '' && strlen($slug) <= $limit
            && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) === 1;
    }
}
