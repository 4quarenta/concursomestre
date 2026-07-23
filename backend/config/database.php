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

// config/database.php
require_once __DIR__ . '/env.php';

class Database {
    // Default XAMPP settings
    private $host = "localhost";
    private $port = "";
    private $db_name = "concursomestre";
    private $username = "root";
    private $password = "";
    private int $timeoutSeconds = 5;
    private bool $persistent = false;
    private string $role = 'write';
    private bool $usingReplica = false;
    public $conn;

    public function __construct(string $role = 'write') {
        $this->role = strtolower(trim($role)) === 'read' ? 'read' : 'write';
        $this->host = $this->readEnv('DB_HOST', $this->host);
        $this->port = $this->readEnv('DB_PORT', $this->port);
        $this->db_name = $this->readEnv('DB_NAME', $this->db_name);
        $this->username = $this->readEnv('DB_USER', $this->username);
        $this->password = $this->readEnv('DB_PASSWORD', $this->readEnv('DB_PASS', $this->password));
        $this->timeoutSeconds = max(1, (int) $this->readEnv('DB_TIMEOUT_SECONDS', (string) $this->timeoutSeconds));
        $this->persistent = filter_var(
            $this->readEnv('DB_PERSISTENT', $this->persistent ? 'true' : 'false'),
            FILTER_VALIDATE_BOOLEAN
        );

        // Read-heavy endpoints may opt into the replica without changing the
        // write connection used by transactions. When no replica is configured,
        // the primary remains the explicit and observable fallback.
        if ($this->role === 'read') {
            $readHost = $this->readEnv('DB_READ_HOST', '');
            if ($readHost !== '') {
                $this->host = $readHost;
                $this->port = $this->readEnv('DB_READ_PORT', $this->port);
                $this->db_name = $this->readEnv('DB_READ_NAME', $this->db_name);
                $this->username = $this->readEnv('DB_READ_USER', $this->username);
                $this->password = $this->readEnv(
                    'DB_READ_PASSWORD',
                    $this->readEnv('DB_READ_PASS', $this->password)
                );
                $this->timeoutSeconds = max(
                    1,
                    (int) $this->readEnv('DB_READ_TIMEOUT_SECONDS', (string) $this->timeoutSeconds)
                );
                $this->persistent = filter_var(
                    $this->readEnv('DB_READ_PERSISTENT', $this->persistent ? 'true' : 'false'),
                    FILTER_VALIDATE_BOOLEAN
                );
                $this->usingReplica = true;
            }
        }
    }

    public function isUsingReplica(): bool {
        return $this->usingReplica;
    }

    public function getConnection() {
        if ($this->conn instanceof PDO) {
            return $this->conn;
        }

        try {
            $portSegment = $this->port !== '' ? ';port=' . $this->port : '';
            $dsn = "mysql:host=" . $this->host . $portSegment . ";dbname=" . $this->db_name . ";charset=utf8mb4";

            $this->conn = new PDO($dsn, $this->username, $this->password, [
                PDO::ATTR_TIMEOUT => $this->timeoutSeconds,
                PDO::ATTR_PERSISTENT => $this->persistent,
            ]);
            $this->conn->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("SET time_zone = '" . getDatabaseTimezoneOffset() . "'");
        } catch(PDOException $exception) {
            try {
                $reference = bin2hex(random_bytes(8));
            } catch (Throwable) {
                $reference = substr(hash('sha256', uniqid('db-', true)), 0, 16);
            }
            error_log(sprintf('[database_connection_failed] reference=%s detail=%s', $reference, $exception->getMessage()));
            throw new RuntimeException('Database connection failed. Reference: ' . $reference);
        }

        return $this->conn;
    }

    private function readEnv(string $key, string $fallback): string {
        $value = $_ENV[$key] ?? getenv($key);
        if ($value === false || $value === null) {
            return $fallback;
        }

        $value = trim((string) $value);
        return $value !== '' ? $value : $fallback;
    }

    public function __destruct() {
        $this->conn = null;
    }
}
?>
