<?php

declare(strict_types=1);

/**
 * Formaliza no historico de migrations as colunas privadas de perfil.
 *
 * Essas colunas existiam em producao, mas bases antigas podiam cria-las em
 * runtime. A migration e idempotente e elimina a necessidade de DDL durante
 * login, leitura ou atualizacao de perfil.
 *
 * Rollback documentado em:
 * backend/database/rollbacks/20260718_010000_user_profile_contract.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([
            ':table_name' => $table,
            ':column_name' => $column,
        ]);
        return (int) $stmt->fetchColumn() > 0;
    };

    $definitions = [
        'phone' => 'VARCHAR(30) NULL',
        'auth_provider' => "VARCHAR(50) NOT NULL DEFAULT 'email'",
        'google_sub' => 'VARCHAR(255) NULL',
        'facebook_id' => 'VARCHAR(255) NULL',
        'apple_sub' => 'VARCHAR(255) NULL',
    ];

    foreach ($definitions as $column => $definition) {
        if (!$columnExists('users', $column)) {
            $db->exec("ALTER TABLE users ADD COLUMN `{$column}` {$definition}");
        }
    }
};
