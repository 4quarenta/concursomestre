<?php

declare(strict_types=1);

function systemdManagerAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$manager = (string) file_get_contents(__DIR__ . '/../scripts/data/manage_writer_systemd_freeze.php');
$policy = (string) file_get_contents(__DIR__ . '/../scripts/data/DatasetWriterSystemdFreezePolicy.php');

foreach (['DATASET_WRITER_FREEZE_OPERATION_ALLOWED', 'DATASET_WRITER_FREEZE_PRODUCTION_ALLOWED', 'DISPOSABLE_REHEARSAL', 'Stale freeze state exists', 'Stale runtime mask exists', 'Stale runtime drop-in exists', 'daemon-reload', 'RefuseManualStart', 'Restart', 'DropInPaths', 'systemd-run', 'dependencyAttackTests', 'FREEZE_FAILED_RECOVERED', 'idempotent'] as $required) {
    systemdManagerAssert(str_contains($manager, $required), 'Systemd freeze manager guard missing: ' . $required);
}
systemdManagerAssert(!str_contains($manager, 'set-property'), 'The unsupported runtime set-property mechanism must not remain in the manager.');
systemdManagerAssert(!str_contains($manager, 'mask --runtime'), 'Runtime mask is not the selected mechanism for local /etc units.');
systemdManagerAssert(str_contains($policy, "RUNTIME_ROOT = '/run/"), 'Freeze state must be runtime-only.');
systemdManagerAssert(str_contains($policy, 'ConditionPathExists='), 'Dependency activation suppression must be explicit.');
systemdManagerAssert(str_contains($policy, 'Restart=no'), 'Autorestart suppression must be explicit.');

fwrite(STDOUT, "Systemd writer freeze manager wiring assertions passed.\n");
