<?php

declare(strict_types=1);

/**
 * Read model e integridade para o caminho de questoes em escala.
 *
 * A migration e aditiva. O preenchimento das colunas denormalizadas e do
 * documento de busca e feito pelo backfill retomavel, fora da transaction de
 * migration, para nao manter locks longos em uma base grande.
 *
 * Rollback documentado em:
 * backend/database/rollbacks/20260717_010000_question_scale_foundation.sql
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
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $foreignKeyExists = static function (string $table, string $constraint) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND CONSTRAINT_NAME = :constraint_name
               AND CONSTRAINT_TYPE = \'FOREIGN KEY\''
        );
        $stmt->execute([':table_name' => $table, ':constraint_name' => $constraint]);
        return (int) $stmt->fetchColumn() > 0;
    };

    if ($tableExists('questions')) {
        if (!$columnExists('questions', 'published_sort_at')) {
            $db->exec('ALTER TABLE questions ADD COLUMN published_sort_at DATETIME NULL AFTER published_at');
        }
        if (!$columnExists('questions', 'has_image')) {
            $db->exec('ALTER TABLE questions ADD COLUMN has_image TINYINT(1) NOT NULL DEFAULT 0 AFTER published_sort_at');
        }
        if (!$columnExists('questions', 'has_teacher_comment')) {
            $db->exec('ALTER TABLE questions ADD COLUMN has_teacher_comment TINYINT(1) NOT NULL DEFAULT 0 AFTER has_image');
        }
        if (!$columnExists('questions', 'has_detailed_comment')) {
            $db->exec('ALTER TABLE questions ADD COLUMN has_detailed_comment TINYINT(1) NOT NULL DEFAULT 0 AFTER has_teacher_comment');
        }
        if (!$indexExists('questions', 'idx_questions_public_keyset_v2')) {
            $db->exec(
                'CREATE INDEX idx_questions_public_keyset_v2
                 ON questions (publish_status, visibility_status, published_sort_at, id)'
            );
        }
    }

    if ($tableExists('question_filters') && !$indexExists('question_filters', 'idx_question_filters_filter_question')) {
        $db->exec('CREATE INDEX idx_question_filters_filter_question ON question_filters (filter_id, question_id)');
    }
    $db->exec(
        "CREATE TABLE IF NOT EXISTS filter_types (
            code VARCHAR(40) NOT NULL PRIMARY KEY,
            label VARCHAR(120) NOT NULL,
            supports_hierarchy TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $db->exec(
        "INSERT IGNORE INTO filter_types (code, label, supports_hierarchy) VALUES
            ('banca', 'Banca', 0),
            ('orgao', 'Orgao', 0),
            ('cargo', 'Cargo', 1),
            ('assunto', 'Materia, topico e assunto', 1),
            ('ano', 'Ano', 0),
            ('carreira', 'Foco', 1),
            ('area', 'Area', 1),
            ('nivel', 'Nivel', 0),
            ('tipo_prova', 'Tipo de prova', 0),
            ('modalidade', 'Modalidade', 0)"
    );
    if ($tableExists('filters')) {
        $db->exec(
            "INSERT IGNORE INTO filter_types (code, label, supports_hierarchy)
             SELECT DISTINCT CAST(type AS CHAR(40)), CAST(type AS CHAR(120)), 0
             FROM filters
             WHERE type IS NOT NULL AND CAST(type AS CHAR(40)) <> ''"
        );
        if (!$columnExists('filters', 'description')) {
            $db->exec('ALTER TABLE filters ADD COLUMN description TEXT NULL AFTER parent_id');
        }
        if (!$columnExists('filters', 'website')) {
            $db->exec('ALTER TABLE filters ADD COLUMN website VARCHAR(1000) NULL AFTER description');
        }
        if (!$columnExists('filters', 'asset_url')) {
            $db->exec('ALTER TABLE filters ADD COLUMN asset_url VARCHAR(1000) NULL AFTER website');
        }
        if (!$columnExists('filters', 'icon_key')) {
            $db->exec('ALTER TABLE filters ADD COLUMN icon_key VARCHAR(120) NULL AFTER asset_url');
        }
        if (!$columnExists('filters', 'keywords_json')) {
            $db->exec('ALTER TABLE filters ADD COLUMN keywords_json JSON NULL AFTER icon_key');
        }
        if (!$columnExists('filters', 'meta_materia')) {
            $db->exec('ALTER TABLE filters ADD COLUMN meta_materia TINYINT(1) NOT NULL DEFAULT 0 AFTER keywords_json');
        }
        if (!$columnExists('filters', 'taxonomy_level')) {
            $db->exec('ALTER TABLE filters ADD COLUMN taxonomy_level VARCHAR(20) NULL AFTER meta_materia');
        }
        if (!$columnExists('filters', 'meta_carreira')) {
            $db->exec('ALTER TABLE filters ADD COLUMN meta_carreira TINYINT(1) NOT NULL DEFAULT 0 AFTER taxonomy_level');
        }
        if (!$indexExists('filters', 'idx_filters_type_name_id')) {
            $db->exec('CREATE INDEX idx_filters_type_name_id ON filters (type, name, id)');
        }
    }
    if ($tableExists('user_answers')) {
        if (!$columnExists('user_answers', 'selected_option_id')) {
            $db->exec('ALTER TABLE user_answers ADD COLUMN selected_option_id BIGINT UNSIGNED NULL AFTER selected_option_index');
        }
        if (!$indexExists('user_answers', 'idx_user_answers_selected_option')) {
            $db->exec('CREATE INDEX idx_user_answers_selected_option ON user_answers (selected_option_id)');
        }
        if (!$indexExists('user_answers', 'idx_user_answers_user_question_latest')) {
            $db->exec(
                'CREATE INDEX idx_user_answers_user_question_latest
                 ON user_answers (user_id, question_id, created_at, id)'
            );
        }
    }

    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_answer_idempotency (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            idempotency_key VARCHAR(120) NOT NULL,
            request_hash CHAR(64) NOT NULL,
            question_id INT NOT NULL,
            selected_option_id BIGINT UNSIGNED NULL,
            user_answer_id BIGINT NULL,
            response_json JSON NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'processing',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NULL,
            UNIQUE KEY uq_question_answer_idempotency (user_id, idempotency_key),
            INDEX idx_question_answer_idempotency_answer (user_answer_id),
            INDEX idx_question_answer_idempotency_expiry (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    if (!$columnExists('question_answer_idempotency', 'status')) {
        $db->exec(
            "ALTER TABLE question_answer_idempotency
             ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'processing' AFTER response_json"
        );
    }

    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_search_documents (
            question_id INT NOT NULL PRIMARY KEY,
            statement_text MEDIUMTEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FULLTEXT KEY ft_question_search_statement (statement_text)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS filter_aliases (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            filter_id INT NOT NULL,
            alias VARCHAR(255) NOT NULL,
            normalized_alias VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_filter_alias (filter_id, normalized_alias),
            INDEX idx_filter_alias_lookup (normalized_alias),
            INDEX idx_filter_alias_filter (filter_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if ($tableExists('user_answers') && $tableExists('question_options')
        && !$foreignKeyExists('user_answers', 'fk_user_answers_selected_option')) {
        $db->exec(
            'ALTER TABLE user_answers
             ADD CONSTRAINT fk_user_answers_selected_option
             FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL'
        );
    }
    if ($tableExists('questions')
        && !$foreignKeyExists('question_search_documents', 'fk_question_search_documents_question')) {
        $db->exec(
            'ALTER TABLE question_search_documents
             ADD CONSTRAINT fk_question_search_documents_question
             FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE'
        );
    }
    if ($tableExists('filters')
        && !$foreignKeyExists('filter_aliases', 'fk_filter_aliases_filter')) {
        $db->exec(
            'ALTER TABLE filter_aliases
             ADD CONSTRAINT fk_filter_aliases_filter
             FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE'
        );
    }
    if ($tableExists('questions')
        && !$foreignKeyExists('question_answer_idempotency', 'fk_question_answer_idempotency_question')) {
        $db->exec(
            'ALTER TABLE question_answer_idempotency
             ADD CONSTRAINT fk_question_answer_idempotency_question
             FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE'
        );
    }
    if ($tableExists('question_options')
        && !$foreignKeyExists('question_answer_idempotency', 'fk_question_answer_idempotency_option')) {
        $db->exec(
            'ALTER TABLE question_answer_idempotency
             ADD CONSTRAINT fk_question_answer_idempotency_option
             FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL'
        );
    }
    if ($tableExists('user_answers')
        && !$foreignKeyExists('question_answer_idempotency', 'fk_question_answer_idempotency_answer')) {
        $db->exec(
            'ALTER TABLE question_answer_idempotency
             ADD CONSTRAINT fk_question_answer_idempotency_answer
             FOREIGN KEY (user_answer_id) REFERENCES user_answers(id) ON DELETE CASCADE'
        );
    }
};
