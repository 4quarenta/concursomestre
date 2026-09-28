<?php

declare(strict_types=1);

/** Stores the latest published release note acknowledged by each account. */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS changelog_user_reads (
            user_id VARCHAR(64) NOT NULL,
            viewed_through_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
