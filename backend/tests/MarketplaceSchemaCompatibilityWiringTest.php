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

$base = dirname(__DIR__);
$schema = $base . '/database/schema.sql';
$materialsRepository = $base . '/modules/materials/repositories/MaterialsRepository.php';
$migration = $base . '/scripts/migrations/migrate_marketplace_schema_compatibility.php';
$securityMigration = $base . '/database/migrations/20260711_040000_marketplace_content_security.php';

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
    $materialsRepository,
    'SchemaReadiness::assertTablesAndColumns',
    'Materials repository must only verify the marketplace schema at runtime'
);

assertMarketplaceSchemaNotContains(
    $materialsRepository,
    'CREATE TABLE',
    'Materials repository must not execute DDL during HTTP requests'
);

assertMarketplaceSchemaContains(
    $securityMigration,
    'CREATE TABLE IF NOT EXISTS material_uploads',
    'Marketplace security migration must create the private upload registry'
);

assertMarketplaceSchemaContains(
    $migration,
    'Compatibilidade de marketplace/transacoes verificada.',
    'Marketplace compatibility migration script must exist'
);

fwrite(STDOUT, "Marketplace schema compatibility wiring assertions passed.\n");
