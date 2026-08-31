<?php

declare(strict_types=1);

/**
 * Verifica o boundary tecnico do pedido de exclusao sem tocar em banco.
 * Os testes de mutacao de sessao continuam cobertos pelo ambiente de
 * integracao de auth; este contrato impede regressao para um fluxo parcial.
 */

function privacyDeletionRead(string $path): string
{
    $contents = file_get_contents($path);
    if (!is_string($contents)) {
        throw new RuntimeException("Unable to read {$path}");
    }

    return $contents;
}

function privacyDeletionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$authSession = privacyDeletionRead($base . '/shared/auth/AuthSession.php');
$jwtAuth = privacyDeletionRead($base . '/shared/auth/JWTAuth.php');
$authRepository = privacyDeletionRead($base . '/modules/auth/repositories/AuthRepository.php');
$authService = privacyDeletionRead($base . '/modules/auth/services/AuthService.php');
$authRoutes = privacyDeletionRead($base . '/modules/auth/routes.php');
$usersRoutes = privacyDeletionRead($base . '/modules/users/routes.php');
$usersService = privacyDeletionRead($base . '/modules/users/services/UsersService.php');
$usersRepository = privacyDeletionRead($base . '/modules/users/repositories/UsersRepository.php');

privacyDeletionAssert(
    str_contains($usersRoutes, 'REQUEST_METHOD'),
    'Delete route must inspect the HTTP method.'
);
privacyDeletionAssert(
    str_contains($usersRoutes, "Metodo nao suportado para exclusao de conta.")
        && str_contains($usersRoutes, "!== 'POST'"),
    'Account deletion must be POST-only.'
);
privacyDeletionAssert(
    str_contains($usersRoutes, 'verifyAuthenticatedUserPayload()')
        && str_contains($usersRoutes, 'ensureRecaptchaPassed'),
    'Account deletion must remain authenticated and protected by the existing anti-abuse boundary.'
);
privacyDeletionAssert(
    str_contains($usersService, 'revokeAllUserSessionFamilies')
        && str_contains($usersService, 'account_deletion_requested'),
    'Deletion requests must revoke every active session family.'
);
privacyDeletionAssert(
    str_contains($authSession, 'function revokeAllUserSessionFamilies')
        && str_contains($authSession, "WHERE user_id = :user_id")
        && str_contains($authSession, 'revokeSessionFamily('),
    'The shared auth boundary must revoke sessions without deleting auth history.'
);
privacyDeletionAssert(
    str_contains($authSession, 'u.deletion_requested_at')
        && str_contains($authSession, 'u.status AS user_status'),
    'Refresh lookups must carry account lifecycle state.'
);
privacyDeletionAssert(
    str_contains($jwtAuth, "account_deletion_requested")
        && str_contains($jwtAuth, 'deletion_requested_at'),
    'Access-token validation must reject accounts in the deletion flow.'
);
privacyDeletionAssert(
    str_contains($authService, 'assertUserCanAuthenticate')
        && str_contains($authService, "['deleted', 'pending_deletion']"),
    'Password and social authentication must reject deleted/deletion-pending accounts.'
);
privacyDeletionAssert(
    str_contains($authRepository, 'deletion_requested_at'),
    'Authentication repository must select the deletion marker.'
);
privacyDeletionAssert(
    str_contains($authRoutes, 'deletion_requested_at')
        && str_contains($authRoutes, 'user_status'),
    'Cookie session access must reject deletion-pending accounts.'
);
privacyDeletionAssert(
    str_contains($usersRepository, 'deletion_requested_at = NOW()'),
    'Deletion request must remain durable and idempotent through the existing marker.'
);

fwrite(STDOUT, "PrivacyAccountDeletionWiringTest: PASS\n");
