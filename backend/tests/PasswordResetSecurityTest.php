<?php

declare(strict_types=1);

function assertPasswordResetSecurityContains(string $source, string $needle, string $message): void
{
    if (strpos($source, $needle) === false) {
        throw new RuntimeException($message);
    }
}

$source = file_get_contents(dirname(__DIR__) . '/modules/auth/services/AuthService.php');
if (!is_string($source)) {
    throw new RuntimeException('Nao foi possivel ler o AuthService.');
}

assertPasswordResetSecurityContains(
    $source,
    "'message' => 'Se este e-mail estiver cadastrado, voce recebera as instrucoes em breve.'",
    'Forgot-password must use a non-enumerating response for unknown addresses.'
);
assertPasswordResetSecurityContains(
    $source,
    "revokeAllUserSessionFamilies(",
    'Successful password reset must revoke existing session families.'
);
assertPasswordResetSecurityContains(
    $source,
    "'password_reset'",
    'Password-reset session revocation must have an explicit audit reason.'
);

fwrite(STDOUT, "Password-reset security assertions passed.\n");
