<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/database/SchemaMigrationRunner.php';

// O ambiente da aplicacao e carregado por config/database.php. Para impedir
// que o runner de migrations reutilize o principal runtime, os overrides
// privados sao aplicados somente neste processo CLI antes da conexao.
foreach ([
    'MIGRATION_DB_HOST' => 'DB_HOST',
    'MIGRATION_DB_PORT' => 'DB_PORT',
    'MIGRATION_DB_NAME' => 'DB_NAME',
    'MIGRATION_DB_USER' => 'DB_USER',
    'MIGRATION_DB_PASSWORD' => 'DB_PASSWORD',
] as $migrationKey => $databaseKey) {
    $value = getenv($migrationKey);
    if ($value === false) {
        continue;
    }
    putenv($databaseKey . '=' . $value);
    $_ENV[$databaseKey] = $value;
    $_SERVER[$databaseKey] = $value;
}

$options = getopt('', ['status', 'dry-run', 'audit', 'apply', 'baseline-legacy', 'migration::']);
$actions = array_filter([
    isset($options['status']),
    isset($options['dry-run']),
    isset($options['audit']),
    isset($options['apply']),
    isset($options['baseline-legacy']),
]);
if (count($actions) > 1) {
    fwrite(STDERR, "Escolha apenas uma acao: --status, --dry-run, --audit, --apply ou --baseline-legacy.\n");
    exit(2);
}

$action = isset($options['apply']) ? 'apply'
    : (isset($options['baseline-legacy']) ? 'baseline'
        : (isset($options['audit']) ? 'audit'
            : (isset($options['dry-run']) ? 'dry-run' : 'status')));

if (in_array($action, ['apply', 'baseline'], true)
    && filter_var(getenv('MIGRATIONS_ALLOW_APPLY') ?: 'false', FILTER_VALIDATE_BOOLEAN) !== true) {
    fwrite(STDERR, "Defina MIGRATIONS_ALLOW_APPLY=true para alterar o metadata de migrations.\n");
    exit(2);
}

if ($action === 'apply'
    && strtolower((string) (getenv('APP_ENV') ?: 'development')) === 'production'
    && filter_var(getenv('MIGRATIONS_ALLOW_PRODUCTION') ?: 'false', FILTER_VALIDATE_BOOLEAN) !== true) {
    fwrite(STDERR, "Em producao, defina MIGRATIONS_ALLOW_PRODUCTION=true apos backup e staging.\n");
    exit(2);
}

try {
    $db = (new Database())->getConnection();
    $runner = new SchemaMigrationRunner(
        $db,
        dirname(__DIR__, 2) . '/database/migrations',
        trim((string) (getenv('MIGRATIONS_APPLIED_BY') ?: get_current_user() ?: 'cli'))
    );

    if ($action === 'baseline') {
        $result = ['action' => 'baseline', 'recorded' => $runner->baselineLegacy()];
    } elseif ($action === 'apply') {
        $result = [
            'action' => 'apply',
            'executed' => $runner->apply(isset($options['migration']) ? (string) $options['migration'] : null),
        ];
    } elseif ($action === 'audit') {
        $result = ['action' => 'audit', 'audit' => $runner->audit()];
    } else {
        $status = $runner->status();
        $pending = array_values(array_filter($status, static fn (array $migration): bool => !$migration['applied']));
        $result = [
            'action' => $action,
            'migrations' => $action === 'dry-run' ? $pending : $status,
            'pending_count' => count($pending),
        ];
    }

    fwrite(STDOUT, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration runner failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
