<?php

declare(strict_types=1);

function platformScaleWiringAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$migration = (string) file_get_contents(
    $backend . '/database/migrations/20260722_020000_platform_scale_readiness.php'
);
$rollback = (string) file_get_contents(
    $backend . '/database/rollbacks/20260722_020000_platform_scale_readiness.sql'
);
$worker = (string) file_get_contents($backend . '/scripts/workers/process_question_ingestion_jobs.php');
$legalRepository = (string) file_get_contents(
    $backend . '/modules/legal_commentary/repositories/LegalCommentaryRepository.php'
);
$usersRepository = (string) file_get_contents($backend . '/modules/users/repositories/UsersRepository.php');
$rehearsal = (string) file_get_contents(
    $backend . '/scripts/performance/rehearse_platform_scale_migrations.php'
);

foreach ([
    'idx_private_ingestion_jobs_available',
    'idx_comments_target_public_keyset',
    'idx_comments_type_target_public_keyset',
    'idx_notifications_visible_keyset',
    'idx_legal_comments_article_keyset',
    'idx_legal_reactions_target_value',
    'idx_study_sessions_user_latest',
    'idx_saved_questions_user_keyset',
    'idx_transactions_user_keyset',
    'idx_reports_moderation_queue',
    'idx_materials_public_keyset',
] as $index) {
    platformScaleWiringAssert(str_contains($migration, $index), 'Migration sem indice esperado: ' . $index);
    platformScaleWiringAssert(str_contains($rollback, $index), 'Rollback sem indice esperado: ' . $index);
}
platformScaleWiringAssert(str_contains($worker, '$workerId'), 'Worker deve declarar identidade unica.');
platformScaleWiringAssert(
    str_contains($worker, 'reserveNextJob($workerId)'),
    'Worker deve reservar jobs com identidade.'
);
platformScaleWiringAssert(
    str_contains($usersRepository, 'FORCE INDEX (idx_user_answers_history_keyset)'),
    'Historico de respostas deve usar o indice keyset dedicado, sem depender da seletividade atual.'
);
platformScaleWiringAssert(
    !str_contains($usersRepository, ':since IS NULL OR ua.created_at'),
    'Historico de respostas ainda usa predicado OR opcional que degrada o plano.'
);
platformScaleWiringAssert(
    str_contains($rehearsal, 'concursomestre_scale_stage_'),
    'Ensaio de migration deve recusar a base oficial.'
);
platformScaleWiringAssert(
    str_contains($rehearsal, 'foreach ([1, 2] as $pass)'),
    'Ensaio deve comprovar idempotencia aplicando as migrations duas vezes.'
);
platformScaleWiringAssert(
    !str_contains($legalRepository, 'COLLATE utf8mb4_unicode_ci'),
    'Lei Comentada ainda forca collation em consultas quentes e impede uso eficiente dos indices.'
);
platformScaleWiringAssert(
    str_contains($migration, "moderation_status = 'approved'"),
    'Migration deve materializar o status de comentarios legados antes de usar o indice canonico.'
);

fwrite(STDOUT, "Platform scale readiness wiring assertions passed.\n");
