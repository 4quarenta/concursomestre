<?php

declare(strict_types=1);

/**
 * Moves Lei Comentada schema work out of HTTP requests.
 *
 * The bootstrap is intentionally additive: legacy columns and records are
 * preserved, while the normalized tables and compatibility columns required
 * by the current reader are created or completed before runtime starts.
 */
require_once __DIR__ . '/../../modules/legal_commentary/repositories/LegalCommentaryRepository.php';

return static function (PDO $db): void {
    (new LegalCommentaryRepository($db))->applySchemaMigration();
};
