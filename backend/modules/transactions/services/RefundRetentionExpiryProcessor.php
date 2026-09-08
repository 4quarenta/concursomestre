<?php

declare(strict_types=1);

require_once __DIR__ . '/../repositories/TransactionsRepository.php';
require_once __DIR__ . '/../validators/TransactionsValidator.php';
require_once __DIR__ . '/TransactionsService.php';

/**
 * Adaptador do processamento de expiracao para o cron financeiro existente.
 *
 * @since 1.0.0
 */
final class RefundRetentionExpiryProcessor
{
    public static function run(PDO $db, int $limit = 50): array
    {
        return (new TransactionsService(
            $db,
            new TransactionsRepository($db),
            new TransactionsValidator()
        ))->processExpiredRefundRetentionOffers($limit);
    }
}
