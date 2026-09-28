<?php

require_once __DIR__ . '/../shared/utils/MailConfiguration.php';

$resend = applyMailProviderTransport([
    'smtpHost' => 'old.smtp.example',
    'smtpUser' => 'old-user',
    'smtpPass' => 'must-not-leak',
    'smtpPort' => 2525,
    'smtpSecure' => 'ssl',
], 'resend', 'resend-test-key');

if ($resend['smtpHost'] !== 'smtp.resend.com'
    || $resend['smtpUser'] !== 'resend'
    || $resend['smtpPass'] !== 'resend-test-key'
    || $resend['smtpPort'] !== 587
    || $resend['smtpSecure'] !== 'tls') {
    throw new RuntimeException('Resend transport must use its canonical host and isolated credential.');
}

$smtp = applyMailProviderTransport([
    'smtpHost' => 'custom.smtp.example',
    'smtpUser' => 'custom-user',
    'smtpPass' => 'custom-secret',
    'smtpPort' => 465,
    'smtpSecure' => 'ssl',
], 'smtp', 'resend-test-key');

if ($smtp['smtpHost'] !== 'custom.smtp.example'
    || $smtp['smtpUser'] !== 'custom-user'
    || $smtp['smtpPass'] !== 'custom-secret'
    || $smtp['smtpPort'] !== 465
    || $smtp['smtpSecure'] !== 'ssl') {
    throw new RuntimeException('Custom SMTP transport must remain unchanged.');
}

echo "Mail provider transport tests passed.\n";
