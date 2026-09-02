<?php

declare(strict_types=1);

/**
 * Extracts the replication anchor emitted by mysqldump from the same
 * consistent snapshot as the dump itself.
 */
final class BackupPitrAnchor
{
    /** @return array{binlog_file:string,binlog_position:int,gtid_purged:?string} */
    public static function fromDump(string $path): array
    {
        if (!is_file($path) || !is_readable($path)) {
            throw new RuntimeException('Dump indisponivel para extracao da ancora PITR.');
        }

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Nao foi possivel ler o dump para extracao da ancora PITR.');
        }

        $anchor = null;
        $gtidPurged = null;
        try {
            while (($line = fgets($handle)) !== false) {
                if ($gtidPurged === null
                    && preg_match('/SET @@GLOBAL\.GTID_PURGED\s*=\s*([^;]+);/i', $line, $matches) === 1) {
                    $gtidPurged = trim($matches[1], " '\"\r\n");
                }

                if (preg_match(
                    '/(?:CHANGE REPLICATION SOURCE TO|CHANGE MASTER TO).*?(?:SOURCE|MASTER)_LOG_FILE\s*=\s*[\'\"]([^\'\"]+)[\'\"].*?(?:SOURCE|MASTER)_LOG_POS\s*=\s*(\d+)/i',
                    $line,
                    $matches
                ) !== 1) {
                    continue;
                }

                $candidate = [
                    'binlog_file' => (string) $matches[1],
                    'binlog_position' => (int) $matches[2],
                    'gtid_purged' => $gtidPurged,
                ];
                if ($candidate['binlog_position'] <= 0 || preg_match('/^[A-Za-z0-9_.-]+$/', $candidate['binlog_file']) !== 1) {
                    throw new RuntimeException('Ancora PITR invalida no dump.');
                }
                $anchor = $candidate;
                break;
            }
        } finally {
            fclose($handle);
        }

        if ($anchor === null) {
            throw new RuntimeException('mysqldump nao emitiu uma ancora PITR no mesmo snapshot.');
        }

        return $anchor;
    }
}
