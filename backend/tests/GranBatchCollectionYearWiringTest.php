<?php

$root = dirname(__DIR__);
$crawler = file_get_contents($root . '/modules/admin/services/AdminGranCrawlerService.php');
$ingestion = file_get_contents($root . '/modules/questions/services/PrivateQuestionIngestionService.php');
$migration = file_get_contents($root . '/database/migrations/20260804_020000_gran_batch_collection_year.php');

foreach ([$crawler, $ingestion, $migration] as $source) {
    if (!is_string($source) || $source === '') {
        throw new RuntimeException('Nao foi possivel ler os arquivos do ano do lote Gran.');
    }
}

if (!str_contains($crawler, "'collectionYear' =>")) {
    throw new RuntimeException('O crawler deve transportar o ano filtrado no metadado canonico.');
}
if (!str_contains($ingestion, "'collection_years_json'")) {
    throw new RuntimeException('A fila deve exigir a coluna persistente do ano filtrado.');
}
if (!str_contains($ingestion, "? 'Ano ' . \$collectionYears[0]")) {
    throw new RuntimeException('O titulo do processamento deve exibir um unico ano filtrado.');
}
if (!str_contains($ingestion, "'collectionYears' => \$collectionYears")) {
    throw new RuntimeException('O contrato do lote deve devolver os anos de coleta.');
}
if (!str_contains($migration, 'ADD COLUMN collection_years_json')) {
    throw new RuntimeException('A migration deve adicionar a coluna de ano sem recriar a tabela.');
}

if (!str_contains($ingestion, "\$questionStatuses[\$duplicateKey] = 'duplicate'")) {
    throw new RuntimeException('Classificacao individual de duplicatas ausente.');
}

fwrite(STDOUT, "Gran batch collection year wiring assertions passed.\n");
