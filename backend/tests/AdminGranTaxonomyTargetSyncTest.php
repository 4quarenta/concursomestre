<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/admin/services/AdminGranTaxonomySyncService.php';

$db = new PDO('sqlite::memory:');
$service = new AdminGranTaxonomySyncService($db);
$rows = [];
for ($id = 1; $id <= 23141; $id++) {
    $rows[] = ['id' => (string) $id, 'nome' => 'Registro ' . $id];
}

try {
    $service->syncTarget('orgao', 'missing-taxonomy-id', ['data' => ['rows' => $rows]]);
    throw new RuntimeException('A resposta ampla sem o ID solicitado foi aceita.');
} catch (InvalidArgumentException $exception) {
    if (!str_contains($exception->getMessage(), 'Nenhum catalogo foi sincronizado')) {
        throw $exception;
    }
}

if ($db->inTransaction()) {
    throw new RuntimeException('A rejeicao da resposta ampla deixou uma transacao aberta.');
}

fwrite(STDOUT, "AdminGranTaxonomyTargetSyncTest: PASS\n");
