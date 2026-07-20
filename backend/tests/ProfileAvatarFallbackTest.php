<?php

declare(strict_types=1);

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

function profileAvatarFallbackAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $servicePath = dirname(__DIR__) . '/modules/users/services/UsersService.php';
    $service = file_get_contents($servicePath);
    profileAvatarFallbackAssert(is_string($service), 'UsersService.php nao pode ser lido.');
    profileAvatarFallbackAssert(
        substr_count($service, "'avatarUrl' => \$this->resolveAvailableProfilePhotoUrl") === 2,
        'Perfil e sessao devem normalizar o avatar pelo mesmo resolver.'
    );
    profileAvatarFallbackAssert(
        str_contains($service, "str_starts_with(\$normalizedPath, 'uploads/profiles/')"),
        'O resolver deve limitar a verificacao fisica ao storage local de perfis.'
    );
    profileAvatarFallbackAssert(
        str_contains($service, 'return is_file($absolutePath) ? $normalizedUrl : null;'),
        'Caminhos locais ausentes devem ser serializados como null.'
    );

    fwrite(STDOUT, "ProfileAvatarFallbackTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'ProfileAvatarFallbackTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
