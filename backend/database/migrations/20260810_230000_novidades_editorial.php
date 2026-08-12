<?php

declare(strict_types=1);

/**
 * Cria a biblioteca editorial de novidades e o fluxo de produto das sugestoes.
 *
 * Rollback:
 * backend/database/rollbacks/20260810_230000_novidades_editorial.sql
 */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS changelogs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            version VARCHAR(64) NOT NULL,
            slug VARCHAR(190) NOT NULL,
            release_date DATE NOT NULL,
            published_at DATETIME NULL,
            title VARCHAR(180) NOT NULL,
            description VARCHAR(500) NOT NULL,
            content_json JSON NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'draft',
            created_by VARCHAR(64) NULL,
            updated_by VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_changelogs_version (version),
            UNIQUE KEY uq_changelogs_slug (slug),
            KEY idx_changelogs_publication (status, published_at, id),
            KEY idx_changelogs_updated (updated_at, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    };

    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (bool) $stmt->fetchColumn();
    };

    $changelogColumns = [
        'slug' => "VARCHAR(190) NULL AFTER version",
        'published_at' => 'DATETIME NULL AFTER release_date',
        'status' => "VARCHAR(24) NOT NULL DEFAULT 'draft' AFTER content_json",
        'created_by' => 'VARCHAR(64) NULL AFTER status',
        'updated_by' => 'VARCHAR(64) NULL AFTER created_by',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER updated_by',
        'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    ];
    foreach ($changelogColumns as $column => $definition) {
        if (!$columnExists('changelogs', $column)) {
            $db->exec("ALTER TABLE changelogs ADD COLUMN {$column} {$definition}");
        }
    }

    $db->exec(
        "UPDATE changelogs
         SET slug = COALESCE(NULLIF(slug, ''), CONCAT('novidade-', id)),
             status = CASE WHEN status IN ('draft', 'published', 'archived') THEN status ELSE 'published' END,
             published_at = CASE
                 WHEN status = 'published' THEN COALESCE(published_at, CONCAT(release_date, ' 12:00:00'))
                 ELSE published_at
             END"
    );
    $db->exec('ALTER TABLE changelogs MODIFY COLUMN slug VARCHAR(190) NOT NULL');

    if (!$indexExists('changelogs', 'uq_changelogs_slug')) {
        $db->exec('CREATE UNIQUE INDEX uq_changelogs_slug ON changelogs (slug)');
    }
    if (!$indexExists('changelogs', 'idx_changelogs_publication')) {
        $db->exec('CREATE INDEX idx_changelogs_publication ON changelogs (status, published_at, id)');
    }
    if (!$indexExists('changelogs', 'idx_changelogs_updated')) {
        $db->exec('CREATE INDEX idx_changelogs_updated ON changelogs (updated_at, id)');
    }

    $suggestionColumns = [
        'suggestion_status' => 'VARCHAR(32) NULL AFTER status',
        'suggestion_admin_note' => 'TEXT NULL AFTER suggestion_status',
        'suggestion_changelog_id' => 'BIGINT UNSIGNED NULL AFTER suggestion_admin_note',
        'suggestion_reviewed_at' => 'DATETIME NULL AFTER suggestion_changelog_id',
        'suggestion_reviewed_by' => 'VARCHAR(64) NULL AFTER suggestion_reviewed_at',
    ];
    foreach ($suggestionColumns as $column => $definition) {
        if (!$columnExists('user_feedback', $column)) {
            $db->exec("ALTER TABLE user_feedback ADD COLUMN {$column} {$definition}");
        }
    }
    $db->exec(
        "UPDATE user_feedback
         SET suggestion_status = 'pending'
         WHERE parent_id IS NULL
           AND type = 'suggestion'
           AND public_rating IS NULL
           AND suggestion_status IS NULL"
    );
    if (!$indexExists('user_feedback', 'idx_feedback_suggestion_workflow')) {
        $db->exec(
            'CREATE INDEX idx_feedback_suggestion_workflow '
            . 'ON user_feedback (type, suggestion_status, created_at, id)'
        );
    }

    $baselineContent = json_encode([
        [
            'title' => 'Estudo mais completo',
            'icon' => 'BookOpen',
            'items' => [
                'Questões, simulados e Lei Comentada reunidos em uma experiência de estudo única.',
                'Filtros e estatísticas ajudam a encontrar o conteúdo certo e acompanhar a evolução.',
            ],
        ],
        [
            'title' => 'Conta e comunidade',
            'icon' => 'Users',
            'items' => [
                'Perfil, suporte, comentários, sugestões e recursos da assinatura integrados à plataforma.',
            ],
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $seed = $db->prepare(
        "INSERT INTO changelogs (
            version, slug, release_date, published_at, title, description,
            content_json, status, created_at, updated_at
         ) VALUES (
            '1.0.0', 'concurso-mestre-1-0-0', '2026-06-05', '2026-06-05 12:00:00',
            'O ConcursoMestre está no ar',
            'A primeira versão pública reúne as principais ferramentas para organizar seus estudos e acompanhar seu desempenho.',
            :content_json, 'published', NOW(), NOW()
         )
         ON DUPLICATE KEY UPDATE id = id"
    );
    $seed->execute([':content_json' => $baselineContent]);
};
