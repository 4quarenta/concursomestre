<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/shared/database/BackupDatabaseConfig.php';

function backupConfigAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function backupConfigExpectFailure(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (RuntimeException) {
        return;
    }
    throw new RuntimeException($message);
}

$runtime = [
    'DB_HOST' => 'runtime-db',
    'DB_PORT' => '3306',
    'DB_NAME' => 'runtime_schema',
    'DB_USER' => 'runtime_user',
    'DB_PASSWORD' => 'runtime_password',
];
$dedicated = [
    'BACKUP_DB_HOST' => 'backup-db',
    'BACKUP_DB_PORT' => '3307',
    'BACKUP_DB_NAME' => 'backup_schema',
    'BACKUP_DB_USER' => 'backup_user',
    'BACKUP_DB_PASSWORD' => 'backup_password',
];

$fromDedicatedFile = BackupDatabaseConfig::resolve(['BACKUP_DB_MODE' => 'dedicated', ...$runtime], $dedicated);
backupConfigAssert($fromDedicatedFile['user'] === 'backup_user', 'Dedicated backup user must win over runtime DB_USER.');
backupConfigAssert($fromDedicatedFile['source'] === 'dedicated', 'Dedicated credential source must be reported.');

$fromDedicatedEnvironment = BackupDatabaseConfig::resolve(['BACKUP_DB_MODE' => 'dedicated', ...$runtime, ...$dedicated], []);
backupConfigAssert($fromDedicatedEnvironment['host'] === 'backup-db', 'Backup-specific environment must be supported.');

$environmentWins = BackupDatabaseConfig::resolve([
    'BACKUP_DB_MODE' => 'dedicated',
    ...$runtime,
    ...$dedicated,
    'BACKUP_DB_USER' => 'environment_backup_user',
], [...$dedicated, 'BACKUP_DB_USER' => 'file_backup_user']);
backupConfigAssert($environmentWins['user'] === 'environment_backup_user', 'Explicit BACKUP_DB_* must override the secret file.');

$runtimeCompat = BackupDatabaseConfig::resolve([
    'BACKUP_DB_MODE' => 'runtime_compat',
    'BACKUP_ALLOW_RUNTIME_FALLBACK' => 'true',
    ...$runtime,
], []);
backupConfigAssert($runtimeCompat['user'] === 'runtime_user', 'Explicit runtime compatibility mode must remain available.');

backupConfigExpectFailure(
    static fn () => BackupDatabaseConfig::resolve(['BACKUP_DB_MODE' => 'dedicated', ...$runtime], []),
    'Dedicated mode must fail closed when credentials are missing.'
);
backupConfigExpectFailure(
    static fn () => BackupDatabaseConfig::resolve(['BACKUP_DB_MODE' => 'dedicated'], ['BACKUP_DB_USER' => 'partial']),
    'Incomplete dedicated credentials must fail closed.'
);
backupConfigExpectFailure(
    static fn () => BackupDatabaseConfig::resolve([
        'BACKUP_DB_MODE' => 'runtime_compat',
        'BACKUP_ALLOW_RUNTIME_FALLBACK' => 'false',
        ...$runtime,
    ], []),
    'Runtime fallback must require explicit authorization.'
);
backupConfigExpectFailure(
    static fn () => BackupDatabaseConfig::resolve(['BACKUP_DB_MODE' => 'dedicated'], [
        ...$dedicated,
        'BACKUP_DB_PORT' => '70000',
    ]),
    'Invalid backup port must fail.'
);

if (PHP_OS_FAMILY !== 'Windows') {
    $credentialFile = tempnam(sys_get_temp_dir(), 'cm-backup-config-');
    if ($credentialFile === false) throw new RuntimeException('Unable to create credential fixture.');
    file_put_contents($credentialFile, implode("\n", array_map(
        static fn (string $key, string $value): string => $key . '=' . $value,
        array_keys($dedicated),
        array_values($dedicated)
    )) . "\n");
    chmod($credentialFile, 0600);
    $fromPrivateFile = BackupDatabaseConfig::resolve([
        'BACKUP_DB_MODE' => 'dedicated',
        'BACKUP_DB_CREDENTIAL_FILE' => $credentialFile,
    ]);
    backupConfigAssert($fromPrivateFile['user'] === 'backup_user', 'Private credential file must be loaded.');
    chmod($credentialFile, 0644);
    backupConfigExpectFailure(
        static fn () => BackupDatabaseConfig::resolve([
            'BACKUP_DB_MODE' => 'dedicated',
            'BACKUP_DB_CREDENTIAL_FILE' => $credentialFile,
        ]),
        'World-readable credential file must fail.'
    );
    unlink($credentialFile);
}

fwrite(STDOUT, "Backup database configuration boundary assertions passed.\n");
