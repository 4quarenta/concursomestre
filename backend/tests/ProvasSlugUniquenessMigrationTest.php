<?php

declare(strict_types=1);

$migration = (string) file_get_contents(__DIR__ . '/../database/migrations/20260829_120000_provas_slug_uniqueness.php');
$rollback = (string) file_get_contents(__DIR__ . '/../database/rollbacks/20260829_120000_provas_slug_uniqueness.sql');
$schema = (string) file_get_contents(__DIR__ . '/../database/schema.sql');

foreach ([
    'CREATE UNIQUE INDEX uq_provas_slug ON provas (slug)',
    'GROUP BY slug',
    'Nenhuma linha foi alterada',
    'LIMIT 1',
] as $needle) {
    if (!str_contains($migration, $needle)) {
        throw new RuntimeException('Slug migration safety contract missing: ' . $needle);
    }
}
if (!str_contains($rollback, 'DROP INDEX uq_provas_slug ON provas')) {
    throw new RuntimeException('Slug migration rollback is not scoped to its own index.');
}
if (!str_contains($schema, 'UNIQUE KEY uq_provas_slug (slug)')) {
    throw new RuntimeException('Canonical schema does not declare the slug uniqueness contract.');
}
$usersBlock = preg_match('/CREATE TABLE IF NOT EXISTS users \\((.*?)\n\\);/s', $schema, $usersMatch) === 1
    ? (string) $usersMatch[1]
    : '';
if (str_contains($usersBlock, 'uq_provas_slug')) {
    throw new RuntimeException('Slug uniqueness contract was attached to users instead of provas.');
}

fwrite(STDOUT, "ProvasSlugUniquenessMigrationTest: PASS\n");
