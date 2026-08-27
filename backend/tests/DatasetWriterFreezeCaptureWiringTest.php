<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function freezeCaptureAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$capture = (string) file_get_contents(__DIR__ . '/../scripts/data/capture_writer_freeze_evidence.php');
$sentinel = (string) file_get_contents(__DIR__ . '/../scripts/data/capture_write_sentinel.php');
$reset = (string) file_get_contents(__DIR__ . '/../scripts/data/reset_definitive_dataset.php');

foreach (['DATASET_WRITER_FREEZE_REHEARSAL_SHA256', 'DATASET_RESET_FREEZE_EVIDENCE_KEY', 'freeze-state', 'validateState', 'RefuseManualStart', 'DropInPaths', 'runtimeMask', 'bootId', 'systemdVersion', 'suppressionMechanismVersion', 'pgrep -af', 'mysql|mariadb', 'ss -Hntp state established', 'ss -Hxnp state connected', 'approved-rehearsal', 'writerInventoryHash', 'globalFingerprint', 'targetSnapshotFingerprint', 'hostFingerprint'] as $required) {
    freezeCaptureAssert(str_contains($capture, $required), 'Operational freeze capture guard missing: ' . $required);
}
freezeCaptureAssert(str_contains($capture, "^u_str.*(mysql|mysqld|mariadb)"), 'Unix database session scan must ignore the mysqld systemd datagram socket.');
freezeCaptureAssert(str_contains($capture, 'DatasetWriterSystemdFreezePolicy::units()'), 'Capture must derive the complete unit inventory from policy.');
freezeCaptureAssert(!str_contains($capture, 'freeze-ok'), 'Operational capture must not accept a manual freeze boolean.');
freezeCaptureAssert(str_contains($sentinel, 'DB_READ_HOST') && str_contains($sentinel, 'SHOW GRANTS FOR CURRENT_USER'), 'Sentinel must require and verify read-only credentials.');
freezeCaptureAssert(str_contains($sentinel, 'DatasetResetReadinessReporter') && str_contains($sentinel, 'targetSnapshotFingerprint'), 'Sentinel must bind evidence to the observed reset snapshot.');
freezeCaptureAssert(str_contains($sentinel, "SET time_zone = '-03:00'") && str_contains($reset, "SET time_zone = '-03:00'"), 'Sentinel and reset must normalize the snapshot session to the same timezone.');
freezeCaptureAssert(str_contains($capture, 'validateObservationBinding'), 'Operational capture must use the behaviorally tested target binding contract.');
freezeCaptureAssert(!preg_match('/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\s+(?:INTO|FROM|TABLE|DATABASE|VIEW)?\s*`?[A-Za-z_]/i', $sentinel), 'Sentinel contains executable database mutation SQL.');
freezeCaptureAssert(str_contains($reset, 'freeze-evidence') && str_contains($reset, 'freeze-run-id'), 'Reset must consume machine evidence and run ID.');
freezeCaptureAssert(!str_contains($reset, 'freeze-ok'), 'Reset must not accept a manual freeze boolean.');

fwrite(STDOUT, "Operational writer freeze capture wiring assertions passed.\n");
