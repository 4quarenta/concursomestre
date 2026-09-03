<?php

declare(strict_types=1);

/**
 * Rebuilds the sitemap revision triggers with the migration principal as the
 * definer. The runtime principal must be able to mutate public entities
 * without receiving the DDL-level TRIGGER privilege.
 */
return static function (PDO $db): void {
    $grants = $db->query('SHOW GRANTS FOR CURRENT_USER')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $normalizedGrants = strtoupper(implode("\n", array_map('strval', $grants)));
    $hasTriggerPrivilege = str_contains($normalizedGrants, 'TRIGGER')
        || str_contains($normalizedGrants, 'ALL PRIVILEGES');
    $hasRevisionUpdatePrivilege = str_contains($normalizedGrants, 'UPDATE')
        || str_contains($normalizedGrants, 'ALL PRIVILEGES');

    if (!$hasTriggerPrivilege || !$hasRevisionUpdatePrivilege) {
        throw new RuntimeException(
            'O principal de migration precisa de TRIGGER no schema e UPDATE em seo_dataset_revisions para reparar os definers.'
        );
    }

    $tables = [
        'blog_articles',
        'contest_organizations',
        'contests',
        'filters',
        'law_articles',
        'laws',
        'material_uploads',
        'materials',
        'provas',
        'public_simulation_questions',
        'public_simulations',
        'questions',
    ];
    $tableExists = static function (string $table) use ($db): bool {
        $statement = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $statement->execute([':table_name' => $table]);
        return (int) $statement->fetchColumn() > 0;
    };

    foreach ($tables as $table) {
        if (!$tableExists($table)) {
            continue;
        }
        foreach (['ai' => 'INSERT', 'au' => 'UPDATE', 'ad' => 'DELETE'] as $suffix => $event) {
            $trigger = 'trg_sitemap_revision_' . $table . '_' . $suffix;
            $db->exec("DROP TRIGGER IF EXISTS `{$trigger}`");
            $db->exec(
                "CREATE DEFINER = CURRENT_USER TRIGGER `{$trigger}` AFTER {$event} ON `{$table}` FOR EACH ROW "
                . 'UPDATE seo_dataset_revisions '
                . 'SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP(6) WHERE id = 1'
            );
        }
    }
};
