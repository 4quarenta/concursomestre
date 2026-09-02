<?php

declare(strict_types=1);

final class BackupManifestContract
{
    public const FORMAT_VERSION = 3;

    /** @var list<string> */
    private const BASE_REQUIRED_FIELDS = [
        'format_version',
        'created_at',
        'application_sha',
        'database_name',
        'db_engine',
        'db_version',
        'table_count',
        'trigger_count',
        'foreign_key_count',
        'migration_applied_count',
        'migration_pending_count',
        'migration_checksum_drift',
        'dump_size',
        'dump_sha256',
    ];

    /** @var list<string> */
    private const V3_REQUIRED_FIELDS = [
        'backup_id',
        'started_at_utc',
        'completed_at_utc',
        'database_engine',
        'database_version',
        'backup_tool',
        'backup_tool_version',
        'filename',
        'file_size',
        'sha256',
        'result',
        'binlog_file',
        'binlog_position',
        'binlog_format',
    ];

    /** @param array<string, mixed> $manifest */
    public static function assertValid(array $manifest): void
    {
        $formatVersion = (int) ($manifest['format_version'] ?? 0);
        if (!in_array($formatVersion, [2, self::FORMAT_VERSION], true)) {
            throw new RuntimeException('Versao do manifest de backup invalida.');
        }
        $requiredFields = self::BASE_REQUIRED_FIELDS;
        if ($formatVersion >= self::FORMAT_VERSION) {
            $requiredFields = [...$requiredFields, ...self::V3_REQUIRED_FIELDS];
        }
        foreach ($requiredFields as $field) {
            if (!array_key_exists($field, $manifest) || $manifest[$field] === null || $manifest[$field] === '') {
                throw new RuntimeException('Campo obrigatorio ausente no manifest de backup: ' . $field);
            }
        }
        if (!preg_match('/^[a-f0-9]{40}$/i', (string) $manifest['application_sha'])) {
            throw new RuntimeException('Application SHA invalido no manifest de backup.');
        }
        if (!preg_match('/^[a-f0-9]{64}$/i', (string) $manifest['dump_sha256'])) {
            throw new RuntimeException('Dump SHA-256 invalido no manifest de backup.');
        }
        if ($formatVersion >= self::FORMAT_VERSION) {
            if (preg_match('/^[A-Za-z0-9._-]+$/', (string) $manifest['backup_id']) !== 1
                || preg_match('/^[A-Za-z0-9._-]+$/', (string) $manifest['filename']) !== 1
                || trim((string) $manifest['database_engine']) === ''
                || trim((string) $manifest['database_version']) === ''
                || trim((string) $manifest['backup_tool']) === ''
                || trim((string) $manifest['backup_tool_version']) === ''
                || (string) $manifest['result'] !== 'success'
                || !is_int($manifest['file_size'])
                || $manifest['file_size'] < 1
                || !preg_match('/^[a-f0-9]{64}$/i', (string) $manifest['sha256'])) {
                throw new RuntimeException('Identidade do artefato invalida no manifest de backup.');
            }
            if (preg_match('/^[A-Za-z0-9_.-]+$/', (string) $manifest['binlog_file']) !== 1
                || !is_int($manifest['binlog_position'])
                || $manifest['binlog_position'] <= 0
                || !in_array(strtoupper((string) $manifest['binlog_format']), ['ROW', 'STATEMENT', 'MIXED'], true)) {
                throw new RuntimeException('Ancora PITR invalida no manifest de backup.');
            }
        }
        foreach ([
            'table_count', 'trigger_count', 'foreign_key_count', 'migration_applied_count',
            'migration_pending_count', 'migration_checksum_drift', 'dump_size',
        ] as $field) {
            if (!is_int($manifest[$field]) || $manifest[$field] < 0) {
                throw new RuntimeException('Contagem invalida no manifest de backup: ' . $field);
            }
        }
        try {
            new DateTimeImmutable((string) $manifest['created_at']);
            if ($formatVersion >= self::FORMAT_VERSION) {
                new DateTimeImmutable((string) $manifest['started_at_utc']);
                new DateTimeImmutable((string) $manifest['completed_at_utc']);
            }
        } catch (Throwable) {
            throw new RuntimeException('Timestamp invalido no manifest de backup.');
        }
    }
}
