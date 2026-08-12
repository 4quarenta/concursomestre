<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/settings/services/PublicSettingsProjection.php';

function assertPublicSettingsContract(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function collectPublicSettingsKeys(array $value, array &$keys): void
{
    foreach ($value as $key => $item) {
        if (is_string($key)) {
            $keys[] = strtolower($key);
        }
        if (is_array($item)) {
            collectPublicSettingsKeys($item, $keys);
        }
    }
}

$projection = PublicSettingsProjection::project([
    'appName' => 'ConcursoMestre',
    'platformVersion' => '1.0.0',
    'stripePublishableKey' => 'pk_test_public',
    'stripeSecretKey' => 'sk_live_secret',
    'geminiApiKey' => 'gemini-secret',
    'openaiApiKey' => 'openai-secret',
    'smtpPass' => 'smtp-secret',
    'adminUserId' => 'admin-private-id',
    'setup' => ['adminUserId' => 'nested-private-id', 'token' => 'private-token'],
    'features' => [
        'practiceEnabled' => true,
        'marketplaceEnabled' => false,
        'supportDonationsEnabled' => false,
        'futureSecretFlag' => 'must-not-cross-the-boundary',
    ],
    'landingPages' => [
        ['id' => 'published', 'status' => 'published', 'title' => 'Publicada'],
        ['id' => 'draft', 'status' => 'draft', 'title' => 'Rascunho interno'],
    ],
    'coupons' => [
        [
            'code' => 'PUBLIC20',
            'discountPercentage' => 20,
            'autoApply' => true,
            'targetType' => 'all',
            'allowedUserIds' => [],
            'allowedUserEmails' => [],
        ],
        [
            'code' => 'PRIVATE50',
            'discountPercentage' => 50,
            'autoApply' => true,
            'allowedUserIds' => ['private-user-id'],
            'allowedUserEmails' => ['private@example.com'],
        ],
    ],
]);

assertPublicSettingsContract(
    array_keys($projection) === [
        'contractVersion',
        'branding',
        'features',
        'plans',
        'commerce',
        'marketing',
        'advertising',
        'authentication',
        'analytics',
        'content',
        'engagement',
    ],
    'Public settings top-level contract changed unexpectedly.'
);
assertPublicSettingsContract($projection['contractVersion'] === 'public-settings.v1', 'Contract version is invalid.');
assertPublicSettingsContract(($projection['branding']['platformVersion'] ?? null) === '1.0.0', 'Platform version is missing.');
assertPublicSettingsContract(($projection['features']['practiceEnabled'] ?? null) === true, 'Allowed feature is missing.');
assertPublicSettingsContract(($projection['features']['supportDonationsEnabled'] ?? null) === false, 'Support donations feature is missing.');
assertPublicSettingsContract(!array_key_exists('futureSecretFlag', $projection['features']), 'Unknown feature leaked.');

$defaultProjection = PublicSettingsProjection::project([]);
assertPublicSettingsContract(
    ($defaultProjection['features']['supportDonationsEnabled'] ?? null) === true,
    'Support donations must remain enabled for installations without the persisted setting.'
);
assertPublicSettingsContract(count($projection['marketing']['landingPages'] ?? []) === 1, 'Draft landing page leaked.');
assertPublicSettingsContract(count($projection['marketing']['coupons'] ?? []) === 1, 'Private coupon leaked.');
assertPublicSettingsContract(($projection['marketing']['coupons'][0]['code'] ?? null) === 'PUBLIC20', 'Public coupon is missing.');

$keys = [];
collectPublicSettingsKeys($projection, $keys);
foreach ([
    'stripesecretkey',
    'geminiapikey',
    'openaiapikey',
    'smtppass',
    'adminuserid',
    'setup',
    'token',
    'alloweduserids',
    'alloweduseremails',
] as $forbiddenKey) {
    assertPublicSettingsContract(!in_array($forbiddenKey, $keys, true), "Forbidden public key leaked: {$forbiddenKey}");
}

fwrite(STDOUT, "Public settings projection contract assertions passed.\n");
