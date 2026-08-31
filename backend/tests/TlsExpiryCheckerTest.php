<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/operations/TlsExpiryChecker.php';

function tlsExpiryAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$now = new DateTimeImmutable('2026-08-31T00:00:00Z');
$day = 86400;
tlsExpiryAssert(TlsExpiryChecker::evaluateExpiry($now->getTimestamp() + 60 * $day, $now)['status'] === TlsExpiryChecker::PASS, 'Healthy certificate must pass.');
tlsExpiryAssert(TlsExpiryChecker::evaluateExpiry($now->getTimestamp() + 20 * $day, $now)['status'] === TlsExpiryChecker::WARN, 'Certificate inside warning window must warn.');
tlsExpiryAssert(TlsExpiryChecker::evaluateExpiry($now->getTimestamp() + 7 * $day, $now)['status'] === TlsExpiryChecker::CRITICAL, 'Certificate at critical threshold must be critical.');
tlsExpiryAssert(TlsExpiryChecker::evaluateExpiry($now->getTimestamp() - 1, $now)['status'] === TlsExpiryChecker::EXPIRED, 'Expired certificate must fail closed.');
tlsExpiryAssert(TlsExpiryChecker::inspectCertificate(__DIR__ . '/missing-certificate.pem')['status'] === TlsExpiryChecker::ERROR, 'Unreadable certificate must be machine-readable error.');

fwrite(STDOUT, "TLS expiry checker assertions passed.\n");
