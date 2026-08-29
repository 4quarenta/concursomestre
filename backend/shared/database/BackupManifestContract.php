<?php

declare(strict_types=1);

final class BackupManifestContract
{
    public const FORMAT_VERSION = 2;

    /** @var list<string> */
    private const REQUIRED_FIELDS = [
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

    /** @param array<string, mixed> $manifest */
    public static function assertValid(array $manifest): void
    {
        if ((int) ($manifest['format_version'] ?? 0) !== self::FORMAT_VERSION) {
            throw new RuntimeException('Versao do manifest de backup invalida.');
        }
        foreach (self::REQUIRED_FIELDS as $field) {
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
        } catch (Throwable) {
            throw new RuntimeException('Timestamp invalido no manifest de backup.');
        }
    }
}
