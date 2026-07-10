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

function assertContainsSocialProfileCompletion(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$backendBase = 'C:/xampp/htdocs/questao-pro-backend';
$frontendBase = 'C:/dev/concursomestre';

$authService = $backendBase . '/modules/auth/services/AuthService.php';
$authValidator = $backendBase . '/modules/auth/validators/AuthValidator.php';
$authRoutes = $backendBase . '/modules/auth/routes.php';
$authPage = $frontendBase . '/src/app/auth/components/Auth.tsx';

assertContainsSocialProfileCompletion(
    $authPage,
    'createIfMissing: false',
    'Social login first attempt must not auto-create a local user before personal data is collected.'
);

assertContainsSocialProfileCompletion(
    $authPage,
    'startPendingSocialSignup(\'google\'',
    'Google login must switch to the pending personal-data form when the account does not exist.'
);

assertContainsSocialProfileCompletion(
    $authPage,
    ') : pendingSocialSignup ? (',
    'Pending social signup must render a dedicated form instead of mixing with password signup.'
);

assertContainsSocialProfileCompletion(
    $authPage,
    'Complete seus dados pessoais para criar a conta.',
    'Pending social signup copy must clearly request personal data before account creation.'
);

assertContainsSocialProfileCompletion(
    $authPage,
    'createIfMissing: true',
    'Social signup completion must explicitly allow user creation only after personal data is submitted.'
);

assertContainsSocialProfileCompletion(
    $authPage,
    'profile: {',
    'Social signup completion must send the personal-data profile payload.'
);

assertContainsSocialProfileCompletion(
    $authPage,
    'phone: normalizedPhone',
    'Social signup completion must send normalized phone to the backend.'
);

assertContainsSocialProfileCompletion(
    $authService,
    'Conta Google sem dados pessoais. Informe nome e telefone para concluir.',
    'Google backend must reject missing personal data before creating a new social user.'
);

assertContainsSocialProfileCompletion(
    $authService,
    'profile_required_message',
    'Facebook and Apple social flows must share the same personal-data completion guard.'
);

assertContainsSocialProfileCompletion(
    $authValidator,
    'Telefone invalido. Informe DDD + numero com 10 ou 11 digitos.',
    'Social auth validator must reject invalid phone numbers before account creation.'
);

assertContainsSocialProfileCompletion(
    $authRoutes,
    'Response::notFound($e->getMessage());',
    'Missing social account must be returned as not found so the frontend can collect profile data.'
);

fwrite(STDOUT, "Social auth profile completion wiring assertions passed.\n");
