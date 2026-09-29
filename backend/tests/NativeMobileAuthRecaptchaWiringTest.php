<?php

declare(strict_types=1);

function assertNativeMobileAuthWiring(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$routes = file_get_contents(dirname(__DIR__) . '/modules/auth/routes.php');
if ($routes === false) {
    throw new RuntimeException('Auth routes source is not readable.');
}

$loginStart = strpos($routes, 'function handleAuthLoginRoute');
$registerStart = strpos($routes, 'function handleAuthRegisterRoute');
$googleStart = strpos($routes, 'function handleAuthGoogleRoute');
$forgotStart = strpos($routes, 'function handleAuthForgotPasswordRoute');
$resetStart = strpos($routes, 'function handleAuthResetPasswordRoute');
assertNativeMobileAuthWiring(
    $loginStart !== false && $registerStart !== false && $googleStart !== false
        && $forgotStart !== false && $resetStart !== false,
    'Expected authentication route boundaries are missing.'
);

$loginBlock = substr($routes, $loginStart, $registerStart - $loginStart);
$registerBlock = substr($routes, $registerStart, $googleStart - $registerStart);
$forgotBlock = substr($routes, $forgotStart, $resetStart - $forgotStart);
$resetBlock = substr($routes, $resetStart, strpos($routes, 'function handleAuth', $resetStart + 1) - $resetStart);

assertNativeMobileAuthWiring(
    substr_count($loginBlock, "'nativeMobileAuthExempt' => isNativeMobileAuthRequest()") === 1,
    'Login must opt into the narrowly scoped native exemption.'
);
assertNativeMobileAuthWiring(
    substr_count($registerBlock, "'nativeMobileAuthExempt' => isNativeMobileAuthRequest()") === 1,
    'Registration must opt into the narrowly scoped native exemption.'
);
assertNativeMobileAuthWiring(
    !str_contains($forgotBlock, 'nativeMobileAuthExempt'),
    'Password recovery must not opt into the native exemption.'
);
assertNativeMobileAuthWiring(
    !str_contains($resetBlock, 'nativeMobileAuthExempt'),
    'Password reset must not opt into the native exemption.'
);
assertNativeMobileAuthWiring(
    str_contains($loginBlock, "RateLimiter::enforceProfile('auth_login')")
        && str_contains($loginBlock, "RateLimiter::enforceProfile('auth_login_subject'")
        && str_contains($registerBlock, "RateLimiter::enforceProfile('auth_register')")
        && str_contains($registerBlock, "RateLimiter::enforceProfile('auth_register_subject'")
        && str_contains($forgotBlock, "RateLimiter::enforceProfile('auth_password')"),
    'IP/account rate limits must remain on the affected auth flows.'
);

fwrite(STDOUT, "Native mobile auth reCAPTCHA wiring assertions passed.\n");
