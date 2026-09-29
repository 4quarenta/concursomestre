<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Identity purge tool is CLI-only.\n");
}

const IDENTITY_PURGE_TOKEN = 'PURGE_NON_ADMIN_IDENTITIES_V1';

/** @return array<string, string|bool> */
function identityPurgeOptions(array $arguments): array
{
    $options = ['execute' => false];
    foreach (array_slice($arguments, 1) as $argument) {
        if ($argument === '--execute') {
            $options['execute'] = true;
            continue;
        }
        if (!str_starts_with($argument, '--') || !str_contains($argument, '=')) {
            throw new InvalidArgumentException('Unknown argument.');
        }
        [$key, $value] = explode('=', substr($argument, 2), 2);
        if (!preg_match('/^[a-z][a-z0-9-]*$/', $key)) {
            throw new InvalidArgumentException('Invalid option name.');
        }
        $options[$key] = trim($value);
    }
    return $options;
}

function identityPurgeEnv(string $key, bool $required = true): string
{
    $value = $_ENV[$key] ?? getenv($key);
    $normalized = $value === false || $value === null ? '' : trim((string) $value);
    if ($required && $normalized === '') {
        throw new RuntimeException('Required environment variable is missing: ' . $key);
    }
    return $normalized;
}

function identityPurgeConnect(bool $execute): PDO
{
    $prefix = $execute ? 'DB_' : 'DB_READ_';
    $host = identityPurgeEnv($prefix . 'HOST');
    $port = identityPurgeEnv($prefix . 'PORT', false);
    $database = identityPurgeEnv($prefix . 'NAME');
    $user = identityPurgeEnv($prefix . 'USER');
    $password = identityPurgeEnv($prefix . 'PASSWORD');
    $dsn = 'mysql:host=' . $host . ($port !== '' ? ';port=' . $port : '')
        . ';dbname=' . $database . ';charset=utf8mb4';
    $db = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 10,
        PDO::ATTR_PERSISTENT => false,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $db->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $db->exec("SET time_zone = '-03:00'");
    return $db;
}

/** @return list<array{table: string, column: string}> */
function identityPurgeReferences(PDO $db): array
{
    $statement = $db->query(
        "SELECT TABLE_NAME, COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND REFERENCED_TABLE_NAME = 'users'
           AND REFERENCED_COLUMN_NAME = 'id'
         ORDER BY TABLE_NAME, COLUMN_NAME"
    );
    $references = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $references[] = ['table' => (string) $row['TABLE_NAME'], 'column' => (string) $row['COLUMN_NAME']];
    }
    return $references;
}

function identityPurgeQuote(string $identifier): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new InvalidArgumentException('Invalid SQL identifier.');
    }
    return '`' . $identifier . '`';
}

/** @return array<string, mixed> */
function identityPurgeSnapshot(PDO $db, bool $lock): array
{
    $suffix = $lock ? ' FOR UPDATE' : '';
    $admins = $db->query(
        "SELECT id FROM users
         WHERE LOWER(COALESCE(role, '')) = 'admin'
           AND LOWER(COALESCE(status, 'active')) = 'active'
         ORDER BY id" . $suffix
    )->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $adminId = count($admins) === 1 ? (string) $admins[0] : '';
    $references = identityPurgeReferences($db);
    $referenceCounts = [];
    foreach ($references as $reference) {
        $table = identityPurgeQuote($reference['table']);
        $column = identityPurgeQuote($reference['column']);
        $statement = $db->prepare("SELECT COUNT(*) FROM {$table} WHERE {$column} <> :admin_id");
        $statement->execute([':admin_id' => $adminId]);
        $referenceCounts[$reference['table'] . '.' . $reference['column']] = (int) $statement->fetchColumn();
    }
    ksort($referenceCounts);
    return [
        'database' => (string) $db->query('SELECT DATABASE()')->fetchColumn(),
        'active_admin_count' => count($admins),
        'admin_identity_fingerprint' => $adminId !== '' ? hash('sha256', $adminId) : '',
        'user_count' => (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn(),
        'non_admin_user_count' => $adminId === '' ? -1 : (int) $db->query(
            'SELECT COUNT(*) FROM users WHERE id <> ' . $db->quote($adminId)
        )->fetchColumn(),
        'non_admin_reference_counts' => $referenceCounts,
        'admin_id' => $adminId,
    ];
}

try {
    $options = identityPurgeOptions($argv);
    $execute = ($options['execute'] ?? false) === true;
    $db = identityPurgeConnect($execute);
    $snapshot = identityPurgeSnapshot($db, false);
    if (!$execute) {
        unset($snapshot['admin_id']);
        echo json_encode(['mode' => 'dry-run', 'snapshot' => $snapshot, 'writesExecuted' => 0], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

    if (strtolower(identityPurgeEnv('APP_ENV', false)) !== 'production'
        || identityPurgeEnv('IDENTITY_PURGE_PRODUCTION_ALLOWED', false) !== '1') {
        throw new RuntimeException('Production identity purge guard is missing.');
    }
    if (!hash_equals(IDENTITY_PURGE_TOKEN, (string) ($options['operation-token'] ?? ''))) {
        throw new RuntimeException('Invalid operation token.');
    }
    if (!hash_equals((string) $snapshot['database'], (string) ($options['confirm-database'] ?? ''))) {
        throw new RuntimeException('Database confirmation mismatch.');
    }

    $db->beginTransaction();
    $locked = identityPurgeSnapshot($db, true);
    if ((int) $locked['active_admin_count'] !== 1 || (int) $locked['non_admin_user_count'] < 0) {
        throw new RuntimeException('Exactly one active Admin is required.');
    }
    $allowedProfileTables = ['addresses', 'bank_accounts'];
    foreach ($locked['non_admin_reference_counts'] as $reference => $count) {
        [$table, $column] = explode('.', (string) $reference, 2);
        if (in_array($table, $allowedProfileTables, true)) {
            $statement = $db->prepare(
                'DELETE FROM ' . identityPurgeQuote($table)
                . ' WHERE ' . identityPurgeQuote($column) . ' <> :admin_id'
            );
            $statement->execute([':admin_id' => $locked['admin_id']]);
            continue;
        }
        if ((int) $count !== 0) {
            throw new RuntimeException('Non-admin references remain in ' . $reference . '.');
        }
    }
    $delete = $db->prepare('DELETE FROM users WHERE id <> :admin_id');
    $delete->execute([':admin_id' => $locked['admin_id']]);
    $deleted = $delete->rowCount();
    $after = identityPurgeSnapshot($db, false);
    if ((int) $after['user_count'] !== 1 || (int) $after['active_admin_count'] !== 1
        || !hash_equals((string) $locked['admin_identity_fingerprint'], (string) $after['admin_identity_fingerprint'])) {
        throw new RuntimeException('Identity purge postcondition failed.');
    }
    $db->commit();
    unset($after['admin_id']);
    echo json_encode([
        'status' => 'complete',
        'deleted_non_admin_users' => $deleted,
        'postcondition' => $after,
    ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Throwable $exception) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, json_encode(['status' => 'refused', 'message' => $exception->getMessage()], JSON_THROW_ON_ERROR) . PHP_EOL);
    exit(2);
}
