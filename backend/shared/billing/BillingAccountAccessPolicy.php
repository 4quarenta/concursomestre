<?php

declare(strict_types=1);

/**
 * Autoridade compartilhada para a restrição de acesso da conta por
 * inadimplência. A assinatura continua sendo a autoridade financeira; esta
 * classe apenas aplica a política de acesso aprovada após a janela de graça.
 */
final class BillingAccountAccessPolicy
{
    public const KIND = 'billing_nonpayment';
    public const GRACE_PERIOD_HOURS = 72;

    public static function isInstalled(PDO $db): bool
    {
        return self::tableExists($db, 'account_access_restrictions')
            && self::tableExists($db, 'account_access_restriction_events');
    }

    public static function isInGrace(PDO $db, string $userId): bool
    {
        return (self::current($db, $userId)['status'] ?? null) === 'grace';
    }

    public static function recordFailureIfInstalled(
        PDO $db,
        string $userId,
        ?int $subscriptionId,
        string $invoiceId,
        ?DateTimeImmutable $occurredAt = null
    ): void {
        if (self::isInstalled($db)) {
            self::recordFailure($db, $userId, $subscriptionId, $invoiceId, $occurredAt);
        }
    }

    public static function resolveIfInstalled(PDO $db, string $userId, string $reason): void
    {
        if (self::isInstalled($db)) {
            self::resolve($db, $userId, $reason);
        }
    }

    public static function blockExpiredIfInstalled(PDO $db, int $limit = 100): array
    {
        return self::isInstalled($db) ? self::blockExpired($db, $limit) : [];
    }

    public static function isBlocked(PDO $db, string $userId): bool
    {
        if (!self::isInstalled($db) || trim($userId) === '') {
            return false;
        }

        $stmt = $db->prepare(
            "SELECT 1 FROM account_access_restrictions
             WHERE user_id = :user_id AND kind = :kind AND status = 'blocked'
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId, ':kind' => self::KIND]);

