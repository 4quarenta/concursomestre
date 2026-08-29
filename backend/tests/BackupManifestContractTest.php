<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/shared/database/BackupManifestContract.php';

$manifest = [
    'format_version' => 2,
    'created_at' => '2026-08-29T20:00:00+00:00',
    'application_sha' => str_repeat('a', 40),
    'database_name' => 'concursomestre',
    'db_engine' => 'mysql-compatible',
    'db_version' => '8.4.10',
    'table_count' => 144,
    'trigger_count' => 36,
    'foreign_key_count' => 113,
    'migration_applied_count' => 70,
    'migration_pending_count' => 0,
    'migration_checksum_drift' => 0,
    'dump_size' => 1024,
    'dump_sha256' => str_repeat('b', 64),
];

BackupManifestContract::assertValid($manifest);
foreach (array_keys($manifest) as $field) {
    if ($field === 'format_version') {
        continue;
    }
    $invalid = $manifest;
    $invalid[$field] = null;
    try {
        BackupManifestContract::assertValid($invalid);
        throw new RuntimeException('Manifest accepted a missing required field: ' . $field);
    } catch (RuntimeException $exception) {
        if (str_starts_with($exception->getMessage(), 'Manifest accepted')) {
            throw $exception;
        }
    }
}

fwrite(STDOUT, "Backup manifest v2 contract assertions passed.\n");
