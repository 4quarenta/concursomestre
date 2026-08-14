<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este relatorio so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../shared/policies/ContentPublicationPolicy.php';
require_once __DIR__ . '/../../modules/seo/services/SeoFactsAssembler.php';
require_once __DIR__ . '/../../modules/seo/policies/SeoQualityPolicy.php';
require_once __DIR__ . '/../../modules/seo/policies/StructuralRoutePolicy.php';
require_once __DIR__ . '/../../modules/seo/promotion/DefaultEditorialSeoPromotionProvider.php';
require_once __DIR__ . '/../../modules/seo/services/SeoSlugService.php';
require_once __DIR__ . '/../../modules/seo/services/SeoPolicyService.php';
require_once __DIR__ . '/../../modules/seo/reports/SeoShadowProjectionRepository.php';
require_once __DIR__ . '/../../modules/seo/reports/SeoShadowReporter.php';

/** @return string|null */
function seoShadowOption(string $name): ?string
{
    global $argv;
    foreach ($argv as $argument) {
        if (str_starts_with($argument, '--' . $name . '=')) {
            return substr($argument, strlen($name) + 3);
        }
    }
    return null;
}

try {
    $requestedResource = strtolower(trim((string) (seoShadowOption('resource') ?? 'all')));
    $allowedResources = ['question', 'exam', 'taxonomy', 'board', 'law'];
    if ($requestedResource !== 'all' && !in_array($requestedResource, $allowedResources, true)) {
        throw new InvalidArgumentException('Use --resource=all|question|exam|taxonomy|board|law.');
    }
    $resources = $requestedResource === 'all' ? $allowedResources : [$requestedResource];
    $maximum = max(0, (int) (seoShadowOption('limit') ?? '0'));
    $batchSize = max(1, min(1000, (int) (seoShadowOption('batch-size') ?? '500')));
    $outputPath = trim((string) (seoShadowOption('output') ?? ''));
    $fixturePath = trim((string) (seoShadowOption('fixture') ?? ''));

    $routes = new StructuralRoutePolicy();
    $reporter = new SeoShadowReporter(
        new ContentPublicationPolicy(),
        new SeoFactsAssembler(),
        new SeoQualityPolicy(),
        new SeoPolicyService(
            $routes,
            new DefaultEditorialSeoPromotionProvider(),
            new SeoSlugService()
        )
    );

    $startedAt = microtime(true);
    $report = $reporter->emptyReport();
    $report['sample'] = [
        'resource' => $requestedResource,
        'limitPerResource' => $maximum === 0 ? null : $maximum,
        'batchSize' => $batchSize,
    ];
    $queryCount = 0;
    if ($fixturePath !== '') {
        $rawFixture = file_get_contents($fixturePath);
        if ($rawFixture === false) {
            throw new RuntimeException('Fixture do shadow report nao encontrada.');
        }
        $fixture = json_decode($rawFixture, true, 512, JSON_THROW_ON_ERROR);
        $projections = is_array($fixture['projections'] ?? null) ? $fixture['projections'] : [];
        foreach ($projections as $projection) {
            if (!is_array($projection)
                || ($requestedResource !== 'all' && ($projection['resourceType'] ?? null) !== $requestedResource)) {
                continue;
            }
            $reporter->append($report, $projection);
        }
        $report['sample']['fixture'] = basename($fixturePath);
    } else {
        require_once __DIR__ . '/../../config/database.php';
        $db = (new Database('read'))->getConnection();
        $repository = new SeoShadowProjectionRepository($db);
        foreach ($resources as $resourceType) {
            $cursor = 0;
            $processed = 0;
            while ($maximum === 0 || $processed < $maximum) {
                $remaining = $maximum === 0 ? $batchSize : min($batchSize, $maximum - $processed);
                $batch = $repository->fetchBatch($resourceType, $cursor, $remaining);
                if ($batch === []) {
                    break;
                }
                foreach ($batch as $projection) {
                    $reporter->append($report, $projection);
                    $cursor = max($cursor, (int) ($projection['resourceId'] ?? 0));
                    $processed++;
                }
                if (count($batch) < $remaining) {
                    break;
                }
            }
        }
        $queryCount = $repository->queryCount();
    }
    $report = $reporter->finalize($report, $queryCount, microtime(true) - $startedAt);
    $json = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    if ($outputPath !== '') {
        $directory = dirname($outputPath);
        if (!is_dir($directory) || !is_writable($directory)) {
            throw new RuntimeException('Diretorio do relatorio nao existe ou nao permite escrita.');
        }
        if (file_put_contents($outputPath, $json, LOCK_EX) === false) {
            throw new RuntimeException('Nao foi possivel escrever o relatorio.');
        }
    } else {
        echo $json;
    }
    exit($report['errors'] === [] ? 0 : 1);
} catch (Throwable $error) {
    fwrite(STDERR, 'SEO shadow report nao executado: ' . $error->getMessage() . PHP_EOL);
    exit(2);
}
