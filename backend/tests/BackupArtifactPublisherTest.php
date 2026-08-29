<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/database/BackupArtifactPublisher.php';

$root = sys_get_temp_dir() . '/cm-backup-artifacts-' . bin2hex(random_bytes(5));
mkdir($root, 0700, true);

try {
    $final = $root . '/backup.sql';
    BackupArtifactPublisher::writeAtomic($final, "-- MySQL dump\nCREATE TABLE sample (id INT);\n");
    if (!is_file($final) || is_file($root . '/.backup.sql.partial')) {
        throw new RuntimeException('Backup final atomic publication failed.');
    }
    BackupArtifactPublisher::writeAtomic($final, "-- MySQL dump\nCREATE TABLE replacement (id INT);\n");
    if (!str_contains((string) file_get_contents($final), 'replacement')) {
        throw new RuntimeException('Atomic replacement of mutable artifact failed.');
    }

    $checksum = hash_file('sha256', $final);
    if (!is_string($checksum)) {
        throw new RuntimeException('Could not hash test backup.');
    }
    $checksumPath = BackupArtifactPublisher::writeChecksum($final, $checksum);
    $manifestPath = BackupArtifactPublisher::writeManifest($final, [
        'format_version' => 1,
        'database' => 'rehearsal_only',
        'dump_size' => filesize($final),
        'dump_sha256' => $checksum,
    ]);
    if (!is_file($checksumPath) || !is_file($manifestPath)) {
        throw new RuntimeException('Backup metadata publication failed.');
    }

    try {
        BackupArtifactPublisher::publish($root . '/missing.partial', $root . '/never.sql');
        throw new RuntimeException('Missing temporary artifact was accepted.');
    } catch (RuntimeException $expected) {
        if (!str_contains($expected->getMessage(), 'ausente')) {
            throw $expected;
        }
    }
} finally {
    foreach (glob($root . '/*') ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($root);
}

fwrite(STDOUT, "BackupArtifactPublisherTest: PASS\n");
