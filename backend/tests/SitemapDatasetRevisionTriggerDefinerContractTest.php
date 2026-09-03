<?php

declare(strict_types=1);

function sitemapTriggerDefinerAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$migration = (string) file_get_contents(
    __DIR__ . '/../database/migrations/20260903_120000_sitemap_dataset_revision_trigger_definer.php'
);

sitemapTriggerDefinerAssert(
    str_contains($migration, 'SHOW GRANTS FOR CURRENT_USER'),
    'Trigger definer repair must verify the migration principal before DDL.'
);
sitemapTriggerDefinerAssert(
    str_contains($migration, 'TRIGGER') && str_contains($migration, 'UPDATE'),
    'Trigger definer repair must fail closed without the required migration capabilities.'
);
sitemapTriggerDefinerAssert(
    str_contains($migration, 'CREATE DEFINER = CURRENT_USER TRIGGER'),
    'Sitemap revision triggers must run under the migration principal, never the runtime principal.'
);
sitemapTriggerDefinerAssert(
    str_contains($migration, 'DROP TRIGGER IF EXISTS'),
    'The repair migration must replace the incompatible existing trigger definitions.'
);

$expectedTables = [
    'blog_articles', 'contest_organizations', 'contests', 'filters', 'law_articles', 'laws',
    'material_uploads', 'materials', 'provas', 'public_simulation_questions', 'public_simulations', 'questions',
];
foreach ($expectedTables as $table) {
    sitemapTriggerDefinerAssert(
        str_contains($migration, "'{$table}'"),
        'Trigger definer repair omits sitemap source table: ' . $table
    );
}
foreach (['INSERT', 'UPDATE', 'DELETE'] as $event) {
    sitemapTriggerDefinerAssert(
        str_contains($migration, "'{$event}'"),
        'Trigger definer repair omits mutation event: ' . $event
    );
}

fwrite(STDOUT, "SitemapDatasetRevisionTriggerDefinerContractTest: PASS\n");
