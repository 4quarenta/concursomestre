<?php

declare(strict_types=1);

/**
 * Additive compatibility columns required by the canonical aggregate.
 * Existing values are preserved. No data is deleted or rewritten here.
 */
return static function (PDO $db): void {
    $quote = static function (string $identifier): string {
        if (preg_match('/^[a-z0-9_]+$/i', $identifier) !== 1) {
            throw new InvalidArgumentException('Identificador de schema invalido.');
        }
        return chr(96) . $identifier . chr(96);
    };
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
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
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
    $addColumn = static function (string $table, string $column, string $definition) use ($db, $quote, $tableExists, $columnExists): void {
        if ($tableExists($table) && !$columnExists($table, $column)) {
            $db->exec('ALTER TABLE ' . $quote($table) . ' ADD COLUMN ' . $quote($column) . ' ' . $definition);
        }
    };
    $addIndex = static function (string $table, string $index, string $columns) use ($db, $quote, $tableExists, $indexExists): void {
        if ($tableExists($table) && !$indexExists($table, $index)) {
            $db->exec('CREATE INDEX ' . $quote($index) . ' ON ' . $quote($table) . ' (' . $columns . ')');
        }
    };

    $db->exec("CREATE TABLE IF NOT EXISTS questions_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enunciado LONGTEXT NULL,
        enunciado_clean LONGTEXT NULL,
        texto LONGTEXT NULL,
        image_url VARCHAR(500) NULL,
        assets_json LONGTEXT NULL,
        created_by_user_id VARCHAR(64) NULL,
        updated_by_user_id VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS provas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        ano INT NULL,
        banca_id INT NULL,
        orgao_id INT NULL,
        cargo_id INT NULL,
        nivel_id INT NULL,
        tipo_prova_id INT NULL,
        carreira_id INT NULL,
        pdf_url VARCHAR(500) NULL,
        metadata_json JSON NULL,
        created_by_user_id VARCHAR(64) NULL,
        updated_by_user_id VARCHAR(64) NULL,
        published_by_user_id VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_provas_slug_ano (slug, ano),
        INDEX idx_provas_banca_ano (banca_id, ano)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_filters (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prova_id INT NOT NULL,
        filter_id INT NOT NULL,
        role VARCHAR(40) NULL,
        context_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_prova_filter_role (prova_id, filter_id, role),
        INDEX idx_prova_filters_prova (prova_id),
        INDEX idx_prova_filters_filter (filter_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_cargo_detalhes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prova_id INT NOT NULL,
        cargo_filter_id INT NULL,
        nome VARCHAR(255) NOT NULL,
        remuneracao VARCHAR(255) NULL,
        carga_horaria VARCHAR(120) NULL,
        escolaridade VARCHAR(180) NULL,
        metadata_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prova_cargo_detalhes_prova (prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_cargo_requisitos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prova_id INT NOT NULL,
        cargo_detalhe_id BIGINT UNSIGNED NULL,
        requisito TEXT NOT NULL,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_prova_cargo_requisitos_prova (prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_cargo_vagas (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prova_id INT NOT NULL,
        cargo_detalhe_id BIGINT UNSIGNED NULL,
        ampla INT NOT NULL DEFAULT 0,
        pcd INT NOT NULL DEFAULT 0,
        cotas INT NOT NULL DEFAULT 0,
        cadastro_reserva INT NOT NULL DEFAULT 0,
        descricao VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_prova_cargo_vagas_prova (prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_cadernos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prova_id INT NOT NULL,
        nome VARCHAR(180) NOT NULL,
        tipo VARCHAR(80) NULL,
        cor VARCHAR(80) NULL,
        ordem INT NOT NULL DEFAULT 0,
        metadata_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_prova_caderno_nome (prova_id, nome),
        INDEX idx_prova_cadernos_prova (prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_caderno_cargos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        caderno_id BIGINT UNSIGNED NOT NULL,
        cargo_filter_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_caderno_cargo (caderno_id, cargo_filter_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_caderno_filters (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        caderno_id BIGINT UNSIGNED NOT NULL,
        filter_id INT NOT NULL,
        role VARCHAR(40) NULL,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_caderno_filter_role (caderno_id, filter_id, role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_arquivos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prova_id INT NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        nome_original VARCHAR(255) NOT NULL,
        caminho VARCHAR(500) NOT NULL,
        mime_type VARCHAR(120) NULL,
        tamanho BIGINT UNSIGNED NULL,
        versao INT NOT NULL DEFAULT 1,
        visibility_status VARCHAR(30) NOT NULL DEFAULT 'public',
        uploaded_by_user_id VARCHAR(64) NULL,
        metadata_json JSON NULL,
        archived_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prova_arquivos_prova (prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS question_provas (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        prova_id INT NOT NULL,
        caderno_id BIGINT UNSIGNED NULL,
        numero_na_prova INT NULL,
        metadata_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_question_prova_caderno (question_id, prova_id, caderno_id),
        INDEX idx_question_provas_question (question_id),
        INDEX idx_question_provas_prova (prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS prova_extracoes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prova_id INT NULL,
        arquivo_id BIGINT UNSIGNED NULL,
        origem VARCHAR(20) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        parser_profile VARCHAR(80) NULL,
        extracted_json JSON NULL,
        review_json JSON NULL,
        error_message TEXT NULL,
        created_by VARCHAR(64) NULL,
        reviewed_by VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prova_extracoes_prova (prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    foreach ([
        'reference_text' => 'MEDIUMTEXT NULL',
        'publish_status' => "VARCHAR(30) NOT NULL DEFAULT 'published'",
        'visibility_status' => "VARCHAR(30) NOT NULL DEFAULT 'public'",
        'scheduled_at' => 'DATETIME NULL',
        'published_at' => 'DATETIME NULL',
        'source_exam_key' => 'VARCHAR(191) NULL',
        'source_question_number' => 'VARCHAR(80) NULL',
        'source_page' => 'INT NULL',
        'import_fingerprint' => 'CHAR(64) NULL',
        'question_origin' => 'VARCHAR(40) NULL',
        'figure_description' => 'MEDIUMTEXT NULL',
        'support_context_key' => 'VARCHAR(120) NULL',
        'created_by_user_id' => 'VARCHAR(64) NULL',
        'updated_by_user_id' => 'VARCHAR(64) NULL',
        'published_by_user_id' => 'VARCHAR(64) NULL',
    ] as $column => $definition) {
        $addColumn('questions', $column, $definition);
    }

    foreach ([
        ['questions', 'idx_questions_import_fingerprint', 'import_fingerprint'],
        ['questions', 'idx_questions_source_exam_number', 'source_exam_key, source_question_number'],
        ['questions', 'idx_questions_publication', 'publish_status, visibility_status, published_at'],
        ['questions', 'idx_questions_group', 'grupo_questao_id'],
        ['questions', 'idx_questions_prova', 'prova_id'],
    ] as [$table, $index, $columns]) {
        $addIndex($table, $index, $columns);
    }

    foreach ([
        'titulo_oficial' => 'VARCHAR(255) NULL',
        'nome_curto' => 'VARCHAR(180) NULL',
        'edital_numero' => 'VARCHAR(80) NULL',
        'metadata_json' => 'JSON NULL',
        'carreira_id' => 'INT NULL',
        'area_id' => 'INT NULL',
        'inscricoes_inicio' => 'DATETIME NULL',
        'inscricoes_fim' => 'DATETIME NULL',
        'data_prova' => 'DATETIME NULL',
        'resultado_data' => 'DATETIME NULL',
        'vagas_total' => 'INT NULL',
        'cadastro_reserva_total' => 'INT NULL',
        'url_oficial' => 'VARCHAR(500) NULL',
        'status_editorial' => "VARCHAR(30) NOT NULL DEFAULT 'draft'",
        'visibility_status' => "VARCHAR(30) NOT NULL DEFAULT 'public'",
        'scheduled_at' => 'DATETIME NULL',
        'archived_at' => 'DATETIME NULL',
    ] as $column => $definition) {
        $addColumn('provas', $column, $definition);
    }

    foreach ([
        'assets_json' => 'JSON NULL',
        'created_by_user_id' => 'VARCHAR(64) NULL',
        'updated_by_user_id' => 'VARCHAR(64) NULL',
        'created_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'updated_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ] as $column => $definition) {
        $addColumn('questions_groups', $column, $definition);
    }

    foreach ([
        'pdf_url' => 'VARCHAR(500) NULL',
        'created_by_user_id' => 'VARCHAR(64) NULL',
        'updated_by_user_id' => 'VARCHAR(64) NULL',
        'published_by_user_id' => 'VARCHAR(64) NULL',
    ] as $column => $definition) {
        $addColumn('provas', $column, $definition);
    }

    foreach ([
        ['user_streaks', "CREATE TABLE IF NOT EXISTS user_streaks (
            user_id VARCHAR(64) PRIMARY KEY,
            current_streak INT NOT NULL DEFAULT 0,
            longest_streak INT NOT NULL DEFAULT 0,
            last_activity_date DATE NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_streaks_last_activity (last_activity_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"],
        ['user_badges', "CREATE TABLE IF NOT EXISTS user_badges (
            user_id VARCHAR(64) NOT NULL,
            badge_key VARCHAR(80) NOT NULL,
            title VARCHAR(160) NOT NULL,
            description VARCHAR(255) NULL,
            awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, badge_key),
            INDEX idx_user_badges_awarded_at (awarded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"],
    ] as [, $sql]) {
        $db->exec($sql);
    }
};
