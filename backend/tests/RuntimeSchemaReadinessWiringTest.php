<?php

declare(strict_types=1);

function assertRuntimeSchemaReadiness(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__);
$files = [
    'shared/auth/AuthSession.php' => 'autenticacao',
    'modules/notifications/repositories/NotificationsRepository.php' => 'notificacoes',
    'modules/study_schedule/repositories/StudyScheduleRepository.php' => 'cronograma de estudos',
];

foreach ($files as $relativePath => $operation) {
    $contents = (string) file_get_contents($root . '/' . $relativePath);
    assertRuntimeSchemaReadiness(
        str_contains($contents, 'SchemaReadiness::assertTablesAndColumns'),
        'O caminho ' . $operation . ' deve validar schema sem DDL runtime.'
    );
    foreach (['CREATE TABLE', 'ALTER TABLE', 'DROP TABLE'] as $ddl) {
        assertRuntimeSchemaReadiness(
            !str_contains($contents, $ddl),
            'O caminho ' . $operation . ' ainda contem DDL runtime: ' . $ddl
        );
    }
}

$subscriptionsRepository = (string) file_get_contents(
    $root . '/modules/subscriptions/repositories/SubscriptionsRepository.php'
);
assertRuntimeSchemaReadiness(
    !str_contains($subscriptionsRepository, 'SchemaReadiness::assertTablesAndColumns'),
    'O repository de assinaturas nao deve consultar information_schema em toda requisicao.'
);
assertRuntimeSchemaReadiness(
    !str_contains($subscriptionsRepository, 'ensureSchemaReadiness'),
    'A validacao de schema de assinaturas deve permanecer exclusiva das migrations e do preflight.'
);

$runtimeFoundationMigration = (string) file_get_contents(
    $root . '/database/migrations/20260711_000200_runtime_schema_foundation.php'
);
assertRuntimeSchemaReadiness(
    str_contains($runtimeFoundationMigration, 'provider_webhook_events'),
    'A tabela de webhooks do provedor deve ser garantida pela migration de fundacao.'
);

foreach ([
    'scripts/migrations/run_schema_migrations.php',
    'scripts/diagnostics/schema_audit.php',
    'scripts/diagnostics/explain_critical_queries.php',
    'scripts/diagnostics/runtime_ddl_inventory.php',
    'scripts/backfills/json_column_preflight.php',
] as $relativePath) {
    assertRuntimeSchemaReadiness(is_file($root . '/' . $relativePath), 'Script operacional ausente: ' . $relativePath);
}

fwrite(STDOUT, "Runtime schema readiness wiring assertions passed.\n");
