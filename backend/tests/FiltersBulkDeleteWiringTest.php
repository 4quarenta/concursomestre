<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$repository = (string) file_get_contents($root . '/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($root . '/modules/filters/services/FiltersService.php');
$controller = (string) file_get_contents($root . '/modules/filters/controllers/FiltersController.php');
$routes = (string) file_get_contents($root . '/modules/filters/routes.php');
$validator = (string) file_get_contents($root . '/modules/filters/validators/FiltersValidator.php');
$frontend = (string) file_get_contents(dirname($root) . '/src/app/admin/components/database/FiltersManagementSection.tsx');
$contract = (string) file_get_contents(dirname($root) . '/src/services/filters/index.ts');

$assertContains = static function (string $haystack, string $needle, string $message): void {
    if (!str_contains($haystack, $needle)) {
        throw new RuntimeException($message);
    }
};

foreach (['deleteMany', 'beginTransaction', 'fetchUsageOverview', 'parent_id IN', 'DELETE FROM filters WHERE id IN', 'rollBack'] as $needle) {
    $assertContains($repository, $needle, "Exclusao em massa nao garante {$needle}.");
}
foreach (['normalizeDeleteIds', 'Selecione no maximo', 'Selecione ao menos uma taxonomia'] as $needle) {
    $assertContains($validator, $needle, "Validacao em massa ausente: {$needle}.");
}
foreach (['deleteMany', 'filter.bulk-delete', 'deletedCount'] as $needle) {
    $assertContains($service . $controller, $needle, "Contrato administrativo ausente: {$needle}.");
}
foreach (["REQUEST_METHOD", "file_get_contents('php://input')", "Response::conflict", "logAdminAudit"] as $needle) {
    $assertContains($routes, $needle, "Rota em massa nao implementa {$needle}.");
}
foreach (['removeMany', 'apiClient.post', 'selectedIds', 'Selecionar todas as taxonomias desta pagina', 'Excluir selecionadas', 'AdminConfirmDialog'] as $needle) {
    $assertContains($frontend . $contract, $needle, "Frontend em massa nao implementa {$needle}.");
}

echo "FiltersBulkDeleteWiringTest passed\n";
