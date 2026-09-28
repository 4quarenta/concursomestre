<?php

require_once __DIR__ . '/../modules/admin/validators/AdminSettingsValidator.php';

$validator = new AdminSettingsValidator();
$validator->assertRecaptchaActivationConfiguration(
    ['recaptchaEnabled' => true, 'recaptchaSiteKey' => 'site-key', 'recaptchaSecretKey' => 'new-secret'],
    '',
    false
);
$validator->assertRecaptchaActivationConfiguration(
    ['recaptchaEnabled' => true],
    'existing-site-key',
    true
);
$validator->assertRecaptchaActivationConfiguration(['recaptchaEnabled' => false], '', false);

foreach ([
    [['recaptchaEnabled' => true, 'recaptchaSiteKey' => 'site-key'], '', false],
    [['recaptchaEnabled' => true, 'recaptchaSiteKey' => ''], 'old-site-key', true],
] as [$payload, $existingSiteKey, $existingSecretConfigured]) {
    try {
        $validator->assertRecaptchaActivationConfiguration($payload, $existingSiteKey, $existingSecretConfigured);
        throw new RuntimeException('Expected incomplete reCAPTCHA configuration to be rejected.');
    } catch (InvalidArgumentException $error) {
        if (!str_contains($error->getMessage(), 'site key e a secret key')) {
            throw $error;
        }
    }
}

echo "RecaptchaAdminActivationConfigurationTest: PASS\n";
