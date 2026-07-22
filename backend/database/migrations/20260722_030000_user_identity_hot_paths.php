<?php

declare(strict_types=1);

/**
 * Normaliza identificadores de usuario usados em joins quentes. A migration
 * aborta antes de cada ALTER quando encontra valor nao UUID ou usuario orfao.
 * Referencias financeiras legadas sao preservadas em coluna dedicada.
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
    $columnMeta = static function (string $table, string $column) use ($db): ?array {
        $stmt = $db->prepare(
            'SELECT COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME '
            . 'FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name '
            . 'LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    };
    $foreignKeyExists = static function (string $table, string $constraint) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS '
            . "WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :table_name "
            . "AND CONSTRAINT_NAME = :constraint_name AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        );
        $stmt->execute([':table_name' => $table, ':constraint_name' => $constraint]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $foreignKeyOnColumnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE '
            . 'WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :table_name '
            . 'AND COLUMN_NAME = :column_name AND REFERENCED_TABLE_NAME IS NOT NULL'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $assertCanonicalValues = static function (string $table, string $column) use ($db): void {
        $tableQuoted = '`' . str_replace('`', '', $table) . '`';
        $columnQuoted = '`' . str_replace('`', '', $column) . '`';
        $invalid = (int) $db->query(
            "SELECT COUNT(*) FROM {$tableQuoted}
             WHERE {$columnQuoted} IS NOT NULL
               AND TRIM({$columnQuoted}) <> ''
               AND {$columnQuoted} NOT REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'"
        )->fetchColumn();
        if ($invalid > 0) {
            throw new RuntimeException("{$table}.{$column} possui {$invalid} identificador(es) nao canonico(s).");
        }
        $orphans = (int) $db->query(
            "SELECT COUNT(*)
             FROM {$tableQuoted} source_row
             LEFT JOIN users u
               ON u.id COLLATE utf8mb4_unicode_ci = source_row.{$columnQuoted} COLLATE utf8mb4_unicode_ci
             WHERE source_row.{$columnQuoted} IS NOT NULL
               AND TRIM(source_row.{$columnQuoted}) <> ''
               AND u.id IS NULL"
        )->fetchColumn();
        if ($orphans > 0) {
            throw new RuntimeException("{$table}.{$column} possui {$orphans} referencia(s) orfa(s).");
        }
    };

    if ($tableExists('transactions') && $columnMeta('transactions', 'legacy_user_reference') === null) {
        $db->exec('ALTER TABLE transactions ADD COLUMN legacy_user_reference VARCHAR(64) NULL AFTER user_id');
    }
    if ($tableExists('transactions')) {
        $db->exec(
            "UPDATE transactions t
             LEFT JOIN users u ON u.id = t.user_id
             SET t.legacy_user_reference = COALESCE(t.legacy_user_reference, t.user_id),
                 t.user_id = NULL
             WHERE t.user_id IS NOT NULL
               AND TRIM(t.user_id) <> ''
               AND (
                    t.user_id NOT REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
                    OR u.id IS NULL
               )"
        );
    }

    foreach (['auth_sessions', 'email_verifications'] as $ephemeralTable) {
        if (!$tableExists($ephemeralTable) || $columnMeta($ephemeralTable, 'user_id') === null) {
            continue;
        }
        $quoted = '`' . $ephemeralTable . '`';
        $db->exec(
            "DELETE source_row FROM {$quoted} source_row
             LEFT JOIN users u
               ON u.id COLLATE utf8mb4_unicode_ci = source_row.user_id COLLATE utf8mb4_unicode_ci
             WHERE source_row.user_id IS NOT NULL AND u.id IS NULL"
        );
    }

    $targets = [
        'email_verifications' => ['user_id'],
        'user_bookmarks' => ['user_id'],
        'user_highlights' => ['user_id'],
        'admin_audit_logs' => ['admin_user_id'],
        'auth_sessions' => ['user_id'],
        'laws' => ['created_by_user_id', 'updated_by_user_id', 'published_by_user_id'],
        'material_ratings' => ['user_id'],
        'questions_groups' => ['created_by_user_id', 'updated_by_user_id'],
        'analytics_lifecycle_events' => ['user_id'],
        'legal_comment_reports' => ['user_id'],
        'legal_content_reactions' => ['user_id'],
        'legal_user_comments' => ['user_id'],
        'legal_user_favorites' => ['user_id'],
        'legal_user_notes' => ['user_id'],
        'legal_user_progress' => ['user_id'],
        'legal_user_reader_annotations' => ['user_id'],
    ];

    foreach ($targets as $table => $columns) {
        if (!$tableExists($table)) {
            continue;
        }
        foreach ($columns as $column) {
            $meta = $columnMeta($table, $column);
            if ($meta === null) {
                continue;
            }
            $isCanonical = strtolower((string) $meta['COLUMN_TYPE']) === 'varchar(36)'
                && strtolower((string) $meta['COLLATION_NAME']) === 'utf8mb4_unicode_ci';
            if ($isCanonical) {
                continue;
            }
            $assertCanonicalValues($table, $column);
            $nullableSql = strtoupper((string) $meta['IS_NULLABLE']) === 'YES' ? 'NULL DEFAULT NULL' : 'NOT NULL';
            $db->exec(
                'ALTER TABLE `' . str_replace('`', '', $table) . '` MODIFY COLUMN `'
                . str_replace('`', '', $column)
                . "` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci {$nullableSql}"
            );
        }
    }

    $foreignKeys = [
        ['auth_sessions', 'fk_auth_sessions_user_scale', 'user_id', 'CASCADE'],
        ['email_verifications', 'fk_email_verifications_user_scale', 'user_id', 'CASCADE'],
        ['user_bookmarks', 'fk_user_bookmarks_user_scale', 'user_id', 'CASCADE'],
        ['user_highlights', 'fk_user_highlights_user_scale', 'user_id', 'CASCADE'],
        ['material_ratings', 'fk_material_ratings_user_scale', 'user_id', 'CASCADE'],
        ['analytics_lifecycle_events', 'fk_analytics_lifecycle_user_scale', 'user_id', 'SET NULL'],
        ['legal_comment_reports', 'fk_legal_comment_reports_user_scale', 'user_id', 'CASCADE'],
        ['legal_content_reactions', 'fk_legal_content_reactions_user_scale', 'user_id', 'CASCADE'],
        ['legal_user_comments', 'fk_legal_user_comments_user_scale', 'user_id', 'CASCADE'],
        ['legal_user_favorites', 'fk_legal_user_favorites_user_scale', 'user_id', 'CASCADE'],
        ['legal_user_notes', 'fk_legal_user_notes_user_scale', 'user_id', 'CASCADE'],
        ['legal_user_progress', 'fk_legal_user_progress_user_scale', 'user_id', 'CASCADE'],
        ['legal_user_reader_annotations', 'fk_legal_reader_annotations_user_scale', 'user_id', 'CASCADE'],
    ];
    foreach ($foreignKeys as [$table, $constraint, $column, $deleteRule]) {
        if (!$tableExists($table)
            || $columnMeta($table, $column) === null
            || $foreignKeyExists($table, $constraint)
            || $foreignKeyOnColumnExists($table, $column)) {
            continue;
        }
        $db->exec(
            "ALTER TABLE `{$table}` ADD CONSTRAINT `{$constraint}` FOREIGN KEY (`{$column}`) "
            . "REFERENCES users(id) ON DELETE {$deleteRule} ON UPDATE CASCADE"
        );
    }
};
