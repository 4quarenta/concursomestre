<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("TLS expiry checker is CLI-only.\n");
}

require_once __DIR__ . '/TlsExpiryChecker.php';

$options = getopt('', ['certificate:', 'warn-days::', 'critical-days::']);
$certificate = is_array($options) ? (string) ($options['certificate'] ?? '') : '';
$warningDays = is_array($options) && isset($options['warn-days']) ? (int) $options['warn-days'] : 30;
$criticalDays = is_array($options) && isset($options['critical-days']) ? (int) $options['critical-days'] : 7;

try {
    $result = TlsExpiryChecker::inspectCertificate($certificate, null, $warningDays, $criticalDays);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(($result['status'] ?? TlsExpiryChecker::ERROR) === TlsExpiryChecker::PASS ? 0 : 2);
} catch (Throwable $exception) {
    echo json_encode(['status' => TlsExpiryChecker::ERROR, 'ok' => false, 'error' => 'invalid_checker_configuration'], JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(2);
}