        return (bool) $stmt->fetchColumn();
    }

    public static function assertCanAuthenticate(PDO $db, string $userId): void
    {
        if (self::isBlocked($db, $userId)) {
            throw new RuntimeException(
                'Acesso temporariamente bloqueado por pendencia de pagamento. Regularize a assinatura ou contate o suporte.'
            );
        }
    }

    public static function recordFailure(
        PDO $db,
        string $userId,
        ?int $subscriptionId,
        string $invoiceId,
        ?DateTimeImmutable $occurredAt = null
    ): array {
        self::assertInstalled($db);
        $userId = trim($userId);
        $invoiceId = trim($invoiceId);
        $occurredAt = self::utc($occurredAt ?? new DateTimeImmutable('now', new DateTimeZone('UTC')));
        $occurredAtString = $occurredAt->format('Y-m-d H:i:s');

        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                'SELECT * FROM account_access_restrictions
                 WHERE user_id = :user_id AND kind = :kind
                 LIMIT 1 FOR UPDATE'
            );
            $stmt->execute([':user_id' => $userId, ':kind' => self::KIND]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

            if ($current && in_array((string) $current['status'], ['blocked', 'grace'], true)) {
                self::recordEvent($db, $current, 'payment_failure_observed', [
                    'invoice_id' => $invoiceId,
                    'duplicate_or_continuation' => true,
                ]);
                $db->commit();
                return $current;
            }

            if ($current && (string) ($current['source_invoice_id'] ?? '') === $invoiceId && $invoiceId !== '') {
                self::recordEvent($db, $current, 'payment_failure_ignored_after_recovery', [
                    'invoice_id' => $invoiceId,
                ]);
                $db->commit();
                return $current;
            }

            $graceExpiresAt = $occurredAt->modify('+' . self::GRACE_PERIOD_HOURS . ' hours');
            if ($current) {
                $update = $db->prepare(
                    "UPDATE account_access_restrictions
                     SET status = 'grace', first_failure_at = :first_failure_at,
                         grace_expires_at = :grace_expires_at, blocked_at = NULL,
                         source_subscription_id = :subscription_id, source_invoice_id = :invoice_id,
                         resolved_at = NULL, updated_at = :updated_at
                     WHERE id = :id"
                );
                $update->execute([
                    ':first_failure_at' => $occurredAtString,
                    ':grace_expires_at' => $graceExpiresAt->format('Y-m-d H:i:s'),
                    ':subscription_id' => $subscriptionId,
                    ':invoice_id' => $invoiceId !== '' ? $invoiceId : null,
                    ':updated_at' => $occurredAtString,
                    ':id' => $current['id'],
                ]);
                $restrictionId = (int) $current['id'];
            } else {
                $insert = $db->prepare(
                    "INSERT INTO account_access_restrictions
                     (user_id, kind, status, first_failure_at, grace_expires_at,
                      source_subscription_id, source_invoice_id, created_at, updated_at)
                     VALUES (:user_id, :kind, 'grace', :first_failure_at, :grace_expires_at,
                             :subscription_id, :invoice_id, :created_at, :updated_at)"
                );
                $insert->execute([
                    ':user_id' => $userId,
                    ':kind' => self::KIND,
                    ':first_failure_at' => $occurredAtString,
                    ':grace_expires_at' => $graceExpiresAt->format('Y-m-d H:i:s'),
                    ':subscription_id' => $subscriptionId,
                    ':invoice_id' => $invoiceId !== '' ? $invoiceId : null,
                    ':created_at' => $occurredAtString,
                    ':updated_at' => $occurredAtString,
                ]);
                $restrictionId = (int) $db->lastInsertId();
            }

            self::recordEvent($db, ['id' => $restrictionId, 'user_id' => $userId], 'grace_started', [
                'invoice_id' => $invoiceId,
                'grace_expires_at' => $graceExpiresAt->format(DateTimeInterface::ATOM),
            ]);
            $db->commit();

            return [
                'id' => $restrictionId,
                'user_id' => $userId,
                'status' => 'grace',
                'first_failure_at' => $occurredAtString,
                'grace_expires_at' => $graceExpiresAt->format('Y-m-d H:i:s'),
            ];
        } catch (Throwable $exception) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $exception;
        }
    }

    public static function resolve(PDO $db, string $userId, string $reason = 'payment_recovered'): bool
    {
        self::assertInstalled($db);
        if (self::hasUnresolvedSubscription($db, $userId)) {
            return false;
        }

        $stmt = $db->prepare(
            "UPDATE account_access_restrictions
             SET status = 'recovered', resolved_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
             WHERE user_id = :user_id AND kind = :kind AND status IN ('grace', 'blocked')"
        );
        $stmt->execute([':user_id' => $userId, ':kind' => self::KIND]);
        if ($stmt->rowCount() > 0) {
            $row = self::current($db, $userId);
            if ($row) {
                self::recordEvent($db, $row, 'restriction_recovered', ['reason' => $reason]);
            }
            return true;
        }

        return false;
    }

    public static function blockExpired(PDO $db, int $limit = 100, ?DateTimeImmutable $now = null): array
    {
        self::assertInstalled($db);
        $limit = max(1, min(500, $limit));
        $now = self::utc($now ?? new DateTimeImmutable('now', new DateTimeZone('UTC')));
        $cutoff = $now->format('Y-m-d H:i:s');
        $stmt = $db->prepare(
            "SELECT id, user_id FROM account_access_restrictions
             WHERE kind = :kind AND status = 'grace' AND grace_expires_at <= :cutoff
             ORDER BY id ASC LIMIT {$limit}"
        );
        $stmt->execute([':kind' => self::KIND, ':cutoff' => $cutoff]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $blocked = [];

        foreach ($rows as $row) {
            $db->beginTransaction();
            try {
                $lock = $db->prepare(
                    "SELECT * FROM account_access_restrictions
                     WHERE id = :id AND status = 'grace' AND grace_expires_at <= :cutoff
                     LIMIT 1 FOR UPDATE"
                );
                $lock->execute([':id' => $row['id'], ':cutoff' => $cutoff]);
                $current = $lock->fetch(PDO::FETCH_ASSOC);
                if (!$current) {
                    $db->commit();
                    continue;
                }

                $update = $db->prepare(
                    "UPDATE account_access_restrictions
                     SET status = 'blocked', blocked_at = :blocked_at, updated_at = :blocked_at
                     WHERE id = :id"
                );
                $update->execute([':blocked_at' => $cutoff, ':id' => $current['id']]);
                self::recordEvent($db, $current, 'account_blocked_after_grace', [
                    'blocked_at' => $now->format(DateTimeInterface::ATOM),
                ]);
                if (function_exists('revokeAllUserSessionFamilies')) {
                    revokeAllUserSessionFamilies($db, (string) $current['user_id'], 'billing_nonpayment');
                }
                $db->commit();
                $blocked[] = (string) $current['user_id'];
            } catch (Throwable $exception) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                throw $exception;
            }
        }

        return ['examined' => count($rows), 'blocked' => count($blocked), 'user_ids' => $blocked];
    }

    public static function current(PDO $db, string $userId): ?array
    {
        if (!self::isInstalled($db)) {
            return null;
        }
        $stmt = $db->prepare(
            'SELECT * FROM account_access_restrictions WHERE user_id = :user_id AND kind = :kind LIMIT 1'
        );
        $stmt->execute([':user_id' => $userId, ':kind' => self::KIND]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private static function hasUnresolvedSubscription(PDO $db, string $userId): bool
    {
        $stmt = $db->prepare(
            "SELECT 1 FROM user_subscriptions
             WHERE user_id = :user_id AND status IN ('past_due', 'unpaid', 'incomplete')
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        return (bool) $stmt->fetchColumn();
    }

    private static function recordEvent(PDO $db, array $restriction, string $event, array $metadata): void
    {
        $stmt = $db->prepare(
            'INSERT INTO account_access_restriction_events
             (restriction_id, user_id, event_name, metadata_json, created_at)
             VALUES (:restriction_id, :user_id, :event_name, :metadata_json, UTC_TIMESTAMP())'
        );
        $stmt->execute([
            ':restriction_id' => (int) ($restriction['id'] ?? 0),
            ':user_id' => (string) ($restriction['user_id'] ?? ''),
            ':event_name' => $event,
            ':metadata_json' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }

    private static function assertInstalled(PDO $db): void
    {
        if (!self::isInstalled($db)) {
            throw new RuntimeException('A politica de bloqueio por inadimplencia ainda nao foi instalada.');
        }
    }

    private static function tableExists(PDO $db, string $table): bool
    {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table]);
        return (bool) $stmt->fetchColumn();
    }

    private static function utc(DateTimeImmutable $date): DateTimeImmutable
    {
        return $date->setTimezone(new DateTimeZone('UTC'));
    }
}
