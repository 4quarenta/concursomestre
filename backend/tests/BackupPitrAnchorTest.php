<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/database/BackupPitrAnchor.php';

$path = tempnam(sys_get_temp_dir(), 'cm-pitr-');
if ($path === false) {
    throw new RuntimeException('Nao foi possivel criar fixture temporaria.');
}

try {
    file_put_contents($path, "-- CHANGE REPLICATION SOURCE TO SOURCE_LOG_FILE='binlog.000017', SOURCE_LOG_POS=481;\nSET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ 'uuid:1-42';\n");
    $anchor = BackupPitrAnchor::fromDump($path);
    if ($anchor['binlog_file'] !== 'binlog.000017' || $anchor['binlog_position'] !== 481) {
        throw new RuntimeException('Ancora moderna nao foi extraida corretamente.');
    }

    file_put_contents($path, "-- CHANGE MASTER TO MASTER_LOG_FILE='mysql-bin.000003', MASTER_LOG_POS=99;\n");
    $legacyAnchor = BackupPitrAnchor::fromDump($path);
    if ($legacyAnchor['binlog_file'] !== 'mysql-bin.000003' || $legacyAnchor['binlog_position'] !== 99) {
        throw new RuntimeException('Ancora legada nao foi extraida corretamente.');
    }

    file_put_contents($path, "-- dump without source position\n");
    try {
        BackupPitrAnchor::fromDump($path);
        throw new RuntimeException('Dump sem ancora deveria falhar fechado.');
    } catch (RuntimeException $exception) {
        if (!str_contains($exception->getMessage(), 'ancora PITR')) {
            throw $exception;
        }
    }
} finally {
    @unlink($path);
}

fwrite(STDOUT, "Backup PITR anchor assertions passed.\n");
