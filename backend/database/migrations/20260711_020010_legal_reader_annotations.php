<?php

declare(strict_types=1);

/**
 * Persists reader markups separately from official legal content.
 * This migration is additive and idempotent through the repository bootstrap.
 */
require_once __DIR__ . '/../../modules/legal_commentary/repositories/LegalCommentaryRepository.php';

return static function (PDO $db): void {
    (new LegalCommentaryRepository($db))->applySchemaMigration();
};
