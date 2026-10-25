<?php

declare(strict_types=1);

/**
 * Additive control-plane and occurrence metadata for cm-batch.v1 imports.
 * Canonical question content remains in the existing questions tables.
 * Foreign keys are deferred until the historical question backfill is complete;
 * unique keys and application-level identity checks remain active in the interim.
 * Data-bearing rollback is intentionally not automated; it requires an approved
 * export/retention decision before any import job records can be removed.
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
    $addColumn = static function (string $table, string $column, string $definition) use ($db, $columnExists): void {
        if ($columnExists($table, $column)) {
            return;
        }
        $db->exec('ALTER TABLE `' . $table . '` ADD COLUMN `' . $column . '` ' . $definition);
    };

    foreach (['questions', 'question_provas', 'prova_cadernos', 'provas', 'filters', 'filter_source_identities'] as $requiredTable) {
        if (!$tableExists($requiredTable)) {
            throw new RuntimeException('Tabela canonica obrigatoria ausente: ' . $requiredTable);
        }
    }

    $db->exec("CREATE TABLE IF NOT EXISTS cm_batch_identity_locks (
        identity_key CHAR(64) NOT NULL PRIMARY KEY
    ) ENGINE=InnoDB DEFAULT CHARSET=ascii COLLATE=ascii_bin");

    $db->exec("CREATE TABLE IF NOT EXISTS cm_batch_import_jobs (
        job_id CHAR(36) NOT NULL PRIMARY KEY,
        batch_id VARCHAR(190) NOT NULL,
        archive_sha256 CHAR(64) NOT NULL,
        source_provider VARCHAR(80) NOT NULL,
        dataset_label VARCHAR(255) NOT NULL,
        archive_path VARCHAR(500) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
        manifest_json JSON NOT NULL,
        dry_run_json JSON NULL,
        progress_json JSON NULL,
        actor_user_id VARCHAR(64) NOT NULL,
        approved_by_user_id VARCHAR(64) NULL,
        approved_at DATETIME NULL,
        last_error TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cm_batch_archive_sha (archive_sha256),
        KEY idx_cm_batch_job_status (status, updated_at),
        KEY idx_cm_batch_job_batch_id (batch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS cm_batch_import_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        job_id CHAR(36) NOT NULL,
        entity_type VARCHAR(40) NOT NULL,
        external_key VARCHAR(190) NOT NULL,
        content_hash CHAR(64) NULL,
        action VARCHAR(30) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'planned',
        canonical_entity_id VARCHAR(190) NULL,
        payload_json JSON NULL,
        diagnostics_json JSON NULL,
        attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
        next_attempt_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cm_batch_item (job_id, entity_type, external_key),
        KEY idx_cm_batch_item_status (job_id, status, id),
        KEY idx_cm_batch_item_content (entity_type, content_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS cm_batch_exam_source_identities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        source_provider VARCHAR(80) NOT NULL,
        source_external_id VARCHAR(190) NOT NULL,
        edition_key VARCHAR(190) NOT NULL DEFAULT '',
        exam_id INT NOT NULL,
        created_by_job_id CHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cm_batch_exam_source_identity (source_provider, source_external_id, edition_key),
        KEY idx_cm_batch_exam_source_exam (exam_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS cm_batch_taxonomy_resolutions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        job_id CHAR(36) NOT NULL,
        taxonomy_type VARCHAR(40) NOT NULL,
        provider VARCHAR(80) NOT NULL,
        external_id VARCHAR(120) NOT NULL,
        external_key VARCHAR(190) NOT NULL,
        parent_external_key VARCHAR(190) NULL,
        canonical_filter_id INT NULL,
        resolution_status VARCHAR(30) NOT NULL DEFAULT 'needs_review',
        matched_by VARCHAR(80) NULL,
        match_reason VARCHAR(255) NULL,
        decision_by_user_id VARCHAR(64) NULL,
        decided_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cm_batch_taxonomy_external (job_id, taxonomy_type, provider, external_id),
        KEY idx_cm_batch_taxonomy_canonical (canonical_filter_id),
        KEY idx_cm_batch_taxonomy_status (job_id, resolution_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS cm_batch_field_audit (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        job_id CHAR(36) NOT NULL,
        entity_type VARCHAR(40) NOT NULL,
        canonical_entity_id VARCHAR(190) NOT NULL,
        field_name VARCHAR(120) NOT NULL,
        before_json JSON NULL,
        after_json JSON NULL,
        source_evidence_json JSON NULL,
        actor_user_id VARCHAR(64) NOT NULL,
        confidence DECIMAL(5,4) NULL,
        merge_reason VARCHAR(80) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'proposed',
        rolled_back_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_cm_batch_audit_entity (entity_type, canonical_entity_id, field_name),
        KEY idx_cm_batch_audit_job (job_id, status, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if (!$tableExists('questions') || !$tableExists('question_provas') || !$tableExists('prova_cadernos')) {
        throw new RuntimeException('A infraestrutura canonica de questoes, ocorrencias e cadernos precisa existir antes do importador cm-batch.v1.');
    }
    foreach ([
        'answer_key' => 'VARCHAR(50) NULL',
        'answer_status' => 'VARCHAR(30) NULL',
        'source_page' => 'INT NULL',
        'origin' => 'VARCHAR(40) NULL',
        'created_by_job_id' => 'CHAR(36) NULL',
    ] as $column => $definition) {
        $addColumn('question_provas', $column, $definition);
    }

    $positionConflicts = (int) $db->query(
        "SELECT COUNT(*) FROM (
            SELECT prova_id, caderno_id, numero_na_prova
            FROM question_provas
            WHERE caderno_id IS NOT NULL AND numero_na_prova IS NOT NULL
            GROUP BY prova_id, caderno_id, numero_na_prova
            HAVING COUNT(*) > 1
        ) conflicting_exam_positions"
    )->fetchColumn();
    if ($positionConflicts > 0) {
        throw new RuntimeException('Existem posicoes duplicadas em cadernos; corrija o relatorio antes da migration cm-batch.');
    }
    if (!$indexExists('question_provas', 'uq_question_prova_exam_booklet_position')) {
        $db->exec(
            'CREATE UNIQUE INDEX uq_question_prova_exam_booklet_position
             ON question_provas (prova_id, caderno_id, numero_na_prova)'
        );
    }
    if ($indexExists('question_provas', 'uq_question_prova_caderno')) {
        $db->exec('ALTER TABLE question_provas DROP INDEX uq_question_prova_caderno');
    }

    $db->exec("CREATE TABLE IF NOT EXISTS question_prova_source_identities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_prova_id BIGINT UNSIGNED NOT NULL,
        source_provider VARCHAR(80) NOT NULL,
        source_exam_external_id VARCHAR(190) NOT NULL,
        source_booklet_key VARCHAR(190) NOT NULL DEFAULT '',
        source_question_external_id VARCHAR(190) NULL,
        source_version VARCHAR(120) NOT NULL DEFAULT '',
        question_number VARCHAR(80) NOT NULL,
        source_page INT NULL,
        source_reference VARCHAR(1000) NULL,
        created_by_job_id CHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_question_prova_source_position (
            source_provider, source_exam_external_id, source_booklet_key, source_version, question_number
        ),
        UNIQUE KEY uq_question_prova_source_question (
            source_provider, source_exam_external_id, source_booklet_key, source_version,
            source_question_external_id, question_number
        ),
        KEY idx_question_prova_source_occurrence (question_prova_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS question_prova_answer_history (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_prova_id BIGINT UNSIGNED NOT NULL,
        answer_snapshot_key CHAR(64) NOT NULL,
        answer_key VARCHAR(50) NULL,
        answer_status VARCHAR(30) NOT NULL,
        source_provider VARCHAR(80) NULL,
        source_reference VARCHAR(1000) NULL,
        evidence_json JSON NULL,
        created_by_job_id CHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_question_prova_answer_history (question_prova_id, created_at),
        UNIQUE KEY uq_question_prova_answer_snapshot (question_prova_id, answer_snapshot_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS question_source_identities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        source_provider VARCHAR(80) NOT NULL,
        source_external_id VARCHAR(190) NOT NULL,
        source_version VARCHAR(120) NOT NULL DEFAULT '',
        created_by_job_id CHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_question_source_identity (source_provider, source_external_id),
        KEY idx_question_source_question (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $duplicateSources = (int) $db->query(
        "SELECT COUNT(*) FROM (
            SELECT source_provider, source_external_id
            FROM questions
            WHERE source_provider IS NOT NULL AND TRIM(source_provider) <> ''
              AND source_external_id IS NOT NULL AND TRIM(source_external_id) <> ''
            GROUP BY source_provider, source_external_id
            HAVING COUNT(*) > 1
        ) duplicate_source_identities"
    )->fetchColumn();
    if ($duplicateSources > 0) {
        throw new RuntimeException('Existem identidades externas de questoes duplicadas; corrija o relatorio antes da migration cm-batch.');
    }
    $sourceMapConflicts = $db->query(
        "SELECT COUNT(*) FROM questions q
         JOIN question_source_identities source_map
           ON source_map.source_provider = q.source_provider
          AND source_map.source_external_id = q.source_external_id
         WHERE source_map.question_id <> q.id"
    );
    if ((int) $sourceMapConflicts->fetchColumn() > 0) {
        throw new RuntimeException('O mapa de identidades externas ja aponta para conteudos diferentes; corrija antes da migration cm-batch.');
    }
    $db->exec("INSERT INTO question_source_identities
        (question_id, source_provider, source_external_id, source_version)
        SELECT id, source_provider, source_external_id, ''
        FROM questions
        WHERE source_provider IS NOT NULL AND TRIM(source_provider) <> ''
          AND source_external_id IS NOT NULL AND TRIM(source_external_id) <> ''
        ON DUPLICATE KEY UPDATE question_id = VALUES(question_id)");
};
