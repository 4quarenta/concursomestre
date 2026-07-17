<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../modules/filters/repositories/FiltersRepository.php';

function filterAliasAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = (new Database())->getConnection();
$repository = new FiltersRepository($db);
$filterId = 0;

$db->beginTransaction();
try {
    $filterId = $repository->create([
        'type' => 'banca',
        'name' => 'Banca de integracao',
        'slug' => 'banca-integracao-' . bin2hex(random_bytes(4)),
        'parent_id' => null,
        'description' => 'Filtro criado apenas no banco isolado.',
        'website' => 'https://example.test',
        'asset_url' => 'https://example.test/logo.png',
        'icon_key' => 'building-2',
        'keywords_json' => json_encode(['concurso', 'prova']),
        'meta_materia' => 0,
        'taxonomy_level' => null,
        'meta_carreira' => 0,
        'aliases' => ['Banca Teste', 'banca teste', 'Banca-Téste', '  BT  ', ''],
    ]);
    filterAliasAssert($db->inTransaction(), 'O repository encerrou uma transacao que nao lhe pertencia.');
    $created = $repository->fetchById($filterId);
    filterAliasAssert(is_array($created), 'Filtro nao foi encontrado dentro da transacao.');
    filterAliasAssert(($created['asset_url'] ?? null) === 'https://example.test/logo.png', 'asset_url nao foi persistido.');
    filterAliasAssert(($created['icon_key'] ?? null) === 'building-2', 'icon_key nao foi persistido.');
    filterAliasAssert(count($created['aliases'] ?? []) === 2, 'Aliases equivalentes nao foram deduplicados pela forma normalizada.');

    $all = $repository->fetchAll();
    $listed = array_values(array_filter($all, static fn (array $row): bool => (int) ($row['id'] ?? 0) === $filterId));
    filterAliasAssert(count($listed) === 1 && count($listed[0]['aliases'] ?? []) === 2, 'Listagem em lote nao carregou os aliases.');

    $db->rollBack();
    $exists = $repository->fetchById($filterId);
    filterAliasAssert($exists === null, 'Rollback externo nao removeu filtro e aliases atomicos.');
    fwrite(STDOUT, "FiltersAliasesIntegrationTest: PASS\n");
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, 'FiltersAliasesIntegrationTest: FAIL - ' . $error->getMessage() . "\n");
    exit(1);
}
