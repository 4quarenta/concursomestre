<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);
$deploy = (string) file_get_contents($root . '/scripts/deploy/deploy-release.sh');
$library = (string) file_get_contents($root . '/scripts/deploy/lib.sh');

foreach ([
    'CM_MIGRATION_CNF_SOURCE',
    'cm_assert_secret_file_permissions "$CM_MIGRATION_CNF_SOURCE"',
    'cm_prepare_migration_environment "$CM_MIGRATION_CNF_SOURCE"',
    'export DB_USER="$CM_MIGRATION_DB_USER"',
    'export DB_PASSWORD="$CM_MIGRATION_DB_PASSWORD"',
] as $needle) {
    if (!str_contains($deploy, $needle)) {
        throw new RuntimeException('Deploy migration principal wiring ausente: ' . $needle);
    }
}

foreach ([
    'cm_mysql_cnf_value()',
    'section != "[client]"',
    'Configuracao privada do principal de migration incompleta.',
] as $needle) {
    if (!str_contains($library, $needle)) {
        throw new RuntimeException('Parser de credencial privada ausente: ' . $needle);
    }
}

if (preg_match('/cm_run env APP_ENV=production.*run_schema_migrations\.php.*--apply/', $deploy)) {
    throw new RuntimeException('Deploy ainda passa credenciais de migration por command wrapper.' );
}

if (PHP_OS_FAMILY !== 'Windows') {
    exec('bash -n ' . escapeshellarg($root . '/scripts/deploy/lib.sh') . ' && bash -n ' . escapeshellarg($root . '/scripts/deploy/deploy-release.sh'), $output, $status);
    if ($status !== 0) {
        throw new RuntimeException('Scripts de deploy falharam no bash -n.');
    }
}

fwrite(STDOUT, "DeployMigrationPrincipalWiringTest: PASS\n");
