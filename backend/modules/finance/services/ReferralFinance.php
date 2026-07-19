<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Livro auxiliar do programa de indicacoes.
 *
 * Capturas e estornos sao registrados por chave idempotente. O percentual e
 * a carencia ficam congelados no lancamento de captura; mudancas futuras nas
 * configuracoes nao reescrevem obrigacoes financeiras antigas.
 */
final class ReferralFinance
{
    private const ENTRIES_TABLE = 'referral_commission_entries';
    private const CYCLES_TABLE = 'referral_payout_cycles';
    private const ITEMS_TABLE = 'referral_payout_items';

    public static function syncTransactionById(PDO $db, int $transactionId, string $source): void
    {
        if ($transactionId <= 0 || !self::isAvailable($db)) {
            return;
        }

        $stmt = $db->prepare('SELECT * FROM transactions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $transactionId]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        if (is_array($transaction)) {
            self::syncTransaction($db, $transaction, $source);
        }
    }

    /** @param array<string, mixed> $transaction */
    public static function syncTransaction(PDO $db, array $transaction, string $source): void
    {
        if (!self::isAvailable($db)) {
            return;
        }

        $transactionId = (int) ($transaction['id'] ?? 0);
        $referredUserId = trim((string) ($transaction['user_id'] ?? ''));
        $transactionType = strtolower(trim((string) ($transaction['type'] ?? '')));
        $amount = round((float) ($transaction['amount'] ?? 0), 2);
        if ($transactionId <= 0 || $referredUserId === '' || $transactionType !== 'plan' || $amount <= 0) {
            return;
        }

        $referralStmt = $db->prepare(
            "SELECT id, referrer_id, referred_user_id
             FROM referrals
             WHERE referred_user_id = :user_id
               AND referrer_id <> referred_user_id
             LIMIT 1"
        );
        $referralStmt->execute([':user_id' => $referredUserId]);
        $referral = $referralStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($referral)) {
            return;
        }

        $status = self::normalizeStatus($transaction);
        if (!in_array($status, ['approved', 'completed', 'refund_requested', 'partially_refunded', 'refunded'], true)) {
            return;
        }

        $referralId = (int) $referral['id'];
        $referrerId = trim((string) $referral['referrer_id']);
        $capturedAt = self::dateValue($transaction['created_at'] ?? null);
        $commissionPercent = self::configuredPercent($db);
        $graceDays = self::configuredGraceDays($db);
        $availableAt = date('Y-m-d H:i:s', strtotime($capturedAt . " +{$graceDays} days"));

