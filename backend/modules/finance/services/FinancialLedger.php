<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';
require_once __DIR__ . '/ReferralFinance.php';

/**
 * Append-only financial view derived from operational transactions.
 *
 * `transactions` keeps gateway and workflow state. This ledger records the
 * financial effects of proven captures and refunds so reports never have to
 * infer revenue from UI-oriented status aliases.
 */
final class FinancialLedger
{
    private const TABLE = 'financial_ledger_entries';

    public static function syncTransactionById(PDO $db, int $transactionId, string $source = 'runtime'): void
    {
        if ($transactionId <= 0) {
            return;
        }

        $stmt = $db->prepare('SELECT * FROM transactions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $transactionId]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($transaction)) {
            return;
        }

        self::syncTransaction($db, $transaction, $source);
    }

    /**
     * @param array<string, mixed> $transaction
     */
    public static function syncTransaction(PDO $db, array $transaction, string $source = 'runtime'): void
    {
        self::assertReady($db);

        $transactionId = (int) ($transaction['id'] ?? 0);
        $amount = round((float) ($transaction['amount'] ?? 0), 2);
        if ($transactionId <= 0 || $amount <= 0.0) {
            return;
        }

        $status = self::normalizeTransactionStatus($transaction);
        if (self::hasCaptureEvidence($status)) {
            self::appendCapture($db, $transaction, $source);
        }

        if (self::isRefunded($status, $transaction)) {
            // A refunded transaction necessarily had a prior capture. Older
            // rows may only retain the final status, so preserve both facts.
            self::appendCapture($db, $transaction, $source);
            self::appendRefund($db, $transaction, $source);
        }

        ReferralFinance::syncTransaction($db, $transaction, $source);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function summarize(PDO $db, ?string $startDateTime = null, ?string $endDateTime = null): ?array
    {
        if (!self::isAvailable($db)) {
            return null;
        }

        $where = [];
        $params = [];
        if ($startDateTime !== null && $endDateTime !== null) {
            $where[] = 'occurred_at BETWEEN :start_at AND :end_at';
            $params[':start_at'] = $startDateTime;
            $params[':end_at'] = $endDateTime;
        }
        $whereClause = $where !== [] ? 'WHERE ' . implode(' AND ', $where) : '';

        $totals = $db->prepare(
            "SELECT
                COALESCE(SUM(CASE WHEN entry_type = 'capture' THEN gross_amount ELSE 0 END), 0) AS gross_captured,
                COALESCE(SUM(CASE WHEN entry_type = 'refund' THEN ABS(gross_amount) ELSE 0 END), 0) AS refunded_amount,
                COALESCE(SUM(gross_amount), 0) AS recognized_gross,
                COALESCE(SUM(fee_amount), 0) AS recognized_fee,
                COALESCE(SUM(net_amount), 0) AS recognized_net,
                COUNT(DISTINCT CASE WHEN entry_type = 'capture' THEN transaction_id END) AS captured_transactions
             FROM " . self::TABLE . " " . $whereClause
        );
        $totals->execute($params);
        $summary = $totals->fetch(PDO::FETCH_ASSOC) ?: [];

        $byTypeStmt = $db->prepare(
            "SELECT
                transaction_type,
                COALESCE(SUM(CASE WHEN entry_type = 'capture' THEN gross_amount ELSE 0 END), 0) AS gross_captured,
                COALESCE(SUM(CASE WHEN entry_type = 'refund' THEN ABS(gross_amount) ELSE 0 END), 0) AS refunded_amount,
                COALESCE(SUM(gross_amount), 0) AS recognized_gross,
                COALESCE(SUM(fee_amount), 0) AS recognized_fee,
                COALESCE(SUM(net_amount), 0) AS recognized_net,
                COUNT(DISTINCT CASE WHEN entry_type = 'capture' THEN transaction_id END) AS captured_transactions
             FROM " . self::TABLE . " " . $whereClause . "
             GROUP BY transaction_type"
        );
        $byTypeStmt->execute($params);
        $byType = [];
        foreach ($byTypeStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $byType[(string) ($row['transaction_type'] ?? 'unknown')] = self::numericRow($row);
        }

        return array_merge(self::numericRow($summary), [
            'by_type' => $byType,
            'ledger_backed' => true,
        ]);
    }

    private static function appendCapture(PDO $db, array $transaction, string $source): void
    {
        $amount = round((float) ($transaction['amount'] ?? 0), 2);
        $fee = round((float) ($transaction['platform_fee'] ?? 0), 2);
        self::appendEntry($db, [
            'entry_key' => self::entryKey($transaction, 'capture'),
            'transaction_id' => (int) $transaction['id'],
            'user_subscription_id' => self::nullableInt($transaction['user_subscription_id'] ?? null),
            'transaction_type' => self::transactionType($transaction),
            'entry_type' => 'capture',
            'payment_provider' => self::paymentProvider($transaction),
            'provider_reference' => self::providerReference($transaction),
            'provider_refund_id' => null,
            'gross_amount' => $amount,
            'fee_amount' => $fee,
            'net_amount' => $amount - $fee,
            'occurred_at' => self::dateValue($transaction['created_at'] ?? null),
            'source' => $source,
            'metadata_json' => self::metadata($transaction),
        ]);
    }

    private static function appendRefund(PDO $db, array $transaction, string $source): void
    {
        $amount = self::refundAmount($transaction);
        if ($amount <= 0.0) {
            return;
        }

        $transactionAmount = max(0.0, round((float) ($transaction['amount'] ?? 0), 2));
        $captureFee = max(0.0, round((float) ($transaction['platform_fee'] ?? 0), 2));
        // `platform_fee` is the recorded commercial split, not a processor
        // fee. Reversing it proportionally makes a full refund net to zero
        // and leaves a partial refund with only its remaining commercial
        // value. Processor fees are not inferred when no source exists.
        $reversedFee = $transactionAmount > 0.0
            ? min($captureFee, round($captureFee * min($amount, $transactionAmount) / $transactionAmount, 2))
            : 0.0;

        self::appendEntry($db, [
            'entry_key' => self::entryKey($transaction, 'refund'),
            'transaction_id' => (int) $transaction['id'],
            'user_subscription_id' => self::nullableInt($transaction['user_subscription_id'] ?? null),
            'transaction_type' => self::transactionType($transaction),
            'entry_type' => 'refund',
            'payment_provider' => self::paymentProvider($transaction),
            'provider_reference' => self::providerReference($transaction),
            'provider_refund_id' => self::nonEmpty($transaction['provider_refund_id'] ?? null),
            'gross_amount' => -$amount,
            'fee_amount' => -$reversedFee,
            'net_amount' => -round($amount - $reversedFee, 2),
            'occurred_at' => self::dateValue($transaction['refunded_at'] ?? null, $transaction['created_at'] ?? null),
            'source' => $source,
            'metadata_json' => self::metadata($transaction),
        ]);
    }

    /** @param array<string, mixed> $entry */
    private static function appendEntry(PDO $db, array $entry): void
    {
        $stmt = $db->prepare(
            'INSERT INTO financial_ledger_entries (
                entry_key, transaction_id, user_subscription_id, transaction_type, entry_type,
                payment_provider, provider_reference, provider_refund_id, currency,
                gross_amount, fee_amount, net_amount, occurred_at, source, metadata_json
             ) VALUES (
                :entry_key, :transaction_id, :user_subscription_id, :transaction_type, :entry_type,
                :payment_provider, :provider_reference, :provider_refund_id, \'BRL\',
                :gross_amount, :fee_amount, :net_amount, :occurred_at, :source, :metadata_json
             ) ON DUPLICATE KEY UPDATE
                provider_reference = COALESCE(NULLIF(provider_reference, \'\'), VALUES(provider_reference)),
                provider_refund_id = COALESCE(NULLIF(provider_refund_id, \'\'), VALUES(provider_refund_id)),
                metadata_json = COALESCE(metadata_json, VALUES(metadata_json))'
        );
        $stmt->execute([
            ':entry_key' => $entry['entry_key'],
            ':transaction_id' => $entry['transaction_id'],
            ':user_subscription_id' => $entry['user_subscription_id'],
            ':transaction_type' => $entry['transaction_type'],
            ':entry_type' => $entry['entry_type'],
            ':payment_provider' => $entry['payment_provider'],
            ':provider_reference' => $entry['provider_reference'],
            ':provider_refund_id' => $entry['provider_refund_id'],
            ':gross_amount' => $entry['gross_amount'],
            ':fee_amount' => $entry['fee_amount'],
            ':net_amount' => $entry['net_amount'],
            ':occurred_at' => $entry['occurred_at'],
            ':source' => $entry['source'],
            ':metadata_json' => $entry['metadata_json'],
        ]);
    }

    private static function assertReady(PDO $db): void
    {
        SchemaReadiness::assertTablesAndColumns($db, 'livro razao financeiro', [
            self::TABLE => [
                'entry_key',
                'transaction_id',
                'user_subscription_id',
                'transaction_type',
                'entry_type',
                'payment_provider',
                'gross_amount',
                'fee_amount',
                'net_amount',
                'occurred_at',
            ],
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

    private static function normalizeTransactionStatus(array $transaction): string
    {
        if (
            self::nonEmpty($transaction['provider_refund_id'] ?? null) !== null
            || self::nonEmpty($transaction['refunded_at'] ?? null) !== null
        ) {
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

    private static function hasCaptureEvidence(string $status): bool
    {
        return in_array($status, ['approved', 'completed', 'refund_requested', 'refunded', 'partially_refunded'], true);
    }

    private static function isRefunded(string $status, array $transaction): bool
    {
        return in_array($status, ['refunded', 'partially_refunded'], true)
            || self::nonEmpty($transaction['provider_refund_id'] ?? null) !== null
            || self::nonEmpty($transaction['refunded_at'] ?? null) !== null;
    }

    private static function refundAmount(array $transaction): float
    {
        $amount = (float) ($transaction['refunded_amount'] ?? 0);
        if ($amount > 0) {
            return round($amount, 2);
        }

        $details = json_decode((string) ($transaction['provider_refund_details_json'] ?? ''), true);
        if (is_array($details) && isset($details['refund_amount'])) {
            $amount = (float) $details['refund_amount'];
            if ($amount > 0) {
                return round($amount, 2);
            }
        }

        return round((float) ($transaction['amount'] ?? 0), 2);
    }

    private static function entryKey(array $transaction, string $entryType): string
    {
        return 'transaction:' . (int) ($transaction['id'] ?? 0) . ':' . $entryType;
    }

    private static function transactionType(array $transaction): string
    {
        $type = strtolower(trim((string) ($transaction['type'] ?? '')));
        return $type !== '' ? $type : 'unknown';
    }

    private static function paymentProvider(array $transaction): string
    {
        return strtolower(trim((string) ($transaction['payment_provider'] ?? ''))) ?: 'stripe';
    }

    private static function providerReference(array $transaction): ?string
    {
        foreach (['provider_invoice_id', 'provider_payment_intent_id', 'external_id'] as $key) {
            $value = self::nonEmpty($transaction[$key] ?? null);
            if ($value !== null) {
                return $value;
            }
        }

        return 'transaction:' . (int) ($transaction['id'] ?? 0);
    }

    private static function dateValue(mixed ...$values): string
    {
        foreach ($values as $value) {
            $normalized = self::nonEmpty($value);
            if ($normalized !== null && strtotime($normalized) !== false) {
                return $normalized;
            }
        }

        return date('Y-m-d H:i:s');
    }

    private static function nullableInt(mixed $value): ?int
    {
        $value = (int) $value;
        return $value > 0 ? $value : null;
    }

    private static function nonEmpty(mixed $value): ?string
    {
        $value = trim((string) $value);
        return $value !== '' ? $value : null;
    }

    /** @param array<string, mixed> $row @return array<string, float|int> */
    private static function numericRow(array $row): array
    {
        return [
            'gross_captured' => round((float) ($row['gross_captured'] ?? 0), 2),
            'refunded_amount' => round((float) ($row['refunded_amount'] ?? 0), 2),
            'recognized_gross' => round((float) ($row['recognized_gross'] ?? 0), 2),
            'recognized_fee' => round((float) ($row['recognized_fee'] ?? 0), 2),
            'recognized_net' => round((float) ($row['recognized_net'] ?? 0), 2),
            'captured_transactions' => (int) ($row['captured_transactions'] ?? 0),
        ];
    }

    private static function metadata(array $transaction): string
    {
        return json_encode([
            'transaction_status' => self::normalizeTransactionStatus($transaction),
            'installments' => max(1, (int) ($transaction['installments'] ?? 1)),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }
}
