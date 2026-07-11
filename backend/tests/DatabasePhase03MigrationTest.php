<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/database/SchemaMigrationRunner.php';

function assertDatabasePhase03(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$statements = SchemaMigrationRunner::splitSqlStatements(
    "CREATE TABLE sample (value VARCHAR(20));\n"
    . "INSERT INTO sample (value) VALUES ('a;b');\n"
    . "-- comentario com ;\n"
    . "INSERT INTO sample (value) VALUES (\"c;d\");"
);
assertDatabasePhase03(count($statements) === 3, 'O split SQL deve preservar ponto e virgula dentro de strings.');
assertDatabasePhase03(str_contains($statements[1], "'a;b'"), 'String SQL simples foi quebrada incorretamente.');
assertDatabasePhase03(str_contains($statements[2], '"c;d"'), 'String SQL dupla foi quebrada incorretamente.');

$root = dirname(__DIR__);
$requiredMigrations = [
    'database/migrations/20260711_000000_schema_migrations.sql',
    'database/migrations/20260711_000100_schema_audit_observability.sql',
    'database/migrations/20260711_000200_runtime_schema_foundation.php',
    'database/migrations/20260711_000210_runtime_schema_compatibility.php',
    'database/migrations/20260711_000220_provider_webhook_unique_constraint.php',
];
foreach ($requiredMigrations as $relativePath) {
    assertDatabasePhase03(is_file($root . '/' . $relativePath), 'Migration obrigatoria ausente: ' . $relativePath);
}

$compatibilityMigration = (string) file_get_contents($root . '/database/migrations/20260711_000210_runtime_schema_compatibility.php');
foreach (['DROP TABLE', 'DROP COLUMN', ' CONVERT TO ', ' MODIFY COLUMN '] as $unsafeNeedle) {
    assertDatabasePhase03(
        !str_contains(strtoupper($compatibilityMigration), trim($unsafeNeedle)),
        'Migration de compatibilidade nao pode conter operacao destrutiva: ' . trim($unsafeNeedle)
    );
}

$webhookConstraintMigration = (string) file_get_contents($root . '/database/migrations/20260711_000220_provider_webhook_unique_constraint.php');
assertDatabasePhase03(
    str_contains($webhookConstraintMigration, 'HAVING COUNT(*) > 1'),
    'Indice unico de webhook deve consultar duplicidades antes de criar a restricao.'
);

$runnerSource = (string) file_get_contents($root . '/shared/database/SchemaMigrationRunner.php');
assertDatabasePhase03(
    str_contains($runnerSource, "substr(hash('sha256', (string) \$migration['filename']), 0, 12)"),
    'Runner deve diferenciar migrations legadas que compartilham a mesma versao por data.'
);
assertDatabasePhase03(
    str_contains($runnerSource, '$this->db->beginTransaction();')
        && str_contains($runnerSource, '$this->db->rollBack();'),
    'Baseline legado deve ser transacional para nao registrar parcialmente o historico.'
);

fwrite(STDOUT, "Database phase 03 migration assertions passed.\n");
