<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function assertMarketplaceSchemaContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertMarketplaceSchemaNotContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content !== false && strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';
$schema = $base . '/database/schema.sql';
$paymentProvider = $base . '/config/payment_provider.php';
$materialsRepository = $base . '/modules/materials/repositories/MaterialsRepository.php';
$migration = $base . '/scripts/migrations/migrate_marketplace_schema_compatibility.php';

assertMarketplaceSchemaContains(
    $schema,
    'id INT AUTO_INCREMENT PRIMARY KEY',
    'Bootstrap schema must create transactions with an auto-increment integer id'
);

assertMarketplaceSchemaContains(
    $schema,
    'user_id VARCHAR(64) NULL',
    'Bootstrap schema must use the user_id column consumed by transaction services'
);

assertMarketplaceSchemaNotContains(
    $schema,
    'buyer_id VARCHAR(36) NOT NULL',
    'Bootstrap schema must not create the obsolete buyer_id-only transactions contract'
);

assertMarketplaceSchemaContains(
    $schema,
    'CREATE TABLE IF NOT EXISTS material_ratings',
    'Bootstrap schema must include material ratings'
);

assertMarketplaceSchemaContains(
    $schema,
    'material_id VARCHAR(64) NOT NULL',
    'Material ratings must support textual material IDs'
);

assertMarketplaceSchemaContains(
    $schema,
    'item_id VARCHAR(36) NOT NULL',
    'User notes must support textual material IDs through item_id'
);

assertMarketplaceSchemaContains(
    $paymentProvider,
    'backfillColumnIfBothExist($db, \'transactions\', \'user_id\', \'buyer_id\')',
    'Payment provider schema guard must migrate buyer_id into user_id when needed'
);

assertMarketplaceSchemaContains(
    $paymentProvider,
    'modifyColumnIfExists($db, \'transactions\', \'material_id\', \'VARCHAR(36) NULL\')',
    'Payment provider schema guard must normalize transactions.material_id to varchar'
);

assertMarketplaceSchemaContains(
    $materialsRepository,
    'ALTER TABLE material_ratings MODIFY material_id VARCHAR(64) NOT NULL',
    'Materials repository must repair legacy material_ratings material IDs'
);

assertMarketplaceSchemaContains(
    $migration,
    'Compatibilidade de marketplace/transacoes verificada.',
    'Marketplace compatibility migration script must exist'
);

fwrite(STDOUT, "Marketplace schema compatibility wiring assertions passed.\n");
