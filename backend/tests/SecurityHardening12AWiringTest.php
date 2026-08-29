<?php

function security12aAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$recaptcha = file_get_contents(__DIR__ . '/../shared/security/Recaptcha.php');
$settings = file_get_contents(__DIR__ . '/../modules/admin/services/AdminSettingsService.php');
$authRoutes = file_get_contents(__DIR__ . '/../modules/auth/routes.php');

security12aAssert(is_string($recaptcha), 'Recaptcha source must be readable.');
security12aAssert(is_string($settings), 'Admin settings source must be readable.');
security12aAssert(is_string($authRoutes), 'Auth routes source must be readable.');

security12aAssert(
    str_contains($recaptcha, "RECAPTCHA_SECRET_KEY")
        && !str_contains($recaptcha, "key_name = 'recaptchaSecretKey'"),
    'reCAPTCHA secret must resolve only from the protected environment.'
);
security12aAssert(
    str_contains($settings, '$envRecaptchaSecretKey')
        && str_contains($settings, "!empty(\$envRecaptchaSecretKey)"),
    'Admin settings must report reCAPTCHA configuration from the environment.'
);
security12aAssert(
    str_contains($authRoutes, "REQUEST_METHOD")
        && str_contains($authRoutes, "!== 'POST'")
        && str_contains($authRoutes, "'method_not_allowed'"),
    'Logout must reject unsafe GET requests.'
);

echo "SecurityHardening12AWiringTest: PASS\n";
