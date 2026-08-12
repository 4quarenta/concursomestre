<?php

$root = dirname(__DIR__, 2);
$repository = (string) file_get_contents($root . '/backend/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($root . '/backend/modules/filters/services/FiltersService.php');
$routes = (string) file_get_contents($root . '/backend/modules/filters/routes.php');
$practice = (string) file_get_contents($root . '/src/app/practice/PracticeClient.tsx');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
};

$assert(str_contains($repository, 'fetchPracticeCatalog'), 'Repositorio nao possui catalogo reduzido da pratica.');
$assert(str_contains($repository, 'WITH RECURSIVE practice_filters'), 'Catalogo nao preserva ancestrais da taxonomia.');
$assert(str_contains($repository, "q.publish_status IN ('published', 'scheduled')"), 'Catalogo nao limita questoes publicadas.');
$assert(str_contains($service, 'listPracticeCatalog'), 'Servico nao expoe catalogo reduzido.');
$assert(str_contains($routes, "\$scope === 'practice'"), 'Rota publica nao seleciona o escopo da pratica.');
$assert(str_contains($practice, "ensureTaxonomiesLoaded(false, 'practice')"), 'Pagina de pratica ainda solicita a taxonomia completa.');

echo "PracticeTaxonomyCatalogWiringTest passed\n";
