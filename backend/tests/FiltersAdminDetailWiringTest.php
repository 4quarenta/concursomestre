<?php

declare(strict_types=1);

function filtersAdminDetailAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$repository = (string) file_get_contents($backend . '/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($backend . '/modules/filters/services/FiltersService.php');
$controller = (string) file_get_contents($backend . '/modules/filters/controllers/FiltersController.php');
$routes = (string) file_get_contents($backend . '/modules/filters/routes.php');
$frontendService = (string) file_get_contents(dirname($backend) . '/src/services/filters/index.ts');
$workflow = (string) file_get_contents(dirname($backend) . '/src/app/admin/components/database/useAdminTaxonomyWorkflow.ts');

filtersAdminDetailAssert(
    str_contains($repository, 'public function fetchById(int $id): ?array')
        && str_contains($repository, 'parent.name AS parent_name')
        && str_contains($repository, '$row[\'sourceIdentities\']'),
    'O detalhe deve carregar o registro canonico e seus metadados por ID.'
);
filtersAdminDetailAssert(
    str_contains($service, 'public function getAdminDetail(int $id): array')
        && str_contains($service, "'sigla' => \$row['acronym'] ?: null")
        && str_contains($controller, 'return $this->service->getAdminDetail($id);'),
    'Service e controller devem expor nome e sigla canonicos.'
);
filtersAdminDetailAssert(
    str_contains($routes, "isset(\$_GET['id'])")
        && str_contains($routes, '$controller->getAdminDetail($id)'),
    'A rota administrativa deve aceitar consulta autoritativa por ID.'
);
filtersAdminDetailAssert(
    str_contains($frontendService, 'async getAdminItem(id: number)')
        && str_contains($workflow, 'filtersService.getAdminItem(id)')
        && str_contains($workflow, 'editingRequestIdRef'),
    'O modal deve recarregar o registro por ID e ignorar respostas antigas.'
);

fwrite(STDOUT, "FiltersAdminDetailWiringTest: PASS\n");