        $insert = $db->prepare(
            'INSERT IGNORE INTO ' . self::ENTRIES_TABLE . ' (
                entry_key, referral_id, transaction_id, referrer_id, referred_user_id,
                entry_type, base_amount, commission_percent, amount, available_at,
                occurred_at, source, metadata_json
             ) VALUES (
                :entry_key, :referral_id, :transaction_id, :referrer_id, :referred_user_id,
                \'accrual\', :base_amount, :commission_percent, :amount, :available_at,
                :occurred_at, :source, :metadata_json
             )'
        );
        $insert->execute([
            ':entry_key' => "referral:{$referralId}:transaction:{$transactionId}:accrual",
            ':referral_id' => $referralId,
            ':transaction_id' => $transactionId,
            ':referrer_id' => $referrerId,
            ':referred_user_id' => $referredUserId,
            ':base_amount' => $amount,
            ':commission_percent' => $commissionPercent,
            ':amount' => round($amount * $commissionPercent / 100, 2),
            ':available_at' => $availableAt,
            ':occurred_at' => $capturedAt,
            ':source' => substr($source, 0, 80),
            ':metadata_json' => json_encode([
                'payment_provider' => (string) ($transaction['payment_provider'] ?? ''),
                'provider_invoice_id' => (string) ($transaction['provider_invoice_id'] ?? ''),
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}',
        ]);

        $db->prepare("UPDATE referrals SET status = 'converted', updated_at = NOW() WHERE id = :id AND status = 'pending'")
            ->execute([':id' => $referralId]);

        $refundedAmount = self::refundedAmount($transaction, $status, $amount);
        if ($refundedAmount <= 0) {
            return;
        }

        $accrualStmt = $db->prepare(
            'SELECT commission_percent, available_at FROM ' . self::ENTRIES_TABLE . '
             WHERE entry_key = :entry_key LIMIT 1'
        );
        $accrualStmt->execute([':entry_key' => "referral:{$referralId}:transaction:{$transactionId}:accrual"]);
        $accrual = $accrualStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $snapshotPercent = (float) ($accrual['commission_percent'] ?? $commissionPercent);
        $refundAvailableAt = (string) ($accrual['available_at'] ?? $availableAt);
        $refundOccurredAt = self::dateValue($transaction['refunded_at'] ?? null, $transaction['updated_at'] ?? null);

        $refundStmt = $db->prepare(
            'INSERT INTO ' . self::ENTRIES_TABLE . ' (
                entry_key, referral_id, transaction_id, referrer_id, referred_user_id,
                entry_type, base_amount, commission_percent, amount, available_at,
                occurred_at, source, metadata_json
             ) VALUES (
                :entry_key, :referral_id, :transaction_id, :referrer_id, :referred_user_id,
                \'refund\', :base_amount, :commission_percent, :amount, :available_at,
                :occurred_at, :source, :metadata_json
             ) ON DUPLICATE KEY UPDATE
                base_amount = VALUES(base_amount),
                amount = VALUES(amount),
                occurred_at = VALUES(occurred_at),
                source = VALUES(source),
                metadata_json = VALUES(metadata_json)'
        );
        $refundStmt->execute([
            ':entry_key' => "referral:{$referralId}:transaction:{$transactionId}:refund-total",
            ':referral_id' => $referralId,
            ':transaction_id' => $transactionId,
            ':referrer_id' => $referrerId,
            ':referred_user_id' => $referredUserId,
            ':base_amount' => -$refundedAmount,
            ':commission_percent' => $snapshotPercent,
            ':amount' => -round($refundedAmount * $snapshotPercent / 100, 2),
            ':available_at' => $refundAvailableAt,
            ':occurred_at' => $refundOccurredAt,
            ':source' => substr($source, 0, 80),
            ':metadata_json' => json_encode(['refund_total' => $refundedAmount], JSON_UNESCAPED_SLASHES) ?: '{}',
        ]);

        $payoutLookup = $db->prepare(
            'SELECT e.payout_item_id, i.status
             FROM ' . self::ENTRIES_TABLE . ' e
             LEFT JOIN ' . self::ITEMS_TABLE . ' i ON i.id = e.payout_item_id
             WHERE e.entry_key = :entry_key LIMIT 1'
        );
        $payoutLookup->execute([':entry_key' => "referral:{$referralId}:transaction:{$transactionId}:accrual"]);
        $payout = $payoutLookup->fetch(PDO::FETCH_ASSOC) ?: [];
        $payoutItemId = (int) ($payout['payout_item_id'] ?? 0);
        if ($payoutItemId > 0 && in_array((string) ($payout['status'] ?? ''), ['review', 'approved'], true)) {
            $db->prepare(
                'UPDATE ' . self::ENTRIES_TABLE . ' SET payout_item_id = :item_id
                 WHERE entry_key = :entry_key AND payout_item_id IS NULL'
            )->execute([
                ':item_id' => $payoutItemId,
                ':entry_key' => "referral:{$referralId}:transaction:{$transactionId}:refund-total",
            ]);
            $db->prepare(
                'UPDATE ' . self::ITEMS_TABLE . ' i
                 SET i.amount = (SELECT ROUND(COALESCE(SUM(e.amount), 0), 2) FROM ' . self::ENTRIES_TABLE . ' e WHERE e.payout_item_id = i.id)
                 WHERE i.id = :item_id AND i.status IN (\'review\', \'approved\')'
            )->execute([':item_id' => $payoutItemId]);
            $db->prepare(
                'UPDATE ' . self::ITEMS_TABLE . '
                 SET status = CASE WHEN amount <= 0 THEN \'canceled\' ELSE status END
                 WHERE id = :item_id AND status IN (\'review\', \'approved\')'
            )->execute([':item_id' => $payoutItemId]);
            $db->prepare(
                'UPDATE ' . self::CYCLES_TABLE . ' c
                 SET total_amount = (SELECT ROUND(COALESCE(SUM(i.amount), 0), 2) FROM ' . self::ITEMS_TABLE . ' i WHERE i.cycle_id = c.id AND i.status <> \'canceled\')
                 WHERE c.id = (SELECT cycle_id FROM ' . self::ITEMS_TABLE . ' WHERE id = :item_id)'
            )->execute([':item_id' => $payoutItemId]);
            $db->prepare(
                'UPDATE ' . self::CYCLES_TABLE . ' c SET c.status = \'canceled\'
                 WHERE c.id = (SELECT cycle_id FROM ' . self::ITEMS_TABLE . ' WHERE id = :item_id)
                   AND NOT EXISTS (SELECT 1 FROM ' . self::ITEMS_TABLE . ' active WHERE active.cycle_id = c.id AND active.status <> \'canceled\')'
            )->execute([':item_id' => $payoutItemId]);
        }
    }

    /** @return array<string, mixed> */
    public static function userSummary(PDO $db, string $userId, string $frontendBaseUrl): array
    {
        self::assertReady($db);
        $codeStmt = $db->prepare('SELECT referral_code FROM users WHERE id = :id LIMIT 1');
        $codeStmt->execute([':id' => $userId]);
        $referralCode = trim((string) $codeStmt->fetchColumn());

        $countsStmt = $db->prepare(
            "SELECT COUNT(*) AS registered,
                    SUM(CASE WHEN status IN ('converted', 'rewarded') THEN 1 ELSE 0 END) AS converted
             FROM referrals WHERE referrer_id = :id"
        );
        $countsStmt->execute([':id' => $userId]);
        $counts = $countsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $balanceStmt = $db->prepare(
            'SELECT
                COALESCE(SUM(CASE WHEN payout_item_id IS NULL AND available_at > NOW() THEN amount ELSE 0 END), 0) AS pending_amount,
                COALESCE(SUM(CASE WHEN payout_item_id IS NULL AND available_at <= NOW() THEN amount ELSE 0 END), 0) AS available_amount
             FROM ' . self::ENTRIES_TABLE . ' WHERE referrer_id = :id'
        );
        $balanceStmt->execute([':id' => $userId]);
        $balance = $balanceStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $payoutStmt = $db->prepare(
            "SELECT
                COALESCE(SUM(CASE WHEN status IN ('review', 'approved') THEN amount ELSE 0 END), 0) AS scheduled_amount,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount
             FROM " . self::ITEMS_TABLE . ' WHERE referrer_id = :id'
        );
        $payoutStmt->execute([':id' => $userId]);
        $payout = $payoutStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $nextPayoutDate = self::nextPayoutDate($db);
        return [
            'referralCode' => $referralCode,
            'referralLink' => $referralCode !== '' ? rtrim($frontendBaseUrl, '/') . '/auth?ref=' . rawurlencode($referralCode) : null,
            'commissionPercent' => self::configuredPercent($db),
            'totals' => [
                'registered' => (int) ($counts['registered'] ?? 0),
                'converted' => (int) ($counts['converted'] ?? 0),
            ],
            'balance' => [
                'pending' => max(0, round((float) ($balance['pending_amount'] ?? 0), 2)),
                'available' => max(0, round((float) ($balance['available_amount'] ?? 0), 2)),
                'scheduled' => round((float) ($payout['scheduled_amount'] ?? 0), 2),
                'paid' => round((float) ($payout['paid_amount'] ?? 0), 2),
            ],
            'cycle' => [
                'days' => self::configuredCycleDays($db),
                'payoutDay' => self::configuredPayoutDay($db),
                'nextPayoutDate' => $nextPayoutDate,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function adminOverview(PDO $db): array
    {
        self::assertReady($db);
        $rows = $db->query(
            'SELECT u.id AS referrer_id, u.name AS referrer_name, u.email AS referrer_email,
                    COALESCE(e.pending_amount, 0) AS pending_amount,
                    COALESCE(e.available_amount, 0) AS available_amount,
                    r.referred_users
             FROM (
                SELECT referrer_id, COUNT(DISTINCT referred_user_id) AS referred_users
                FROM referrals GROUP BY referrer_id
             ) r
             INNER JOIN users u ON u.id = r.referrer_id COLLATE utf8mb4_unicode_ci
             LEFT JOIN (
                SELECT referrer_id,
                       SUM(CASE WHEN payout_item_id IS NULL AND available_at > NOW() THEN amount ELSE 0 END) AS pending_amount,
                       SUM(CASE WHEN payout_item_id IS NULL AND available_at <= NOW() THEN amount ELSE 0 END) AS available_amount
                FROM ' . self::ENTRIES_TABLE . ' GROUP BY referrer_id
             ) e ON e.referrer_id = r.referrer_id
             ORDER BY available_amount DESC, u.email ASC'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $transfers = array_map(static fn (array $row): array => [
            'referrerId' => (string) $row['referrer_id'],
            'referrerName' => (string) $row['referrer_name'],
            'referrerEmail' => (string) $row['referrer_email'],
            'referredUsers' => (int) $row['referred_users'],
            'pendingAmount' => max(0, round((float) $row['pending_amount'], 2)),
            'availableAmount' => max(0, round((float) $row['available_amount'], 2)),
        ], $rows);

        $cycles = $db->query(
            'SELECT c.*, COUNT(i.id) AS items_count,
                    COALESCE(SUM(CASE WHEN i.status = \'paid\' THEN i.amount ELSE 0 END), 0) AS paid_amount
             FROM ' . self::CYCLES_TABLE . ' c
             LEFT JOIN ' . self::ITEMS_TABLE . ' i ON i.cycle_id = c.id
             GROUP BY c.id ORDER BY c.scheduled_for DESC, c.id DESC LIMIT 24'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $payoutRows = $db->query(
            'SELECT i.id, i.cycle_id, i.referrer_id, i.amount, i.status,
                    i.provider_reference, i.paid_at, u.name AS referrer_name, u.email AS referrer_email
             FROM ' . self::ITEMS_TABLE . ' i
             INNER JOIN users u ON u.id = i.referrer_id
             ORDER BY CASE WHEN i.status = \'paid\' THEN 1 ELSE 0 END, i.id DESC
             LIMIT 200'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $payoutItems = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'cycleId' => (int) $row['cycle_id'],
            'referrerId' => (string) $row['referrer_id'],
            'referrerName' => (string) $row['referrer_name'],
            'referrerEmail' => (string) $row['referrer_email'],
            'amount' => round((float) $row['amount'], 2),
            'status' => (string) $row['status'],
            'providerReference' => $row['provider_reference'] !== null ? (string) $row['provider_reference'] : null,
            'paidAt' => $row['paid_at'] !== null ? (string) $row['paid_at'] : null,
        ], $payoutRows);

        return [
            'settings' => [
                'commissionPercent' => self::configuredPercent($db),
                'refundGraceDays' => self::configuredGraceDays($db),
                'cycleDays' => self::configuredCycleDays($db),
                'payoutDay' => self::configuredPayoutDay($db),
                'nextPayoutDate' => self::nextPayoutDate($db),
            ],
            'summary' => [
                'pending' => round(array_sum(array_column($transfers, 'pendingAmount')), 2),
                'availableToSchedule' => round(array_sum(array_column($transfers, 'availableAmount')), 2),
            ],
            'transfers' => $transfers,
            'cycles' => $cycles,
            'payoutItems' => $payoutItems,
        ];
    }

    /** @return array{recognized:float,pending:float,available:float,scheduled:float,paid:float} */
    public static function liabilitySummary(PDO $db): array
    {
        if (!self::isAvailable($db)) {
            return ['recognized' => 0.0, 'pending' => 0.0, 'available' => 0.0, 'scheduled' => 0.0, 'paid' => 0.0];
        }
        $entry = $db->query(
            'SELECT
                COALESCE(SUM(amount), 0) AS recognized,
                COALESCE(SUM(CASE WHEN payout_item_id IS NULL AND available_at > NOW() THEN amount ELSE 0 END), 0) AS pending,
                COALESCE(SUM(CASE WHEN payout_item_id IS NULL AND available_at <= NOW() THEN amount ELSE 0 END), 0) AS available
             FROM ' . self::ENTRIES_TABLE
        )->fetch(PDO::FETCH_ASSOC) ?: [];
        $items = $db->query(
            "SELECT
                COALESCE(SUM(CASE WHEN status IN ('review', 'approved') THEN amount ELSE 0 END), 0) AS scheduled,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid
             FROM " . self::ITEMS_TABLE
        )->fetch(PDO::FETCH_ASSOC) ?: [];
        return [
            'recognized' => round((float) ($entry['recognized'] ?? 0), 2),
            'pending' => max(0, round((float) ($entry['pending'] ?? 0), 2)),
            'available' => max(0, round((float) ($entry['available'] ?? 0), 2)),
            'scheduled' => max(0, round((float) ($items['scheduled'] ?? 0), 2)),
            'paid' => round((float) ($items['paid'] ?? 0), 2),
        ];
    }

    /** @return array<string, mixed> */
    public static function createCycle(PDO $db, string $adminUserId, bool $force = false): array
    {
        self::assertReady($db);
        $today = new DateTimeImmutable('today');
        if (!$force && (int) $today->format('j') !== self::configuredPayoutDay($db)) {
            return ['created' => false, 'reason' => 'outside_payout_day', 'scheduledFor' => self::nextPayoutDate($db)];
        }

        $periodEnd = new DateTimeImmutable('now');
        $periodStart = $periodEnd->modify('-' . self::configuredCycleDays($db) . ' days');
        $cycleKey = 'referral-' . $today->format('Y-m-d');
        $ownsTransaction = !$db->inTransaction();
        if ($ownsTransaction) {
            $db->beginTransaction();
        }

        try {
            $cycleStmt = $db->prepare(
                'INSERT INTO ' . self::CYCLES_TABLE . ' (
                    cycle_key, period_start, period_end, scheduled_for, status, approved_by_user_id, approved_at
                 ) VALUES (:cycle_key, :period_start, :period_end, :scheduled_for, \'review\', :admin_id, NOW())
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)'
            );
            $cycleStmt->execute([
                ':cycle_key' => $cycleKey,
                ':period_start' => $periodStart->format('Y-m-d H:i:s'),
                ':period_end' => $periodEnd->format('Y-m-d H:i:s'),
                ':scheduled_for' => $today->format('Y-m-d'),
                ':admin_id' => $adminUserId,
            ]);
            $cycleId = (int) $db->lastInsertId();

            $balances = $db->query(
                'SELECT referrer_id, ROUND(SUM(amount), 2) AS amount
                 FROM ' . self::ENTRIES_TABLE . '
                 WHERE payout_item_id IS NULL AND available_at <= NOW()
                 GROUP BY referrer_id HAVING ROUND(SUM(amount), 2) > 0'
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if ($balances === []) {
                $db->prepare('DELETE FROM ' . self::CYCLES_TABLE . ' WHERE id = :id AND total_amount = 0')
                    ->execute([':id' => $cycleId]);
                if ($ownsTransaction) {
                    $db->commit();
                }
                return ['created' => false, 'reason' => 'no_available_balance', 'scheduledFor' => self::nextPayoutDate($db)];
            }

            $itemStmt = $db->prepare(
                'INSERT INTO ' . self::ITEMS_TABLE . ' (cycle_id, referrer_id, amount, status, approved_by_user_id, approved_at)
                 VALUES (:cycle_id, :referrer_id, :amount, \'review\', :admin_id, NOW())
                 ON DUPLICATE KEY UPDATE amount = VALUES(amount)'
            );
            $assignStmt = $db->prepare(
                'UPDATE ' . self::ENTRIES_TABLE . '
                 SET payout_item_id = :item_id
                 WHERE referrer_id = :referrer_id AND payout_item_id IS NULL AND available_at <= NOW()'
            );
            $recalculateItemStmt = $db->prepare(
                'UPDATE ' . self::ITEMS_TABLE . ' i
                 SET i.amount = (
                     SELECT ROUND(COALESCE(SUM(e.amount), 0), 2)
                     FROM ' . self::ENTRIES_TABLE . ' e
                     WHERE e.payout_item_id = i.id
                 )
                 WHERE i.id = :item_id'
            );
            $readItemAmountStmt = $db->prepare(
                'SELECT amount FROM ' . self::ITEMS_TABLE . ' WHERE id = :item_id LIMIT 1'
            );
            $total = 0.0;
            foreach ($balances as $balance) {
                $amount = round((float) $balance['amount'], 2);
                $itemStmt->execute([
                    ':cycle_id' => $cycleId,
                    ':referrer_id' => $balance['referrer_id'],
                    ':amount' => $amount,
                    ':admin_id' => $adminUserId,
                ]);
                $itemId = (int) $db->lastInsertId();
                if ($itemId <= 0) {
                    $find = $db->prepare('SELECT id FROM ' . self::ITEMS_TABLE . ' WHERE cycle_id = :cycle_id AND referrer_id = :referrer_id');
                    $find->execute([':cycle_id' => $cycleId, ':referrer_id' => $balance['referrer_id']]);
                    $itemId = (int) $find->fetchColumn();
                }
                $assignStmt->execute([':item_id' => $itemId, ':referrer_id' => $balance['referrer_id']]);
                $recalculateItemStmt->execute([':item_id' => $itemId]);
                $readItemAmountStmt->execute([':item_id' => $itemId]);
                $assignedAmount = round((float) $readItemAmountStmt->fetchColumn(), 2);
                if ($assignedAmount <= 0) {
                    $db->prepare(
                        'UPDATE ' . self::ENTRIES_TABLE . ' SET payout_item_id = NULL WHERE payout_item_id = :item_id'
                    )->execute([':item_id' => $itemId]);
                    $db->prepare(
                        'UPDATE ' . self::ITEMS_TABLE . " SET status = 'canceled' WHERE id = :item_id"
                    )->execute([':item_id' => $itemId]);
                    continue;
                }
                $total += $assignedAmount;
            }

            $db->prepare('UPDATE ' . self::CYCLES_TABLE . ' SET total_amount = :amount WHERE id = :id')
                ->execute([':amount' => round($total, 2), ':id' => $cycleId]);
            if ($total <= 0) {
                $db->prepare('UPDATE ' . self::CYCLES_TABLE . " SET status = 'canceled' WHERE id = :id")
                    ->execute([':id' => $cycleId]);
            }
            if ($ownsTransaction) {
                $db->commit();
            }
            return ['created' => true, 'cycleId' => $cycleId, 'items' => count($balances), 'amount' => round($total, 2)];
        } catch (Throwable $e) {
            if ($ownsTransaction && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    /** @return array<string, mixed> */
    public static function markPayoutPaid(PDO $db, int $itemId, string $adminUserId, string $providerReference): array
    {
        self::assertReady($db);
        if ($itemId <= 0 || trim($providerReference) === '') {
            throw new InvalidArgumentException('Informe o repasse e a referencia comprovante.');
        }
        $itemStmt = $db->prepare('SELECT referrer_id, amount FROM ' . self::ITEMS_TABLE . ' WHERE id = :id LIMIT 1');
        $itemStmt->execute([':id' => $itemId]);
        $item = $itemStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($item)) {
            throw new RuntimeException('Repasse inexistente.');
        }
        $stmt = $db->prepare(
            'UPDATE ' . self::ITEMS_TABLE . '
             SET status = \'paid\', paid_by_user_id = :admin_id, paid_at = NOW(), provider_reference = :reference
             WHERE id = :id AND status IN (\'review\', \'approved\')'
        );
        $stmt->execute([':admin_id' => $adminUserId, ':reference' => trim($providerReference), ':id' => $itemId]);
        if ($stmt->rowCount() !== 1) {
            throw new RuntimeException('Repasse inexistente ou ja finalizado.');
        }
        $cycleUpdate = $db->prepare(
            'UPDATE ' . self::CYCLES_TABLE . ' c
             SET c.status = \'paid\', c.paid_by_user_id = :admin_id, c.paid_at = NOW()
             WHERE c.id = (SELECT cycle_id FROM ' . self::ITEMS_TABLE . ' WHERE id = :item_id)
               AND NOT EXISTS (
                   SELECT 1 FROM ' . self::ITEMS_TABLE . ' pending
                   WHERE pending.cycle_id = c.id AND pending.status NOT IN (\'paid\', \'canceled\')
               )'
        );
        $cycleUpdate->execute([':admin_id' => $adminUserId, ':item_id' => $itemId]);
        $paidAmount = round((float) ($item['amount'] ?? 0), 2);
        createNotification(
            $db,
            (string) $item['referrer_id'],
            'Repasse de indicação confirmado',
            'O repasse do seu ciclo de indicações foi confirmado pela equipe.',
            'success',
            'system',
            '/profile?tab=referral',
            'referral_payout_paid',
            $paidAmount,
            'Valor recebido'
        );
        return ['paid' => true, 'itemId' => $itemId, 'amount' => $paidAmount];
    }

    private static function assertReady(PDO $db): void
    {
        SchemaReadiness::assertTablesAndColumns($db, 'programa financeiro de indicacoes', [
            self::ENTRIES_TABLE => ['entry_key', 'referral_id', 'transaction_id', 'amount', 'available_at', 'payout_item_id'],
            self::CYCLES_TABLE => ['cycle_key', 'scheduled_for', 'status', 'total_amount'],
            self::ITEMS_TABLE => ['cycle_id', 'referrer_id', 'amount', 'status'],
        ]);
    }

    private static function isAvailable(PDO $db): bool
    {
        try {
            self::assertReady($db);
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private static function configuredPercent(PDO $db): float
    {
        return min(100, max(0, (float) getSystemSettingValue($db, 'referralCommissionPercent', 20)));
    }

    private static function configuredGraceDays(PDO $db): int
    {
        return min(180, max(0, (int) getSystemSettingValue($db, 'referralRefundGraceDays', 7)));
    }

    private static function configuredCycleDays(PDO $db): int
    {
        return min(90, max(1, (int) getSystemSettingValue($db, 'referralPayoutCycleDays', 30)));
    }

    private static function configuredPayoutDay(PDO $db): int
    {
        return min(28, max(1, (int) getSystemSettingValue($db, 'referralPayoutDay', 10)));
    }

    private static function nextPayoutDate(PDO $db): string
    {
        $day = self::configuredPayoutDay($db);
        $today = new DateTimeImmutable('today');
        $candidate = $today->setDate((int) $today->format('Y'), (int) $today->format('n'), $day);
        if ($candidate < $today) {
            $nextMonth = $today->modify('first day of next month');
            $candidate = $nextMonth->setDate(
                (int) $nextMonth->format('Y'),
                (int) $nextMonth->format('n'),
                $day
            );
        }
        return $candidate->format('Y-m-d');
    }

    /** @param array<string, mixed> $transaction */
    private static function normalizeStatus(array $transaction): string
    {
        if (trim((string) ($transaction['provider_refund_id'] ?? '')) !== '' || trim((string) ($transaction['refunded_at'] ?? '')) !== '') {
            return (float) ($transaction['refunded_amount'] ?? 0) > 0
                && (float) ($transaction['refunded_amount'] ?? 0) < (float) ($transaction['amount'] ?? 0)
                ? 'partially_refunded'
                : 'refunded';
        }
        $status = strtolower(trim((string) ($transaction['status'] ?? '')));
        return match ($status) {
            'paid', 'succeeded' => 'approved',
            'cancelled' => 'canceled',
            default => $status,
        };
    }

    /** @param array<string, mixed> $transaction */
    private static function refundedAmount(array $transaction, string $status, float $amount): float
    {
        if (!in_array($status, ['refunded', 'partially_refunded'], true)) {
            return 0.0;
        }
        $recorded = round((float) ($transaction['refunded_amount'] ?? 0), 2);
        return min($amount, $recorded > 0 ? $recorded : $amount);
    }

    private static function dateValue(mixed ...$values): string
    {
        foreach ($values as $value) {
            $text = trim((string) $value);
            if ($text !== '' && strtotime($text) !== false) {
                return $text;
            }
        }
        return date('Y-m-d H:i:s');
    }
}
