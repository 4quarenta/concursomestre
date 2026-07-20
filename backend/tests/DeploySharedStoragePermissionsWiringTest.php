<?php

declare(strict_types=1);

function assertDeployStorage(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$script = file_get_contents(dirname(__DIR__, 2) . '/scripts/deploy/deploy-release.sh');
assertDeployStorage(is_string($script), 'deploy-release.sh must be readable.');
assertDeployStorage(
    str_contains($script, 'chown root:"$CM_APP_GROUP" "$CM_SHARED_DIR/backend/storage" "$CM_SHARED_DIR/backend/uploads"'),
    'Deploy must restore the application group on existing shared directories.'
);
assertDeployStorage(
    str_contains($script, 'chmod 2770 "$CM_SHARED_DIR/backend/storage" "$CM_SHARED_DIR/backend/uploads"'),
    'Deploy must keep shared directories writable and setgid for the application group.'
);

fwrite(STDOUT, "Deploy shared storage permission wiring assertions passed.\n");
