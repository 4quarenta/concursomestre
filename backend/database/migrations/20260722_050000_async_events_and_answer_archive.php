<?php

declare(strict_types=1);

/**
 * Outbox transacional, contadores de respostas e armazenamento frio.
 *
 * A migration cria apenas estruturas. Backfills e arquivamento rodam em
 * scripts retomaveis para evitar locks longos durante o deploy.
 *
 * Rollback documentado em:
 * backend/database/rollbacks/20260722_050000_async_events_and_answer_archive.sql
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
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
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

    if ($tableExists('users')) {
        foreach ([
            'xp' => 'INT NOT NULL DEFAULT 0',
            'level' => 'INT NOT NULL DEFAULT 1',
            'reputation' => 'INT NOT NULL DEFAULT 0',
        ] as $column => $definition) {
            if (!$columnExists('users', $column)) {
                $db->exec("ALTER TABLE users ADD COLUMN {$column} {$definition}");
            }
        }
    }

    $db->exec(
        "CREATE TABLE IF NOT EXISTS user_streaks (
            user_id VARCHAR(64) NOT NULL PRIMARY KEY,
            current_streak INT NOT NULL DEFAULT 0,
            longest_streak INT NOT NULL DEFAULT 0,
            last_activity_date DATE NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_streaks_last_activity (last_activity_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $db->exec(
        "CREATE TABLE IF NOT EXISTS user_badges (
            user_id VARCHAR(64) NOT NULL,
            badge_key VARCHAR(80) NOT NULL,
            title VARCHAR(160) NOT NULL,
            description VARCHAR(255) NULL,
            awarded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, badge_key),
            INDEX idx_user_badges_awarded_at (awarded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $db->exec(
        "CREATE TABLE IF NOT EXISTS user_gamification_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_key VARCHAR(180) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            event_name VARCHAR(80) NOT NULL,
            xp_delta INT NOT NULL DEFAULT 0,
            reputation_delta INT NOT NULL DEFAULT 0,
            badge_key VARCHAR(80) NULL,
            metadata_json TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_gamification_event_key (event_key),
            INDEX idx_user_gamification_user_created (user_id, created_at),
            INDEX idx_user_gamification_event_name (event_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    foreach ([
        'badge_key' => 'VARCHAR(80) NULL',
        'metadata_json' => 'TEXT NULL',
    ] as $column => $definition) {
        if (!$columnExists('user_gamification_events', $column)) {
            $db->exec("ALTER TABLE user_gamification_events ADD COLUMN {$column} {$definition}");
        }
    }

    $db->exec(
        "CREATE TABLE IF NOT EXISTS platform_event_outbox (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            aggregate_type VARCHAR(80) NOT NULL,
            aggregate_id VARCHAR(120) NOT NULL,
            event_type VARCHAR(120) NOT NULL,
            idempotency_key VARCHAR(191) NOT NULL,
            payload_json JSON NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'pending',
            attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 8,
            available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            locked_at DATETIME NULL,
            locked_by VARCHAR(120) NULL,
            processed_at DATETIME NULL,
            dead_lettered_at DATETIME NULL,
            last_error TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_platform_event_outbox_idempotency (idempotency_key),
            INDEX idx_platform_event_outbox_claim (status, available_at, id),
            INDEX idx_platform_event_outbox_stale (status, locked_at, id),
            INDEX idx_platform_event_outbox_aggregate (aggregate_type, aggregate_id, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS user_answer_counters (
            user_id VARCHAR(36) NOT NULL PRIMARY KEY,
            total_answers BIGINT UNSIGNED NOT NULL DEFAULT 0,
            correct_answers BIGINT UNSIGNED NOT NULL DEFAULT 0,
            wrong_answers BIGINT UNSIGNED NOT NULL DEFAULT 0,
            first_answer_at DATETIME NULL,
            last_answer_at DATETIME NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_answer_counters_ranking (total_answers, correct_answers, user_id),
            CONSTRAINT fk_user_answer_counters_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if ($tableExists('user_answers') && !$tableExists('user_answers_archive')) {
        $db->exec('CREATE TABLE user_answers_archive LIKE user_answers');
        $db->exec(
            'ALTER TABLE user_answers_archive '
            . 'ADD COLUMN archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, '
            . 'ADD COLUMN archive_batch_id CHAR(36) NULL'
        );
    }

    if ($tableExists('user_answers_archive')) {
        if (!$indexExists('user_answers_archive', 'idx_user_answers_archive_history')) {
            $db->exec(
                'CREATE INDEX idx_user_answers_archive_history '
                . 'ON user_answers_archive (user_id, created_at, id)'
            );
        }
        if (!$indexExists('user_answers_archive', 'idx_user_answers_archive_question')) {
            $db->exec(
                'CREATE INDEX idx_user_answers_archive_question '
                . 'ON user_answers_archive (question_id, created_at, id)'
            );
        }
        if (!$indexExists('user_answers_archive', 'idx_user_answers_archive_batch')) {
            $db->exec(
                'CREATE INDEX idx_user_answers_archive_batch '
                . 'ON user_answers_archive (archive_batch_id, id)'
            );
        }
    }

    if ($tableExists('user_answers') && !$indexExists('user_answers', 'idx_user_answers_archive_candidates')) {
        $db->exec(
            'CREATE INDEX idx_user_answers_archive_candidates '
            . 'ON user_answers (created_at, simulation_id, id)'
        );
    }

    if ($tableExists('provas') && !$indexExists('provas', 'idx_provas_admin_keyset')) {
        $db->exec('CREATE INDEX idx_provas_admin_keyset ON provas (ano, nome, id)');
    }
    if ($tableExists('laws') && !$indexExists('laws', 'idx_laws_admin_keyset')) {
        $db->exec('CREATE INDEX idx_laws_admin_keyset ON laws (id, status)');
    }
};
