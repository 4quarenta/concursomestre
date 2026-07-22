<?php

declare(strict_types=1);

/**
 * Indices dos fluxos que crescem com usuarios/conteudo e robustez da fila de
 * ingestao. A migration e somente aditiva e deve ser aplicada antes da carga.
 *
 * Rollback documentado em:
 * backend/database/rollbacks/20260722_020000_platform_scale_readiness.sql
 */
return static function (PDO $db): void {
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $addIndex = static function (string $table, string $index, array $columns) use (
        $db,
        $tableExists,
        $columnExists,
        $indexExists
    ): void {
        if (!$tableExists($table) || $indexExists($table, $index)) {
            return;
        }
        foreach ($columns as $column) {
            if (!$columnExists($table, $column)) {
                return;
            }
        }
        $quotedColumns = implode(', ', array_map(
            static fn (string $column): string => '`' . str_replace('`', '', $column) . '`',
            $columns
        ));
        $db->exec("CREATE INDEX `{$index}` ON `{$table}` ({$quotedColumns})");
    };

    if ($tableExists('private_ingestion_jobs')) {
        $columns = [
            'available_at' => 'DATETIME NULL AFTER status',
            'locked_by' => 'VARCHAR(120) NULL AFTER locked_at',
            'last_error_at' => 'DATETIME NULL AFTER error_message',
            'dead_lettered_at' => 'DATETIME NULL AFTER completed_at',
        ];
        foreach ($columns as $column => $definition) {
            if (!$columnExists('private_ingestion_jobs', $column)) {
                $db->exec("ALTER TABLE private_ingestion_jobs ADD COLUMN `{$column}` {$definition}");
            }
        }
        $db->exec(
            "UPDATE private_ingestion_jobs SET available_at = COALESCE(available_at, created_at) "
            . "WHERE status = 'pending' AND available_at IS NULL"
        );
    }

    if ($tableExists('reports')) {
        if (!$columnExists('reports', 'evidence_url')) {
            $db->exec('ALTER TABLE reports ADD COLUMN evidence_url VARCHAR(2048) NULL AFTER status');
        }
        if (!$columnExists('reports', 'resolved_at')) {
            $db->exec('ALTER TABLE reports ADD COLUMN resolved_at DATETIME NULL AFTER evidence_url');
        }
    }

    foreach (['comments', 'legal_user_comments'] as $commentsTable) {
        if ($tableExists($commentsTable) && $columnExists($commentsTable, 'moderation_status')) {
            $db->exec(
                "UPDATE `{$commentsTable}` SET moderation_status = 'approved' "
                . "WHERE moderation_status IS NULL OR TRIM(moderation_status) = ''"
            );
        }
    }

    $addIndex('private_ingestion_jobs', 'idx_private_ingestion_jobs_available', ['status', 'available_at', 'id']);
    $addIndex('private_ingestion_jobs', 'idx_private_ingestion_jobs_stale', ['status', 'locked_at', 'id']);

    $addIndex('comments', 'idx_comments_target_public_keyset', [
        'target_id', 'moderation_status', 'created_at', 'id',
    ]);
    $addIndex('comments', 'idx_comments_type_target_public_keyset', [
        'target_type', 'target_id', 'moderation_status', 'created_at', 'id',
    ]);
    $addIndex('notifications', 'idx_notifications_visible_keyset', [
        'user_id', 'deleted_at', 'created_at', 'id',
    ]);
    $addIndex('notifications', 'idx_notifications_unread_count', [
        'user_id', 'is_read', 'deleted_at', 'id',
    ]);
    $addIndex('legal_user_comments', 'idx_legal_comments_article_keyset', [
        'law_article_id', 'status', 'moderation_status', 'created_at', 'id',
    ]);
    $addIndex('legal_user_comments', 'idx_legal_comments_user_keyset', ['user_id', 'created_at', 'id']);
    $addIndex('legal_content_reactions', 'idx_legal_reactions_target_value', [
        'target_key', 'reaction_value', 'id',
    ]);
    $addIndex('legal_user_favorites', 'idx_legal_favorites_user_keyset', ['user_id', 'created_at', 'id']);
    $addIndex('study_sessions', 'idx_study_sessions_user_latest', ['user_id', 'ended_at', 'id']);
    $addIndex('simulations', 'idx_simulations_user_latest', ['user_id', 'start_time', 'id']);
    $addIndex('user_answers', 'idx_user_answers_simulation_batch', ['user_id', 'simulation_id', 'question_id']);
    $addIndex('user_saved_questions', 'idx_saved_questions_user_keyset', ['user_id', 'created_at', 'question_id']);
    $addIndex('transactions', 'idx_transactions_user_keyset', ['user_id', 'created_at', 'id']);
    $addIndex('transactions', 'idx_transactions_material_sales', ['material_id', 'status', 'id']);
    $addIndex('comment_likes', 'idx_comment_likes_comment_user', ['comment_id', 'user_id']);
    $addIndex('reports', 'idx_reports_moderation_queue', ['workflow_status', 'priority', 'created_at', 'id']);
    $addIndex('reports', 'idx_reports_target_status', ['target_type', 'target_id', 'status', 'created_at']);
    $addIndex('reports', 'idx_reports_admin_keyset', ['created_at', 'id']);
    $addIndex('materials', 'idx_materials_public_keyset', ['status', 'created_at', 'id']);
    $addIndex('admin_audit_logs', 'idx_admin_audit_keyset', ['created_at', 'id']);
    $addIndex('analytics_lifecycle_events', 'idx_analytics_lifecycle_keyset', ['created_at', 'id']);
};
