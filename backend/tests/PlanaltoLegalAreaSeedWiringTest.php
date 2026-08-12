<?php

declare(strict_types=1);

function planaltoLegalAreaSeedAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$migration = (string) file_get_contents($backend . '/database/migrations/20260808_160200_seed_legal_areas.php');
$repository = (string) file_get_contents($backend . '/modules/legal_commentary/repositories/LegalCommentaryRepository.php');
$service = (string) file_get_contents($backend . '/modules/legal_commentary/services/PlanaltoImportService.php');

planaltoLegalAreaSeedAssert(
    str_contains($migration, "['constitucional', 'Constitucional'")
    && str_contains($migration, "['legislacao-especial', 'Legislacao Especial'")
    && str_contains($migration, 'INSERT IGNORE INTO legal_areas'),
    'A migration precisa semear e manter o catalogo juridico canonico.'
);
planaltoLegalAreaSeedAssert(
    str_contains($repository, "throw new InvalidArgumentException('Area juridica invalida.')")
    && str_contains($service, "resolveAreaIdBySlug(\$classification['areaSlug'])"),
    'A classificacao do Planalto precisa usar a area juridica canonica.'
);

fwrite(STDOUT, "PlanaltoLegalAreaSeedWiringTest: PASS\n");
