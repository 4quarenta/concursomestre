<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function assertContainsAuthDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsAuthDelegate(
    $base . '/api/auth/login.php',
    'handleAuthLoginRoute',
    'Auth login endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/register.php',
    'handleAuthRegisterRoute',
    'Auth register endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/logout.php',
    'handleAuthLogoutRoute',
    'Auth logout endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/refresh.php',
    'handleAuthRefreshRoute',
    'Auth refresh endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/forgot-password.php',
    'handleAuthForgotPasswordRoute',
    'Auth forgot password endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/reset-password.php',
    'handleAuthResetPasswordRoute',
    'Auth reset password endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/resend-confirmation.php',
    'handleAuthResendConfirmationRoute',
    'Auth resend confirmation endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/confirm-email.php',
    'handleAuthConfirmEmailRoute',
    'Auth confirm email endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/setup_2fa.php',
    'handleAuthSetupTwoFactorRoute',
    'Auth setup 2FA endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/enable_2fa.php',
    'handleAuthEnableTwoFactorRoute',
    'Auth enable 2FA endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/api/auth/verify_2fa.php',
    'handleAuthVerifyTwoFactorRoute',
    'Auth verify 2FA endpoint must delegate to auth module routes'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthLoginRoute',
    'Auth routes must expose the login handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthRegisterRoute',
    'Auth routes must expose the register handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthLogoutRoute',
    'Auth routes must expose the logout handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthRefreshRoute',
    'Auth routes must expose the refresh handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthForgotPasswordRoute',
    'Auth routes must expose the forgot password handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthResetPasswordRoute',
    'Auth routes must expose the reset password handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthResendConfirmationRoute',
    'Auth routes must expose the resend confirmation handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthConfirmEmailRoute',
    'Auth routes must expose the confirm email handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthSetupTwoFactorRoute',
    'Auth routes must expose the setup 2FA handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthEnableTwoFactorRoute',
    'Auth routes must expose the enable 2FA handler'
);

assertContainsAuthDelegate(
    $base . '/modules/auth/routes.php',
    'function handleAuthVerifyTwoFactorRoute',
    'Auth routes must expose the verify 2FA handler'
);

fwrite(STDOUT, "Auth module wiring assertions passed.\n");
