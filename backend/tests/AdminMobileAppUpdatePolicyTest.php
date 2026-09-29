<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/admin/validators/AdminSettingsValidator.php';
require_once dirname(__DIR__) . '/modules/settings/services/PublicSettingsProjection.php';

function assertMobileAppPolicy(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertMobileAppPolicyRejects(callable $callback, string $expectedMessage): void
{
    try {
        $callback();
    } catch (InvalidArgumentException $error) {
        assertMobileAppPolicy(str_contains($error->getMessage(), $expectedMessage), 'Unexpected validation message: ' . $error->getMessage());
        return;
    }
    throw new RuntimeException('Invalid mobile app update policy should be rejected.');
}

$validator = new AdminSettingsValidator();
$valid = $validator->validateUpdatePayload([
    'mobileAppUpdatePolicy' => [
        'enabled' => true,
        'latestVersion' => '1.3.0',
        'minimumVersion' => '1.2.0',
        'message' => 'Atualize para continuar estudando.',
        'androidStoreUrl' => 'https://play.google.com/store/apps/details?id=com.concursomestre.mobile',
        'iosStoreUrl' => '',
    ],
]);
assertMobileAppPolicy($valid['mobileAppUpdatePolicy']['enabled'] === true, 'The enabled flag should be normalized.');
assertMobileAppPolicy($valid['mobileAppUpdatePolicy']['minimumVersion'] === '1.2.0', 'The minimum version should be preserved.');

assertMobileAppPolicyRejects(
    fn() => $validator->validateUpdatePayload(['mobileAppUpdatePolicy' => ['latestVersion' => '1.2']]),
    'Versao do aplicativo invalida'
);
assertMobileAppPolicyRejects(
    fn() => $validator->validateUpdatePayload(['mobileAppUpdatePolicy' => ['latestVersion' => '1.2.0', 'minimumVersion' => '1.3.0']]),
    'A versao minima nao pode ser superior'
);
assertMobileAppPolicyRejects(
    fn() => $validator->validateUpdatePayload(['mobileAppUpdatePolicy' => ['enabled' => true, 'minimumVersion' => '1.2.0']]),
    'Configure ao menos um link de loja'
);
assertMobileAppPolicyRejects(
    fn() => $validator->validateUpdatePayload(['mobileAppUpdatePolicy' => ['androidStoreUrl' => 'http://example.com/app']]),
    'deve usar HTTPS'
);

$public = PublicSettingsProjection::project([
    'mobileAppUpdatePolicy' => $valid['mobileAppUpdatePolicy'] + ['privateInternalNote' => 'must not leak'],
    'unrelatedSecret' => 'must not leak',
]);
assertMobileAppPolicy($public['mobileAppUpdatePolicy']['latestVersion'] === '1.3.0', 'The public projection should expose the sanitized update policy.');
assertMobileAppPolicy(!array_key_exists('privateInternalNote', $public['mobileAppUpdatePolicy']), 'The public update policy must be allowlisted.');
assertMobileAppPolicy(!array_key_exists('unrelatedSecret', $public), 'Unrelated settings must not be exposed.');

fwrite(STDOUT, "Mobile app update policy assertions passed.\n");
