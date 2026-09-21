<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$policy = file_get_contents($root . '/shared/communications/CommunicationPolicy.php');
$repository = file_get_contents($root . '/shared/communications/CommunicationRepository.php');
$service = file_get_contents($root . '/shared/communications/CommunicationService.php');
$route = file_get_contents($root . '/modules/users/routes.php');
$profile = file_get_contents(dirname($root) . '/src/app/profile/ProfilePage.tsx');
$control = file_get_contents(dirname($root) . '/src/app/profile/components/MarketingEmailPreferenceControl.tsx');

foreach ([$policy, $repository, $service, $route, $profile, $control] as $source) {
    if (!is_string($source) || trim($source) === '') {
        throw new RuntimeException('Marketing preference contract source is missing.');
    }
}

foreach ([
    'CommunicationPolicy::CLASS_MARKETING',
    'CommunicationPolicy::CHANNEL_EMAIL',
    'findPreference(',
    'savePreference(',
    'marketingEmailPreference(',
    'updateMarketingEmailPreference(',
    'assertValidCsrfToken(',
    'E-mails de marketing e novidades',
    'TRANSACTIONAL',
    'CommunicationPolicy::CLASS_MARKETING',
    'CommunicationPolicy::CHANNEL_EMAIL',
    'profileService.updateMarketingEmailPreference',
    'MarketingEmailPreferenceControl',
] as $needle) {
    if (!str_contains((string) $repository . (string) $service . (string) $route . (string) $profile . (string) $control, $needle)) {
        throw new RuntimeException('Canonical Marketing preference contract is missing: ' . $needle);
    }
}

if (!str_contains((string) $policy, 'if ($deliveryClass === self::CLASS_TRANSACTIONAL)')) {
    throw new RuntimeException('Marketing opt-out must not block transactional communication.');
}
if (!str_contains((string) $profile, 'MarketingEmailPreferenceControl userId={currentUserKey}')
    || !str_contains((string) $control, 'mutationFn: profileService.updateMarketingEmailPreference')) {
    throw new RuntimeException('Profile UI is not bound to the canonical preference writer.');
}

echo "Marketing communication preference contract: PASS\n";
