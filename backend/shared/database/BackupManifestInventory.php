<?php

declare(strict_types=1);

require_once __DIR__ . '/SchemaMigrationRunner.php';

final class BackupManifestInventory
{
    /** @return array<string, int|string|null> */
    public static function collect(PDO $db, string $databaseName, string $migrationDirectory, string $applicationSha, array $pitrAnchor): array
    {
        if (!preg_match('/^[a-f0-9]{40}$/i', $applicationSha)) {
            throw new RuntimeException('Application SHA obrigatorio nao esta disponivel para o manifest.');
        }

        $serverVersion = trim((string) $db->getAttribute(PDO::ATTR_SERVER_VERSION));
        if ($serverVersion === '') {
            throw new RuntimeException('Versao do banco obrigatoria nao esta disponivel para o manifest.');
        }

        $tableCount = self::count($db,
            'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = :schema AND TABLE_TYPE = \'BASE TABLE\'',
            $databaseName
        );
        $triggerCount = self::count($db,
            'SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = :schema',
            $databaseName
        );
        $foreignKeyCount = self::count($db,
            'SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = :schema',
            $databaseName
        );
        $binlogFormat = self::variable($db, 'binlog_format');

        $runner = new SchemaMigrationRunner($db, $migrationDirectory, 'backup-manifest-readonly');
        $audit = $runner->audit();
        $pending = count((array) ($audit['discovered_without_applied_row'] ?? []));
        $drift = count((array) ($audit['checksum_drift'] ?? []));

        return [
            'application_sha' => strtolower($applicationSha),
            'database_name' => $databaseName,
            'db_engine' => 'mysql-compatible',
            'db_version' => $serverVersion,
            'table_count' => $tableCount,
            'trigger_count' => $triggerCount,
            'foreign_key_count' => $foreignKeyCount,
            'migration_applied_count' => (int) ($audit['applied_count'] ?? 0),
            'migration_pending_count' => $pending,
            'migration_checksum_drift' => $drift,
            'binlog_file' => (string) ($pitrAnchor['binlog_file'] ?? ''),
            'binlog_position' => (int) ($pitrAnchor['binlog_position'] ?? 0),
            'gtid_purged' => $pitrAnchor['gtid_purged'] ?? null,
            'binlog_format' => $binlogFormat,
        ];
    }

    private static function variable(PDO $db, string $name): string
    {
        $statement = $db->prepare('SELECT @@GLOBAL.' . $name);
        $statement->execute();
        $value = $statement->fetchColumn();
        if ($value === false || trim((string) $value) === '') {
            throw new RuntimeException('Variavel obrigatoria do manifest nao pode ser determinada: ' . $name);
        }
        return trim((string) $value);
    }

    private static function count(PDO $db, string $sql, string $databaseName): int
    {
        $statement = $db->prepare($sql);
        $statement->execute(['schema' => $databaseName]);
        $value = $statement->fetchColumn();
        if ($value === false || !is_numeric($value)) {
            throw new RuntimeException('Inventario obrigatorio do manifest nao pode ser determinado.');
        }
        return (int) $value;
    }
}
