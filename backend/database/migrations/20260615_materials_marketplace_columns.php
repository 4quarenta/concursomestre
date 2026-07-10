<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

require_once __DIR__ . '/../../config/database.php';

$db = (new Database())->getConnection();

$columnExists = static function (PDO $db, string $table, string $column): bool {
    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
          AND COLUMN_NAME = :column_name
    ");
    $stmt->execute([
        ':table_name' => $table,
        ':column_name' => $column,
    ]);

    return (int) $stmt->fetchColumn() > 0;
};

$addColumn = static function (PDO $db, callable $columnExists, string $column, string $definition): void {
    if ($columnExists($db, 'materials', $column)) {
        echo "materials.{$column}: ok\n";
        return;
    }

    $db->exec("ALTER TABLE materials ADD COLUMN {$column} {$definition}");
    echo "materials.{$column}: added\n";
};

$addColumn($db, $columnExists, 'subject_text', 'VARCHAR(255) NULL AFTER subject_id');
$addColumn($db, $columnExists, 'topic_id', 'INT NULL AFTER subject_text');
$addColumn($db, $columnExists, 'topic', 'VARCHAR(255) NULL AFTER topic_id');
$addColumn($db, $columnExists, 'page_count', 'INT NULL AFTER topic');
$addColumn($db, $columnExists, 'year', 'INT NULL AFTER page_count');
$addColumn($db, $columnExists, 'preview_url', 'VARCHAR(500) NULL AFTER files_json');
$addColumn($db, $columnExists, 'cover_url', 'VARCHAR(500) NULL AFTER preview_url');
$addColumn($db, $columnExists, 'rejection_reason', 'TEXT NULL AFTER status');

echo "materials marketplace columns migration complete\n";
