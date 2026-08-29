<?php

declare(strict_types=1);

$runner = (string) file_get_contents(__DIR__ . '/../shared/database/SchemaMigrationRunner.php');
$cli = (string) file_get_contents(__DIR__ . '/../scripts/migrations/run_schema_migrations.php');

foreach ([
    'public function audit()',
    'APPLIED_WITHOUT_DISCOVERED_FILE',
    'DISCOVERED_WITHOUT_APPLIED_ROW',
    'CHECKSUM_DRIFT',
    'DUPLICATE_LOGICAL_IDENTITY',
    'AMBIGUOUS_PREFIX',
    'OUT_OF_ORDER_HISTORY',
    'IGNORED_MANUAL_SQL',
    'legacy_aliases_matched',
] as $needle) {
    if (!str_contains($runner, $needle)) {
        throw new RuntimeException('Migration audit contract missing: ' . $needle);
    }
}
if (!str_contains($cli, "isset(\$options['audit'])")) {
    throw new RuntimeException('Migration CLI does not expose the read-only audit action.');
}

fwrite(STDOUT, "SchemaMigrationAuditTest: PASS\n");
