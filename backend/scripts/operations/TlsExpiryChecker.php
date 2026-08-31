<?php

declare(strict_types=1);

final class TlsExpiryChecker
{
    public const PASS = 'PASS';
    public const WARN = 'WARN';
    public const CRITICAL = 'CRITICAL';
    public const EXPIRED = 'EXPIRED';
    public const ERROR = 'ERROR';

    /** @return array{status: string, ok: bool, daysRemaining: int, expiryTimestamp: int} */
    public static function evaluateExpiry(
        int $expiryTimestamp,
        DateTimeImmutable $now,
        int $warningDays = 30,
        int $criticalDays = 7
    ): array {
        if ($warningDays < 1 || $criticalDays < 0 || $criticalDays >= $warningDays) {
            throw new InvalidArgumentException('TLS expiry thresholds are invalid.');
        }

        $secondsRemaining = $expiryTimestamp - $now->getTimestamp();
        $daysRemaining = (int) floor($secondsRemaining / 86400);
        $status = match (true) {
            $secondsRemaining <= 0 => self::EXPIRED,
            $daysRemaining <= $criticalDays => self::CRITICAL,
            $daysRemaining <= $warningDays => self::WARN,
            default => self::PASS,
        };

        return [
            'status' => $status,
            'ok' => $status === self::PASS,
            'daysRemaining' => $daysRemaining,
            'expiryTimestamp' => $expiryTimestamp,
        ];
    }

    /** @return array<string, mixed> */
    public static function inspectCertificate(string $path, ?DateTimeImmutable $now = null, int $warningDays = 30, int $criticalDays = 7): array
    {
        if ($path === '' || !is_file($path) || !is_readable($path)) {
            return ['status' => self::ERROR, 'ok' => false, 'error' => 'certificate_unreadable'];
        }

        $certificate = file_get_contents($path);
        $parsed = $certificate === false ? false : openssl_x509_parse($certificate);
        $expiryTimestamp = is_array($parsed) ? (int) ($parsed['validTo_time_t'] ?? 0) : 0;
        if ($expiryTimestamp <= 0) {
            return ['status' => self::ERROR, 'ok' => false, 'error' => 'certificate_invalid'];
        }

        $result = self::evaluateExpiry($expiryTimestamp, $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC')), $warningDays, $criticalDays);
        $result['certificatePath'] = $path;
        $result['validUntil'] = gmdate(DATE_ATOM, $expiryTimestamp);
        return $result;
    }
}
