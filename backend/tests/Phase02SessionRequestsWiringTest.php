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
    $projectRoot = dirname($base);
    $frontendRoot = is_file($projectRoot . '/src/app/dashboard/DashboardPage.tsx')
        ? $projectRoot
        : $projectRoot . '/frontend';

    phase02SessionAssertContains(
        $base . '/api/auth/me.php',
        'handleUsersAuthenticatedSessionRoute($db)',
        '/auth/me deve devolver DTO minimo de sessao.'
    );

    $authService = phase02SessionRead($base . '/modules/auth/services/AuthService.php');
    $authPayloadMethod = phase02SessionExtractMethod($authService, 'buildAuthenticatedSessionPayload');
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

    $usersService = phase02SessionRead($base . '/modules/users/services/UsersService.php');
    $sessionPayloadMethod = phase02SessionExtractMethod($usersService, 'getAuthenticatedSession');
    foreach (['cpf', 'phone', 'address', 'bankAccount', 'billing', 'googleId', 'facebookId', 'referralCode', 'twoFactorEnabled', 'isAdmin', 'isStaff', 'canAccessAdmin', 'planDisplayName', 'hasActivePlan', 'hasGoogleLinked', 'hasFacebookLinked', 'isPartner'] as $forbiddenSessionField) {
        phase02SessionAssertNotContains(
            $sessionPayloadMethod,
            "'" . $forbiddenSessionField . "' =>",
            'DTO de sessao nao pode serializar campo privado: ' . $forbiddenSessionField
        );
    }

    foreach (["'displayName' =>", "'avatarUrl' =>", "'permissions' =>", "'subscription' =>", "'gamification' =>", "'linkedProviders' =>", "'partnership' =>"] as $canonicalSessionField) {
        phase02SessionAssertContains(
            $base . '/modules/users/services/UsersService.php',
            $canonicalSessionField,
            'DTO de sessao deve conter o campo canônico: ' . $canonicalSessionField
        );
    }

    phase02SessionAssertContains(
        $base . '/api/users/me/comments.php',
        'handleCurrentUserCommentsRoute($db)',
        'Endpoint proprio de comentarios precisa usar rota autocontida.'
    );
    phase02SessionAssertContains(
        $base . '/api/users/me/answers.php',
        'handleCurrentUserAnswersRoute($db)',
        'Endpoint proprio de respostas precisa usar rota autocontida.'
    );

    foreach (['getCurrentUserComments', 'getCurrentUserAnswers'] as $methodName) {
        $method = phase02SessionExtractMethod($usersService, $methodName);
        phase02SessionAssertNotContains(
            $method,
            'resolveRequestedUserId',
            $methodName . ' nao pode resolver escopo com identificador do cliente.'
        );
        phase02SessionAssertNotContains(
            $method,
            'listUser',
            $methodName . ' nao pode delegar para metodo de escopo legado.'
        );
    }

    $dashboard = phase02SessionRead($frontendRoot . '/src/app/dashboard/DashboardPage.tsx');
    phase02SessionAssertNotContains(
        $dashboard,
        'getCurrentUserAnswers(240)',
        'Dashboard nao pode baixar centenas de respostas no primeiro carregamento.'
    );
    phase02SessionAssertContains(
        $frontendRoot . '/src/app/dashboard/DashboardPage.tsx',
        'getCurrentUserAnswersPage({ limit: 20, range: timeRange })',
        'Dashboard deve usar pagina curta e resumo server-side.'
    );
    phase02SessionAssertNotContains(
        $dashboard,
        'getCurrentUserAnswers(',
        'Dashboard nao pode depender do metodo legado que baixa historico integral.'
    );
    phase02SessionAssertNotContains(
        $dashboard,
        'getCurrentUserComments(',
        'Dashboard nao pode depender do metodo legado de comentarios.'
    );
    phase02SessionAssertContains(
        $frontendRoot . '/src/app/dashboard/DashboardPage.tsx',
        'getCurrentUserCommentsPage({ limit: 1, range: timeRange })',
        'Dashboard deve obter apenas o contador server-side de comentarios.'
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

    phase02SessionAssertContains(
        $base . '/shared/pagination/SignedKeysetCursor.php',
        'hash_hmac',
        'Cursores precisam ser assinados contra adulteracao.'
    );

    $session = phase02SessionRead($frontendRoot . '/src/services/auth/session.ts');
    $broadcastStart = strpos($session, 'interface AuthBroadcastEvent');
    $broadcastEnd = $broadcastStart === false ? false : strpos($session, 'export interface AuthSessionSnapshot', $broadcastStart);
    if ($broadcastStart === false || $broadcastEnd === false) {
        throw new RuntimeException('Contrato de evento entre abas nao encontrado.');
    }
    $broadcastContract = substr($session, $broadcastStart, $broadcastEnd - $broadcastStart);
    foreach (['accessToken', 'accessTokenExpMs', 'user?:'] as $forbiddenEventField) {
        phase02SessionAssertNotContains(
            $broadcastContract,
            $forbiddenEventField,
            'Evento entre abas nao pode transportar segredo ou perfil: ' . $forbiddenEventField
        );
    }

    fwrite(STDOUT, "Phase02SessionRequestsWiringTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Phase02SessionRequestsWiringTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
