<?php

declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/modules/seo/reports/InternalLinkGraphReporter.php';

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

try {
    $fixturePath = $root . '/tests/fixtures/seo/internal-link-graph-phase-5.v1.json';
    $fixture = json_decode((string) file_get_contents($fixturePath), true, 512, JSON_THROW_ON_ERROR);
    $audit = InternalLinkGraphReporter::auditFixture($fixture['nodes'], $fixture['links'], $fixture['pages'], $fixture['limits']);
    $assert($audit['orphans'] === $fixture['expected']['orphans'], 'Orphans READY nao foram detectados.');
    $assert(!in_array('private-ready', $audit['orphans'], true), 'Entidade privada foi contada como orphan SEO.');
    $assert(!in_array('simulations-hub', $audit['orphans'], true), 'Hub funcional foi contado como orphan SEO.');
    foreach (['brokenLinks', 'nonpublicTargets', 'aliasTargets', 'redirectTargets', 'duplicateLinks'] as $key) {
        $assert(count($audit[$key]) === $fixture['expected'][$key], $key . ' nao foi detectado.');
    }
    $assert(count($audit['breadcrumbMismatches']) === 1, 'Divergencia de breadcrumb nao foi detectada.');
    $assert(count($audit['breadcrumbErrors']) >= 4, 'Erros especificos de breadcrumb nao foram detectados.');
    $assert(count($audit['schemaErrors']) >= 6, 'Erros de structured data nao foram detectados.');
    foreach ($fixture['negativeAbsentRelations'] as $negative) {
        $found = array_filter($fixture['links'], static fn (array $link): bool => $link['source'] === $negative['source'] && $link['target'] === $negative['target']);
        $assert($found === [], 'Relacao inferida proibida apareceu na fixture.');
    }

    $script = (string) file_get_contents($root . '/scripts/seo/report_internal_link_graph.php');
    $reporter = (string) file_get_contents($root . '/modules/seo/reports/InternalLinkGraphReporter.php');
    $assert(str_contains($script, "new Database('read')") && str_contains($script, 'isUsingReplica'), 'Reporter nao falha fechado em DB_READ.');
    $assert(!preg_match('/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i', $reporter), 'Reporter contem operacao de escrita.');
    foreach (['targetCanonicalRoute', 'targetReadinessRule', 'targetFamilyEligibility', 'targetProductionIndexability', 'knownAliasOrRedirectTarget', 'brokenContract'] as $field) {
        $assert(str_contains($reporter, "'" . $field . "'"), 'Matriz nao informa ' . $field . '.');
    }
    $assert(str_contains($reporter, 'canonical_route_mismatch'), 'Reporter nao valida rota canonica contra o Page Map.');
    $assert(str_contains($reporter, 'real dataset gate required'), 'Reporter nao explicita limite do dataset temporario.');

    echo "InternalLinkGraphReporterTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'InternalLinkGraphReporterTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
