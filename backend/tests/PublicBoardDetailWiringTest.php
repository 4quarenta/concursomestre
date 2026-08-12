<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$repository = (string) file_get_contents($root . '/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($root . '/modules/filters/services/FiltersService.php');
$routes = (string) file_get_contents($root . '/modules/filters/routes.php');
$endpoint = (string) file_get_contents($root . '/api/filters/board.php');

$assertContains = static function (string $haystack, string $needle, string $message): void {
    if (!str_contains($haystack, $needle)) {
        throw new RuntimeException($message);
    }
};

foreach ([
    'fetchPublicBoardDetail',
    "f.type = 'banca'",
    "q.publish_status IN ('published', 'scheduled')",
    "p.status_editorial = 'published'",
    'CURDATE() BETWEEN DATE(p.inscricoes_inicio) AND DATE(p.inscricoes_fim)',
    "END AS public_status",
    'topSubjects',
    'questionProfile',
    'LIMIT :limit OFFSET :offset',
] as $needle) {
    $assertContains($repository . $service, $needle, "Perfil publico da banca nao contem {$needle}.");
}

foreach (['all', 'open', 'upcoming', 'completed', 'unknown'] as $status) {
    $assertContains($service, "'{$status}'", "Status publico {$status} nao foi validado.");
}

$assertContains($routes, 'handlePublicBoardDetailRoute', 'Rota de detalhe da banca ausente.');
$assertContains($endpoint, 'handlePublicBoardDetailRoute($db)', 'Endpoint nao aciona a rota de banca.');

$publicMethodStart = strpos($service, 'public function getPublicBoardDetail');
$publicMethodEnd = strpos($service, 'public function listPublicTaxonomyChildren', $publicMethodStart ?: 0);
if ($publicMethodStart === false || $publicMethodEnd === false) {
    throw new RuntimeException('Nao foi possivel delimitar o DTO publico da banca.');
}
$publicContract = substr($service, $publicMethodStart, $publicMethodEnd - $publicMethodStart);

foreach (['keywords_json', 'source_external_id', 'source_metadata_json', 'relationships'] as $forbidden) {
    if (str_contains($publicContract, "'{$forbidden}' =>")) {
        throw new RuntimeException("Contrato publico da banca expoe {$forbidden}.");
    }
}

echo "PublicBoardDetailWiringTest passed\n";
