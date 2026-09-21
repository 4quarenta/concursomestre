<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/communications/CommunicationDeepLinkPolicy.php';

$policy = new CommunicationDeepLinkPolicy();
$allowed = [
    '/planos',
    '/planos?utm_campaign=m20f07',
    '/promo/synthetic-campaign',
];
foreach ($allowed as $link) {
    if ($policy->authorize($link, ['recipientUserId' => 'synthetic-user']) !== $link) {
        throw new RuntimeException('A public Marketing deep link was not preserved.');
    }
}

$denied = [
    '/admin/support/communications',
    'https://external.example.invalid/campaign',
    'javascript:alert(1)',
    '/notifications?user_id=other-user',
];
foreach ($denied as $link) {
    try {
        $policy->authorize($link, ['recipientUserId' => 'synthetic-user']);
    } catch (Throwable) {
        continue;
    }
    throw new RuntimeException('An unsafe or unauthorized deep link was accepted.');
}

echo json_encode([
    'allowed_marketing_routes' => count($allowed),
    'denied_unsafe_routes' => count($denied),
    'status' => 'PASS',
], JSON_THROW_ON_ERROR) . PHP_EOL;
