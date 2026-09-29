<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/security/Recaptcha.php';

function assertNativeMobileAuthExemption(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

assertNativeMobileAuthExemption(
    isNativeMobileAuthRecaptchaExemptFlow([
        'action' => 'auth_login',
        'nativeMobileAuthExempt' => true,
    ], null),
    'Native mobile login without a token should be exempt.'
);
assertNativeMobileAuthExemption(
    isNativeMobileAuthRecaptchaExemptFlow([
        'action' => 'auth_register',
        'nativeMobileAuthExempt' => true,
    ], ''),
    'Native mobile registration without a token should be exempt.'
);
assertNativeMobileAuthExemption(
    !isNativeMobileAuthRecaptchaExemptFlow([
        'action' => 'auth_login',
        'nativeMobileAuthExempt' => false,
    ], null),
    'Web login must not be exempt.'
);
assertNativeMobileAuthExemption(
    !isNativeMobileAuthRecaptchaExemptFlow([
        'action' => 'auth_forgot_password',
        'nativeMobileAuthExempt' => true,
    ], null),
    'Password recovery must not be exempt.'
);
assertNativeMobileAuthExemption(
    !isNativeMobileAuthRecaptchaExemptFlow([
        'action' => 'auth_login',
        'nativeMobileAuthExempt' => true,
    ], 'provided-token'),
    'A provided mobile token must still be validated.'
);

fwrite(STDOUT, "Native mobile auth reCAPTCHA exemption assertions passed.\n");
