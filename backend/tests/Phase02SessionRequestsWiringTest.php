<?php

declare(strict_types=1);

function phase02SessionRead(string $path): string
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $path);
    }

    return $content;
}

function phase02SessionAssertContains(string $path, string $needle, string $message): void
{
    if (strpos(phase02SessionRead($path), $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function phase02SessionAssertNotContains(string $content, string $needle, string $message): void
{
    if (strpos($content, $needle) !== false) {
        throw new RuntimeException($message);
    }
}

function phase02SessionExtractMethod(string $content, string $methodName): string
{
    $needle = 'function ' . $methodName . '(';
    $start = strpos($content, $needle);
    if ($start === false) {
        throw new RuntimeException('Metodo ausente: ' . $methodName);
    }

    $brace = strpos($content, '{', $start);
    if ($brace === false) {
        throw new RuntimeException('Metodo sem bloco: ' . $methodName);
    }

    $depth = 0;
    $length = strlen($content);
    for ($index = $brace; $index < $length; $index++) {
        $char = $content[$index];
        if ($char === '{') {
            $depth++;
        } elseif ($char === '}') {
            $depth--;
            if ($depth === 0) {
                return substr($content, $start, $index - $start + 1);
            }
        }
    }

    throw new RuntimeException('Metodo nao fechado: ' . $methodName);
}

try {
    $base = dirname(__DIR__);

    phase02SessionAssertContains(
        $base . '/api/auth/me.php',
        'handleUsersAuthenticatedSessionRoute($db)',
        '/auth/me deve devolver DTO minimo de sessao.'
    );

    $authService = phase02SessionRead($base . '/modules/auth/services/AuthService.php');
    $authPayloadMethod = phase02SessionExtractMethod($authService, 'buildAuthenticatedUserPayload');
    phase02SessionAssertNotContains(
        $authPayloadMethod,
        'getAuthenticatedProfile($userId)',
        'Login/refresh nao devem montar perfil completo no payload de sessao.'
    );
    phase02SessionAssertContains(
        $base . '/modules/auth/services/AuthService.php',
        'getAuthenticatedSession($userId)',
        'Login/refresh devem usar o DTO minimo de sessao.'
    );

    $usersRepository = phase02SessionRead($base . '/modules/users/repositories/UsersRepository.php');
    $sessionMethod = phase02SessionExtractMethod($usersRepository, 'findSessionRowById');
    foreach (['cpf', 'phone', 'address', 'bank', 'billing'] as $sensitiveNeedle) {
        phase02SessionAssertNotContains(
            strtolower($sessionMethod),
            $sensitiveNeedle,
            'DTO minimo de sessao nao deve selecionar dado sensivel: ' . $sensitiveNeedle
        );
    }

    phase02SessionAssertContains(
        $base . '/api/users/me/comments.php',
        "unset(\$_GET['user_id'], \$_GET['userId']);",
        'Endpoint proprio de comentarios nao deve aceitar user_id do cliente.'
    );
    phase02SessionAssertContains(
        $base . '/api/users/me/answers.php',
        "unset(\$_GET['user_id'], \$_GET['userId']);",
        'Endpoint proprio de respostas nao deve aceitar user_id do cliente.'
    );

    phase02SessionAssertContains(
        $base . '/modules/notifications/validators/NotificationsValidator.php',
        "'limit' => max(1, min(\$limit, 50))",
        'Notificacoes devem usar limite padrao 10 e maximo 50.'
    );
    phase02SessionAssertContains(
        $base . '/modules/notifications/services/NotificationsService.php',
        "'unreadCount' => \$this->repository->countUnreadByUserId(\$authenticatedUserId)",
        'Listagem de notificacoes deve devolver unreadCount sem carregar tudo para badge.'
    );

    fwrite(STDOUT, "Phase02SessionRequestsWiringTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Phase02SessionRequestsWiringTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
