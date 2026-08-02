<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$repository = (string) file_get_contents($root . '/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($root . '/modules/filters/services/FiltersService.php');
$frontend = (string) file_get_contents(dirname($root) . '/src/app/admin/components/database/FiltersManagementSection.tsx');
$contract = (string) file_get_contents(dirname($root) . '/src/services/filters/index.ts');
$types = (string) file_get_contents(dirname($root) . '/src/types/global.ts');

$assertContains = static function (string $haystack, string $needle, string $message): void {
    if (!str_contains($haystack, $needle)) {
        throw new RuntimeException($message);
    }
};

foreach (['fetchUsageOverview', 'fetchPage', 'fetchUsageSummary', 'question_filters', 'prova_filters', 'law_filter_links', 'COUNT(DISTINCT question_id)', 'COUNT(DISTINCT prova_id)', 'COUNT(DISTINCT law_id)', 'LIMIT :limit OFFSET :offset'] as $needle) {
    $assertContains($repository, $needle, "Repository nao agrega uso de taxonomias por {$needle}.");
}
foreach (['listPage', 'fetchPage', 'fetchUsageOverview', 'fetchUsageSummary', 'resolveUiType', "'areas' => []"] as $needle) {
    $assertContains($service, $needle, "Service nao entrega a pagina administrativa por {$needle}.");
}
foreach (['TaxonomyUsage', 'TaxonomyUsageSummary', 'byFilterId'] as $needle) {
    $assertContains($frontend . $contract . $types, $needle, "Frontend nao aceita contador de uso {$needle}.");
}
foreach (['formatUsageSummary', 'usage.total', 'usage.questions', 'usage.exams', 'usage.laws'] as $needle) {
    $assertContains($frontend, $needle, "Tabela ou menu nao apresenta {$needle}.");
}
foreach (['listAdminPage', 'AdminCollectionPagination', 'page: pagination.page'] as $needle) {
    $assertContains($frontend . $contract, $needle, "Biblioteca nao usa pagina administrativa por {$needle}.");
}

echo "FiltersUsageCountsWiringTest passed\n";
