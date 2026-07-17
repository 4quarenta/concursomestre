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

function assertContainsBackupMysql(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$script = $base . '/scripts/tasks/backup_mysql.php';
$verifyScript = $base . '/scripts/tasks/verify_mysql_backup.php';
$restoreScript = $base . '/scripts/tasks/restore_mysql_backup.php';
$rehearsalScript = $base . '/scripts/tasks/backup_restore_rehearsal.php';

assertContainsBackupMysql(
    $script,
    '--single-transaction --quick --routines --triggers --events --default-character-set=utf8mb4',
    'Backup must use production-safe mysqldump flags'
);

assertContainsBackupMysql(
    $script,
    'backupCreateDefaultsFile',
    'Backup must avoid passing the password directly in the command line'
);

assertContainsBackupMysql(
    $script,
    'hash_file(\'sha256\', $backupPath)',
    'Backup must write a sha256 checksum for restore verification'
);

assertContainsBackupMysql(
    $script,
    'BACKUP_RETENTION_DAYS',
    'Backup must support retention cleanup'
);

assertContainsBackupMysql(
    $script,
    'MYSQL_BACKUP_HEALTH_PATH',
    'Backup must write an operational health heartbeat for production preflight'
);

assertContainsBackupMysql(
    $script,
    'backupWriteHealth',
    'Backup must centralize success/error heartbeat writes'
);

assertContainsBackupMysql(
    $script,
    'exit(2)',
    'Backup script must fail non-zero on operational errors'
);

assertContainsBackupMysql(
    $verifyScript,
    'Checksum do backup nao confere.',
    'Backup verifier must fail when checksum mismatches'
);

assertContainsBackupMysql(
    $verifyScript,
    'Arquivo nao parece ser um dump SQL MySQL/MariaDB.',
    'Backup verifier must validate that the file looks like a MySQL dump'
);

assertContainsBackupMysql(
    $restoreScript,
    '--execute=RESTORE_BACKUP',
    'Restore script must default to dry-run and require an explicit execution token'
);

assertContainsBackupMysql(
    $restoreScript,
    'RESTORE_CURRENT_DATABASE',
    'Restore script must block restoring over the current configured database by default'
);

assertContainsBackupMysql(
    $restoreScript,
    'DROP_TARGET_DATABASE',
    'Restore script must require an explicit token before dropping a target restore database'
);

assertContainsBackupMysql(
    $restoreScript,
    'restoreCreateDefaultsFile',
    'Restore script must avoid passing the password directly in the command line'
);

assertContainsBackupMysql(
    $restoreScript,
    'DROP DATABASE',
    'Restore script must scan dumps for destructive database-level statements'
);

assertContainsBackupMysql(
    $rehearsalScript,
    'verify_mysql_backup.php',
    'Backup restore rehearsal must validate the dump before any restore dry-run'
);

assertContainsBackupMysql(
    $rehearsalScript,
    'restore_mysql_backup.php',
    'Backup restore rehearsal must reuse the official restore script'
);

assertContainsBackupMysql(
    $rehearsalScript,
    'restore_dry_run',
    'Backup restore rehearsal must report the restore dry-run result'
);

assertContainsBackupMysql(
    $rehearsalScript,
    'RESTORE_TARGET_DB',
    'Backup restore rehearsal must target a restore database instead of production'
);

assertContainsBackupMysql(
    $rehearsalScript,
    'MYSQL_BACKUP_HEALTH_PATH',
    'Backup restore rehearsal must be able to use the latest backup heartbeat'
);

fwrite(STDOUT, "Backup MySQL wiring assertions passed.\n");
