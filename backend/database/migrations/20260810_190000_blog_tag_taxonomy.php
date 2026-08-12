<?php

declare(strict_types=1);

/**
 * Promove tags do blog a taxonomias editoriais navegaveis.
 *
 * Rollback:
 * backend/database/rollbacks/20260810_190000_blog_tag_taxonomy.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name LIMIT 1'
        );
        $stmt->execute([':table_name' => 'blog_tags', ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    };
    $indexExists = static function (string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name LIMIT 1'
        );
        $stmt->execute([':table_name' => 'blog_tags', ':index_name' => $index]);
        return (bool) $stmt->fetchColumn();
    };

    $columns = [
        'kind' => "VARCHAR(32) NOT NULL DEFAULT 'general' AFTER slug",
        'description' => 'VARCHAR(500) NULL AFTER kind',
        'image_url' => 'VARCHAR(1000) NULL AFTER description',
        'seo_title' => 'VARCHAR(180) NULL AFTER image_url',
        'seo_description' => 'VARCHAR(320) NULL AFTER seo_title',
        'created_by' => 'VARCHAR(64) NULL AFTER seo_description',
        'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    ];
    foreach ($columns as $name => $definition) {
        if (!$columnExists($name)) {
            $db->exec("ALTER TABLE blog_tags ADD COLUMN {$name} {$definition}");
        }
    }

    if (!$indexExists('idx_blog_tags_kind_name')) {
        $db->exec('CREATE INDEX idx_blog_tags_kind_name ON blog_tags (kind, name, id)');
    }

    $regionSlugs = [
        'norte',
        'nordeste',
        'centro-oeste',
        'sudeste',
        'sul',
    ];
    $stateSlugs = [
        'acre', 'ac', 'alagoas', 'al', 'amapa', 'ap', 'amazonas', 'am',
        'bahia', 'ba', 'ceara', 'ce', 'distrito-federal', 'df',
        'espirito-santo', 'es', 'goias', 'go', 'maranhao', 'ma',
        'mato-grosso', 'mt', 'mato-grosso-do-sul', 'ms', 'minas-gerais', 'mg',
        'para', 'pa', 'paraiba', 'pb', 'parana', 'pr', 'pernambuco', 'pe',
        'piaui', 'pi', 'rio-de-janeiro', 'rj', 'rio-grande-do-norte', 'rn',
        'rio-grande-do-sul', 'rs', 'rondonia', 'ro', 'roraima', 'rr',
        'santa-catarina', 'sc', 'sao-paulo', 'sp', 'sergipe', 'se',
        'tocantins', 'to',
    ];
    $updateKinds = static function (string $kind, array $slugs) use ($db): void {
        $placeholders = implode(', ', array_fill(0, count($slugs), '?'));
        $stmt = $db->prepare("UPDATE blog_tags SET kind = ? WHERE slug IN ({$placeholders})");
        $stmt->execute([$kind, ...$slugs]);
    };
    $updateKinds('region', $regionSlugs);
    $updateKinds('state', $stateSlugs);
};
