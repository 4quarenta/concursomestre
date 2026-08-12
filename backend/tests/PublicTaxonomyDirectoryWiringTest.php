<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$repository = (string) file_get_contents($root . '/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($root . '/modules/filters/services/FiltersService.php');
$routes = (string) file_get_contents($root . '/modules/filters/routes.php');
$endpoint = (string) file_get_contents($root . '/api/filters/directory.php');

$assertContains = static function (string $haystack, string $needle, string $message): void {
    if (!str_contains($haystack, $needle)) {
        throw new RuntimeException($message);
    }
};

foreach ([
    "f.type = 'assunto'",
    "f.taxonomy_level = 'materia'",
    "f.type = 'banca'",
    'COUNT(DISTINCT q.id) AS question_count',
    'COUNT(DISTINCT p.id) AS exam_count',
    "p.status_editorial = 'published'",
    "q.publish_status IN ('published', 'scheduled')",
    "q.visibility_status = 'public'",
    'LIMIT :limit OFFSET :offset',
] as $needle) {
    $assertContains($repository, $needle, "Diretorio publico nao aplica {$needle}.");
}

foreach (['items', 'pageInfo', 'questionCount', 'examCount', 'imageUrl', 'hasChildren', 'taxonomyLevel'] as $needle) {
    $assertContains($service, $needle, "Contrato publico nao entrega {$needle}.");
}

foreach (['handlePublicTaxonomyDirectoryRoute', 'handlePublicTaxonomyHierarchyRoute', "['subjects', 'boards']", 'per_page', 'parent_id'] as $needle) {
    $assertContains($routes . $service, $needle, "Rota publica nao valida {$needle}.");
}

$assertContains($endpoint, 'handlePublicTaxonomyDirectoryRoute($db)', 'Endpoint publico nao chama a rota dedicada.');
$assertContains($endpoint, "['view'] ?? ''", 'Endpoint publico nao seleciona a visualizacao solicitada.');
$assertContains($endpoint, 'handlePublicTaxonomyHierarchyRoute($db)', 'Endpoint publico nao chama a rota de hierarquia.');
$assertContains($repository, 'fetchPublicTaxonomyChildren', 'Repositorio nao expande a arvore de forma paginada.');
$publicMethodStart = strpos($service, 'public function listPublicDirectory');
if ($publicMethodStart === false) {
    throw new RuntimeException('Metodo publico do diretorio nao foi encontrado.');
}
$nextMethodStart = strpos($service, 'public function getAdminDetail', $publicMethodStart + 1);
$publicMethod = substr(
    $service,
    $publicMethodStart,
    $nextMethodStart === false ? null : $nextMethodStart - $publicMethodStart
);
foreach (['keywords_json', 'source_external_id', 'relationships', 'aliases'] as $forbidden) {
    if (str_contains($publicMethod, "'{$forbidden}' =>")) {
        throw new RuntimeException("Contrato publico expoe campo administrativo {$forbidden}.");
    }
}

echo "PublicTaxonomyDirectoryWiringTest passed\n";
