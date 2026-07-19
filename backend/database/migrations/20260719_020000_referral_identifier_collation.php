<?php

declare(strict_types=1);

/**
 * Alinha os identificadores da tabela legada de indicacoes com users.id.
 *
 * A tabela referrals foi criada historicamente com utf8mb4_0900_ai_ci,
 * enquanto users.id e o livro financeiro usam utf8mb4_unicode_ci. A
 * diferenca impede joins no MySQL 8. A alteracao preserva os dados e indices.
 */
return static function (PDO $db): void {
    $schema = (string) $db->query('SELECT DATABASE()')->fetchColumn();
    $tableStmt = $db->prepare(
        "SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = 'referrals'"
    );
    $tableStmt->execute([':schema' => $schema]);
    if ((int) $tableStmt->fetchColumn() !== 1) {
        return;
    }

    $columnsStmt = $db->prepare(
        "SELECT COLUMN_NAME, IS_NULLABLE, COLLATION_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = :schema
           AND TABLE_NAME = 'referrals'
           AND COLUMN_NAME IN ('referrer_id', 'referred_user_id')"
    );
    $columnsStmt->execute([':schema' => $schema]);
    $columns = $columnsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($columns as $column) {
        if (($column['COLLATION_NAME'] ?? '') === 'utf8mb4_unicode_ci') {
            continue;
        }

        $columnName = (string) ($column['COLUMN_NAME'] ?? '');
        if (!in_array($columnName, ['referrer_id', 'referred_user_id'], true)) {
            continue;
        }

        $nullable = ($column['IS_NULLABLE'] ?? 'NO') === 'YES' ? 'NULL' : 'NOT NULL';
        $db->exec(
            "ALTER TABLE referrals
             MODIFY `{$columnName}` VARCHAR(36)
             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci {$nullable}"
        );
    }
};
