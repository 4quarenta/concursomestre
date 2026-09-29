<?php

declare(strict_types=1);

$script = (string) file_get_contents(__DIR__ . '/../scripts/data/purge_non_admin_identities.php');

function identityPurgeAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

identityPurgeAssert(str_contains($script, "IDENTITY_PURGE_TOKEN = 'PURGE_NON_ADMIN_IDENTITIES_V1'"), 'Explicit operation token is required.');
identityPurgeAssert(str_contains($script, "IDENTITY_PURGE_PRODUCTION_ALLOWED"), 'Production environment guard is required.');
identityPurgeAssert(str_contains($script, "Exactly one active Admin is required"), 'Single active Admin guard is required.');
identityPurgeAssert(str_contains($script, "REFERENCED_TABLE_NAME = 'users'"), 'Foreign-key discovery is required.');
identityPurgeAssert(str_contains($script, "Non-admin references remain"), 'Unexpected references must fail closed.');
identityPurgeAssert(str_contains($script, 'beginTransaction()'), 'Identity purge must be transactional.');
identityPurgeAssert(str_contains($script, 'rollBack()'), 'Identity purge must roll back on failure.');
identityPurgeAssert(!str_contains($script, 'FOREIGN_KEY_CHECKS'), 'Identity purge must never disable FK checks.');
identityPurgeAssert(!str_contains($script, 'TRUNCATE'), 'Identity purge must use scoped deletion.');

fwrite(STDOUT, "Identity purge tool wiring assertions passed.\n");
