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

function assertSocialProviderCondition(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertSocialProviderContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

require_once 'C:/xampp/htdocs/questao-pro-backend/modules/admin/validators/AdminSettingsValidator.php';

$backendBase = 'C:/xampp/htdocs/questao-pro-backend';
$frontendBase = 'C:/dev/concursomestre';

$authService = $backendBase . '/modules/auth/services/AuthService.php';
$authRoutes = $backendBase . '/modules/auth/routes.php';
$authValidator = $backendBase . '/modules/auth/validators/AuthValidator.php';
$adminValidator = $backendBase . '/modules/admin/validators/AdminSettingsValidator.php';
$backendEnvExample = $backendBase . '/.env.production.example';
$frontendEnvExample = $frontendBase . '/.env.example';
$authPage = $frontendBase . '/src/app/auth/components/Auth.tsx';
$securityHeaders = $frontendBase . '/src/config/securityHeaders.ts';

assertSocialProviderContains(
    $backendBase . '/api/auth/facebook.php',
    'handleAuthFacebookRoute($db);',
    'Facebook endpoint must delegate to the auth module route.'
);

assertSocialProviderContains(
    $backendBase . '/api/auth/apple.php',
    'handleAuthAppleRoute($db);',
    'Apple endpoint must delegate to the auth module route.'
);

assertSocialProviderContains(
    $authRoutes,
    'function handleAuthFacebookRoute',
    'Auth routes must expose the Facebook handler.'
);

assertSocialProviderContains(
    $authRoutes,
    'function handleAuthAppleRoute',
    'Auth routes must expose the Apple handler.'
);

assertSocialProviderContains(
    $authPage,
    'src="https://connect.facebook.net/pt_BR/sdk.js"',
    'Frontend must load the official Facebook SDK only when configured.'
);

assertSocialProviderContains(
    $authPage,
    'src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"',
    'Frontend must load the official AppleID JS SDK only when configured.'
);

assertSocialProviderContains(
    $authPage,
    'startPendingSocialSignup(\'facebook\'',
    'Facebook login must fall back to the personal-data completion step when the account is missing.'
);

assertSocialProviderContains(
    $authPage,
    'startPendingSocialSignup(\'apple\'',
    'Apple login must fall back to the personal-data completion step when the account is missing.'
);

assertSocialProviderContains(
    $authService,
    'https://graph.facebook.com/debug_token',
    'Facebook backend must validate the access token through debug_token.'
);

assertSocialProviderContains(
    $authService,
    "Token do Facebook emitido para outro aplicativo.",
    'Facebook backend must reject tokens issued to another app.'
);

assertSocialProviderContains(
    $authService,
    "https://appleid.apple.com/auth/keys",
    'Apple backend must validate ID token signatures with Apple public keys.'
);

assertSocialProviderContains(
    $authService,
    "Token da Apple emitido para outro aplicativo.",
    'Apple backend must reject tokens issued to another client.'
);

assertSocialProviderContains(
    $authService,
    "Emissor da Apple invalido.",
    'Apple backend must validate the token issuer.'
);

assertSocialProviderContains(
    $authValidator,
    "validateFacebookPayload",
    'Auth validator must validate Facebook payloads before hitting provider APIs.'
);

assertSocialProviderContains(
    $authValidator,
    "validateApplePayload",
    'Auth validator must validate Apple payloads before hitting provider APIs.'
);

assertSocialProviderContains(
    $adminValidator,
    "validateFacebookAppId",
    'Admin settings validator must validate Facebook App ID format.'
);

assertSocialProviderContains(
    $adminValidator,
    "validateAppleClientId",
    'Admin settings validator must validate Apple Client ID format.'
);

assertSocialProviderContains(
    $securityHeaders,
    'https://connect.facebook.net',
    'Frontend CSP must allow the Facebook SDK origin.'
);

assertSocialProviderContains(
    $securityHeaders,
    'https://appleid.cdn-apple.com',
    'Frontend CSP must allow the AppleID SDK origin.'
);

assertSocialProviderContains(
    $backendEnvExample,
    'FACEBOOK_APP_ID=',
    'Production backend env example must document Facebook App ID.'
);

assertSocialProviderContains(
    $backendEnvExample,
    'APPLE_CLIENT_ID=',
    'Production backend env example must document Apple Client ID.'
);

assertSocialProviderContains(
    $frontendEnvExample,
    'NEXT_PUBLIC_FACEBOOK_APP_ID=',
    'Frontend env example must document Facebook App ID.'
);

assertSocialProviderContains(
    $frontendEnvExample,
    'NEXT_PUBLIC_APPLE_CLIENT_ID=',
    'Frontend env example must document Apple Client ID.'
);

$validator = new AdminSettingsValidator();
$valid = $validator->validateUpdatePayload([
    'facebookAuthAppId' => '123456789012345',
    'facebookAuthAppSecret' => 'secret-value',
    'appleAuthClientId' => 'com.concursomestre.web',
    'appleAuthRedirectUri' => 'https://app.concursomestre.com/auth',
]);

assertSocialProviderCondition($valid['facebookAuthAppId'] === '123456789012345', 'Validator should preserve valid Facebook App ID.');
assertSocialProviderCondition($valid['appleAuthClientId'] === 'com.concursomestre.web', 'Validator should preserve valid Apple Client ID.');
assertSocialProviderCondition($valid['appleAuthRedirectUri'] === 'https://app.concursomestre.com/auth', 'Validator should preserve valid Apple redirect URI.');

$invalidCases = [
    ['payload' => ['facebookAuthAppId' => 'abc'], 'message' => 'Facebook App ID invalido.'],
    ['payload' => ['appleAuthClientId' => 'https://apple.example'], 'message' => 'Apple Client ID invalido.'],
    ['payload' => ['appleAuthRedirectUri' => 'ftp://app.example/auth'], 'message' => 'Apple Redirect URI deve usar HTTP ou HTTPS.'],
];

foreach ($invalidCases as $case) {
    try {
        $validator->validateUpdatePayload($case['payload']);
    } catch (InvalidArgumentException $e) {
        assertSocialProviderCondition(
            $e->getMessage() === $case['message'],
            'Unexpected validation error: ' . $e->getMessage()
        );
        continue;
    }

    throw new RuntimeException('Expected validator to reject invalid social provider config: ' . json_encode($case['payload']));
}

fwrite(STDOUT, "Social auth providers wiring assertions passed.\n");
