<?php

declare(strict_types=1);

/**
 * Formaliza o contrato completo de rankings que antes era reparado por DDL
 * durante requisicoes administrativas.
 *
 * A migration e aditiva e preserva registros e indices existentes. O enum de
 * status apenas amplia os valores aceitos, sem reescrever o estado atual.
 */
return static function (PDO $db): void {
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };

    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };

    if (!$tableExists('rankings') || !$tableExists('ranking_entries')) {
        throw new RuntimeException('As tabelas base de rankings devem existir antes desta migration.');
    }

    $rankingColumns = [
        'vacancies' => 'INT NOT NULL DEFAULT 10',
        'vacancies_ac' => 'INT NOT NULL DEFAULT 0',
        'vacancies_afro' => 'INT NOT NULL DEFAULT 0',
        'vacancies_pcd' => 'INT NOT NULL DEFAULT 0',
        'official_key_release_date' => 'DATETIME NULL',
        'key_status' => "ENUM('pending', 'official') NOT NULL DEFAULT 'pending'",
        'has_discursive' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'exam_types' => 'JSON NULL',
        'correct_key' => 'TEXT NULL',
        'image_url' => 'VARCHAR(255) NULL',
        'reserve_limit' => 'INT NOT NULL DEFAULT 10',
        'updated_by_user_id' => 'VARCHAR(64) NULL',
        'published_by_user_id' => 'VARCHAR(64) NULL',
        'updated_at' => 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ];
    foreach ($rankingColumns as $column => $definition) {
        if (!$columnExists('rankings', $column)) {
            $db->exec("ALTER TABLE rankings ADD COLUMN `{$column}` {$definition}");
        }
    }

    $db->exec(
        "ALTER TABLE rankings
         MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'archived', 'draft', 'active')
         NOT NULL DEFAULT 'pending'"
    );

    $entryColumns = [
        'user_name' => 'VARCHAR(255) NULL',
        'registration_number' => 'VARCHAR(100) NULL',
        'exam_type' => 'VARCHAR(100) NULL',
        'category' => "VARCHAR(50) NOT NULL DEFAULT 'AC'",
        'user_answers' => 'TEXT NULL',
        'discursive_score' => 'DECIMAL(5,2) NULL',
        'status' => "ENUM('active', 'disqualified') NOT NULL DEFAULT 'active'",
    ];
    foreach ($entryColumns as $column => $definition) {
        if (!$columnExists('ranking_entries', $column)) {
            $db->exec("ALTER TABLE ranking_entries ADD COLUMN `{$column}` {$definition}");
        }
    }
    $db->exec('ALTER TABLE ranking_entries MODIFY COLUMN score DECIMAL(10,2) NULL DEFAULT 0');
};
