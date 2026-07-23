<?php

declare(strict_types=1);

$script = (string) file_get_contents(
    __DIR__ . '/../scripts/tasks/reset_production_content.php'
);

function resetSafetyAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

foreach ([
    "'users'",
    "'system_settings'",
    "'plans'",
    "'user_subscriptions'",
    "'transactions'",
    "'provider_webhook_events'",
    "'schema_migrations'",
] as $protectedTable) {
    resetSafetyAssert(
        str_contains($script, $protectedTable),
        'Tabela protegida ausente do contrato: ' . $protectedTable
    );
}

foreach ([
    "'questions'",
    "'question_options'",
    "'comments'",
    "'filters'",
    "'provas'",
    "'laws'",
    "'materials'",
    "'user_answers'",
] as $resetTable) {
    resetSafetyAssert(
        str_contains($script, $resetTable),
        'Tabela de conteudo ausente do reset: ' . $resetTable
    );
}

resetSafetyAssert(
    str_contains($script, "getenv('CONTENT_RESET_ALLOWED') !== '1'"),
    'Reset sem trava ambiental.'
);
resetSafetyAssert(
    str_contains($script, 'CONTENT_RESET_CONFIRMATION'),
    'Reset sem token explicito.'
);
resetSafetyAssert(
    str_contains($script, '$unknownTables !== []'),
    'Reset nao recusa tabelas desconhecidas.'
);
resetSafetyAssert(
    str_contains($script, "SET FOREIGN_KEY_CHECKS = 0")
        && str_contains($script, "SET FOREIGN_KEY_CHECKS = 1"),
    'Reset nao restaura verificacao de chaves estrangeiras.'
);
resetSafetyAssert(
    str_contains($script, '$db->beginTransaction()')
        && str_contains($script, '$db->rollBack()'),
    'Reset nao e transacional.'
);

fwrite(STDOUT, "Production content reset safety assertions passed.\n");
