<?php

declare(strict_types=1);

/**
 * Mantem as paginas de atividade do proprio usuario em keyset sem filesort.
 * Rollback: DROP INDEX idx_user_answers_history_keyset ON user_answers;
 *           DROP INDEX idx_comments_user_history_keyset ON comments;
 */
return static function (PDO $db): void {
    $indexes = [
        ['user_answers', 'idx_user_answers_history_keyset', 'user_id, created_at, id'],
        ['comments', 'idx_comments_user_history_keyset', 'user_id, created_at, id'],
    ];

    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    foreach ($indexes as [$table, $index, $columns]) {
        if (!$tableExists($table) || $indexExists($table, $index)) {
            continue;
        }

        $db->exec(sprintf('CREATE INDEX `%s` ON `%s` (%s)', $index, $table, $columns));
    }
};
