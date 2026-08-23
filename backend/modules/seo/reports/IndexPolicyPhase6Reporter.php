<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/launch/SeoProductionPageMap.php';
require_once dirname(__DIR__) . '/policies/SeoIndexPolicy.php';

final class IndexPolicyPhase6Reporter
{
    private readonly string $root;
    /** @var array<string,mixed> */
    private array $pageMapConfig;
    /** @var array<string,mixed> */
    private array $structuralConfig;
    /** @var array<string,mixed> */
    private array $graphConfig;
    /** @var array<string,mixed> */
    private array $fixturesConfig;

    public function __construct(?string $root = null)
    {
        $this->root = $root ?? dirname(__DIR__, 4);
        $this->pageMapConfig = $this->readJson('config/seo/seo-production-page-map.v1.json');
        $this->structuralConfig = $this->readJson('config/seo/structural-route-policy.v1.json');
        $this->graphConfig = $this->readJson('config/seo/internal-link-graph.v1.json');
        $this->fixturesConfig = $this->readJson('config/seo/index-policy-phase-6-fixtures.v1.json');
    }

    /** @return array<string,mixed> */
    public function report(?PDO $readDatabase = null): array
    {
        $pageMap = new SeoProductionPageMap();
        $policy = new SeoIndexPolicy($pageMap);
        $families = $pageMap->families();
        $familyIds = array_column($families, 'familyId');
        $graphFamilyIds = array_column($this->graphConfig['families'] ?? [], 'familyId');
        $structuralFamilyIds = array_column($this->structuralConfig['families'] ?? [], 'id');
        $fixtureRows = [];
        $fixtureFailures = [];
        foreach ($this->fixturesConfig['cases'] ?? [] as $fixture) {
            if (!is_array($fixture)) continue;
            try {
                $decision = $policy->evaluate((string) $fixture['familyId'], $fixture);
                $passed = ($decision['indexability'] ?? null) === ($fixture['expectedIndexability'] ?? null)
                    && ($decision['sitemapEligible'] ?? null) === ($fixture['expectedSitemap'] ?? null);
                $fixtureRows[] = [
                    'id' => $fixture['id'] ?? null,
                    'familyId' => $fixture['familyId'] ?? null,
                    'launchMode' => $fixture['launchMode'] ?? null,
                    'indexability' => $decision['indexability'],
                    'sitemapEligible' => $decision['sitemapEligible'],
                    'reasonCodes' => $decision['reasonCodes'],
                    'passed' => $passed,
                ];
                if (!$passed) $fixtureFailures[] = (string) ($fixture['id'] ?? 'unknown');
            } catch (Throwable $error) {
                $fixtureFailures[] = (string) ($fixture['id'] ?? 'unknown') . ': ' . $error->getMessage();
            }
        }

        $graphMissingPageMap = array_values(array_diff($graphFamilyIds, $familyIds));
        $structuralMissingPageMap = array_values(array_diff(
            $structuralFamilyIds,
            array_merge($familyIds, ['private', 'admin', 'api'])
        ));
        $routes = $this->discoverAppRoutes();

        return [
            'version' => 'index-policy-phase-6-report.v1',
            'generatedAt' => gmdate('c'),
            'evidenceMode' => $readDatabase instanceof PDO ? 'REAL_DATABASE_READ_ONLY' : 'CONTRACT_FIXTURE',
            'contracts' => [
                'productionPageMapFamilies' => count($families),
                'internalLinkGraphFamilies' => count($graphFamilyIds),
                'structuralRouteFamilies' => count($structuralFamilyIds),
                'nextAppRoutesDiscovered' => count($routes),
                'targetIndexFamilies' => count(array_filter($families, static fn (array $family): bool => ($family['targetProductionIndexability'] ?? null) === 'INDEX')),
                'permanentNoindexFamilies' => count(array_filter($families, static fn (array $family): bool => ($family['familyEligibility'] ?? null) === 'PERMANENT_NOINDEX')),
            ],
            'divergences' => [
                'graphMissingProductionPageMap' => $graphMissingPageMap,
                'structuralMissingProductionPageMap' => $structuralMissingPageMap,
                'note' => 'Contagens divergem por granularidade: Page Map inclui superficies funcionais/privadas; grafo cobre familias navegaveis; Structural Route Policy agrupa familias de resolucao.',
            ],
            'fixtures' => [
                'total' => count($fixtureRows),
                'passed' => count($fixtureRows) - count($fixtureFailures),
                'failed' => count($fixtureFailures),
                'failures' => $fixtureFailures,
                'rows' => $fixtureRows,
            ],
            'appRoutes' => $routes,
            'database' => $readDatabase instanceof PDO
                ? $this->databaseSnapshot($readDatabase)
                : [
                    'status' => 'NOT_EXECUTED',
                    'reason' => 'REAL_DATASET_GATE remains required; no fallback database is accepted.',
                ],
            'valid' => $fixtureFailures === []
                && $graphMissingPageMap === []
                && $structuralMissingPageMap === [],
        ];
    }

    /** @return array<string,mixed> */
    private function databaseSnapshot(PDO $db): array
    {
        $tables = ['filters', 'questions', 'provas', 'contests', 'public_simulations', 'materials', 'blog_articles'];
        $counts = [];
        foreach ($tables as $table) {
            $exists = $db->prepare(
                'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table LIMIT 1'
            );
            $exists->execute([':table' => $table]);
            $counts[$table] = $exists->fetchColumn() ? (int) $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn() : null;
        }
        return [
            'status' => 'READ_ONLY_SNAPSHOT',
            'database' => (string) $db->query('SELECT DATABASE()')->fetchColumn(),
            'engineVersion' => (string) $db->query('SELECT VERSION()')->fetchColumn(),
            'counts' => $counts,
            'writes' => 0,
        ];
    }

    /** @return list<string> */
    private function discoverAppRoutes(): array
    {
        $app = $this->root . '/src/app';
        $routes = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($app, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile() || !in_array($file->getFilename(), ['page.tsx', 'route.ts'], true)) continue;
            $relative = str_replace('\\', '/', substr($file->getPath(), strlen($app)));
            $route = preg_replace('~/\([^/]+\)~', '', $relative) ?: '';
            $routes[] = $route === '' ? '/' : $route;
        }
        sort($routes, SORT_STRING);
        return array_values(array_unique($routes));
    }

    /** @return array<string,mixed> */
    private function readJson(string $relativePath): array
    {
        $raw = file_get_contents($this->root . '/' . $relativePath);
        $value = $raw === false ? null : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($value)) throw new RuntimeException('Contrato ausente: ' . $relativePath);
        return $value;
    }
}
