<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este reset so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

const CONTENT_RESET_CONFIRMATION = 'RESET_CONTENT_KEEP_ACCOUNTS_AND_FINANCE';

$apply = in_array('--apply', $argv, true);
$confirmation = '';
foreach (array_slice($argv, 1) as $argument) {
    if (str_starts_with($argument, '--confirm=')) {
        $confirmation = trim(substr($argument, 10));
    }
}

$protectedTables = [
    // Identidade, perfil e autenticacao.
    'addresses',
    'auth_refresh_tokens',
    'auth_sessions',
    'bank_accounts',
    'email_verifications',
    'user_cards',
    'users',

    // Configuracao estrutural e operacional.
    'cache_settings',
    'filter_types',
    'plans',
    'schema_audit_runs',
    'schema_backfill_runs',
    'schema_migrations',
    'security_ip_bans',
    'system_settings',

    // Historico financeiro, assinaturas e rastreabilidade obrigatoria.
    'admin_audit_logs',
    'coupon_reservations',
    'financial_ledger_entries',
    'provider_webhook_events',
    'referral_commission_entries',
    'referral_payout_cycles',
    'referral_payout_items',
    'referrals',
    'transactions',
    'user_subscriptions',
];

$resetTables = [
    'analytics_lifecycle_events',
    'article_doutrina',
    'article_exam_tips',
    'article_jurisprudence',
    'article_sumulas',
    'comment_likes',
    'comments',
    'filter_aliases',
    'filters',
    'law_article_blocks',
    'law_article_versions',
    'law_articles',
    'law_section_editorials',
    'law_sections',
    'law_updates',
    'law_versions',
    'laws',
    'legal_ai_batch_items',
    'legal_ai_batch_runs',
    'legal_areas',
    'legal_comment_reports',
    'legal_content_reactions',
    'legal_sync_logs',
    'legal_user_comments',
    'legal_user_favorites',
    'legal_user_notes',
    'legal_user_progress',
    'legal_user_reader_annotations',
    'marketing_automation_events',
    'material_moderation_events',
    'material_ratings',
    'material_uploads',
    'materials',
    'notifications',
    'platform_event_outbox',
    'private_ingestion_jobs',
    'private_ingestion_nonces',
    'private_ingestion_requests',
    'prova_arquivos',
    'prova_caderno_cargos',
    'prova_caderno_filters',
    'prova_cadernos',
    'prova_cargo_detalhes',
    'prova_cargo_requisitos',
    'prova_cargo_vagas',
    'prova_extracao_itens',
    'prova_extracoes',
    'prova_filters',
    'provas',
    'question_answer_idempotency',
    'question_assets',
    'question_context_questions',
    'question_contexts',
    'question_editorial_feedback',
    'question_editorials',
    'question_filters',
    'question_options',
    'question_provas',
    'question_search_documents',
    'question_stats',
    'questions',
    'questions_groups',
    'ranking_entries',
    'rankings',
    'report_moderation_drafts',
    'report_moderation_history',
    'reports',
    'simulations',
    'stripe_testing_matrix_runs',
    'study_sessions',
    'subject_statistics',
    'sync_errors',
    'teacher_comments',
    'user_answer_counters',
    'user_answers',
    'user_answers_archive',
    'user_badges',
    'user_bookmarks',
    'user_feedback',
    'user_feedback_votes',
    'user_gamification_events',
    'user_highlights',
    'user_notes',
    'user_saved_questions',
    'user_statistics',
    'user_streaks',
    'user_study_schedules',
];

$db = (new Database())->getConnection();
$databaseName = (string) $db->query('SELECT DATABASE()')->fetchColumn();
$environment = strtolower(trim((string) (getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? ''))));

$existingTables = array_map(
    'strval',
    $db->query(
        'SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         ORDER BY TABLE_NAME'
    )->fetchAll(PDO::FETCH_COLUMN) ?: []
);

$knownTables = array_values(array_unique(array_merge($protectedTables, $resetTables)));
$unknownTables = array_values(array_diff($existingTables, $knownTables));
sort($unknownTables);
if ($unknownTables !== []) {
    throw new RuntimeException(
        'Reset recusado: classifique primeiro as tabelas desconhecidas: ' . implode(', ', $unknownTables)
    );
}

$presentResetTables = array_values(array_intersect($resetTables, $existingTables));
$presentProtectedTables = array_values(array_intersect($protectedTables, $existingTables));
$counts = [];
foreach ($presentResetTables as $table) {
    $counts[$table] = (int) $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
}
$protectedCounts = [];
foreach ($presentProtectedTables as $table) {
    $protectedCounts[$table] = (int) $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
}

$preview = [
    'mode' => $apply ? 'apply' : 'dry-run',
    'database' => $databaseName,
    'environment' => $environment,
    'resetTables' => $counts,
    'rowsToDelete' => array_sum($counts),
    'protectedTables' => $protectedCounts,
    'protectedRows' => array_sum($protectedCounts),
];

if (!$apply) {
    fwrite(STDOUT, json_encode($preview, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}

if ($environment !== 'production') {
    throw new RuntimeException('Reset recusado: APP_ENV precisa ser production.');
}
if (getenv('CONTENT_RESET_ALLOWED') !== '1') {
    throw new RuntimeException('Reset recusado: CONTENT_RESET_ALLOWED=1 nao foi informado.');
}
if (!hash_equals(CONTENT_RESET_CONFIRMATION, $confirmation)) {
    throw new RuntimeException('Reset recusado: token de confirmacao invalido.');
}

$deleted = [];
$db->exec('SET FOREIGN_KEY_CHECKS = 0');
$db->beginTransaction();
try {
    foreach ($presentResetTables as $table) {
        $deleted[$table] = (int) $db->exec("DELETE FROM `{$table}`");
    }
    $db->commit();
} catch (Throwable $exception) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    throw $exception;
} finally {
    $db->exec('SET FOREIGN_KEY_CHECKS = 1');
}

$remaining = [];
foreach ($presentResetTables as $table) {
    $remaining[$table] = (int) $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
}
if (array_sum($remaining) !== 0) {
    throw new RuntimeException('Reset incompleto: uma ou mais tabelas ainda possuem registros.');
}

fwrite(STDOUT, json_encode([
    'status' => 'complete',
    'database' => $databaseName,
    'deletedRows' => array_sum($deleted),
    'deletedByTable' => $deleted,
    'protectedTables' => $protectedCounts,
    'protectedRows' => array_sum($protectedCounts),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
