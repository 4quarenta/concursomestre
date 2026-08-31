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

require_once __DIR__ . '/JWTAuth.php';
require_once __DIR__ . '/AuthConfig.php';
require_once __DIR__ . '/AuthCookies.php';
require_once __DIR__ . '/AuthLogger.php';
require_once __DIR__ . '/../database/SchemaReadiness.php';
require_once __DIR__ . '/../observability/RuntimeMutationEvidence.php';

/**
 * Garante que as tabelas de sessão e refresh token existam antes de operar auth.
 * Centraliza o bootstrap do storage usado por login, refresh e logout.
 *
 * @since 1.0.0
 */
function ensureAuthTables(PDO $db): void
{
    SchemaReadiness::assertTablesAndColumns($db, 'autenticacao', [
        'auth_sessions' => ['id', 'user_id', 'status', 'csrf_token_hash', 'expires_at'],
        'auth_refresh_tokens' => ['id', 'session_id', 'token_hash', 'status', 'expires_at'],
    ]);
}

/**
 * Extrai o bearer token da request aceitando cabeçalho Authorization e legado X_AUTH_TOKEN.
 * Serve como ponto unico para resolver credenciais enviadas pelo frontend ou scripts antigos.
 *
 * @since 1.0.0
 */
function getBearerTokenFromRequest(): string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

    if (!$authHeader && !empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        $authHeader = 'Bearer ' . $_SERVER['HTTP_X_AUTH_TOKEN'];
    }

    if (preg_match('/Bearer\s+(.+)/i', (string) $authHeader, $matches)) {
        return trim($matches[1]);
    }

    return '';
}

/**
 * Cria a linha base da sessão autenticada e devolve o id usado pelos tokens emitidos.
 * O registro vira a ancora para heartbeat, revogacao em familia e auditoria de auth.
 *
 * @since 1.0.0
 */
function createAuthSessionRow(PDO $db, string $userId, string $csrfToken, string $runtimeEvent = 'auth_login'): array
{
    ensureAuthTables($db);

    $sessionId = createAuthUuid();
    $now = authNow();
    $expiresAt = $now->modify('+' . getAuthRefreshTokenTtlSeconds() . ' seconds');

    $stmt = $db->prepare(
        "INSERT INTO auth_sessions (
            id, user_id, status, csrf_token_hash, user_agent, ip_address, issuer_host,
            created_at, updated_at, last_seen_at, last_refreshed_at, expires_at
        ) VALUES (
            :id, :user_id, 'active', :csrf_token_hash, :user_agent, :ip_address, :issuer_host,
            :created_at, :updated_at, :last_seen_at, :last_refreshed_at, :expires_at
        )"
    );
    $stmt->execute([
        ':id' => $sessionId,
        ':user_id' => $userId,
        ':csrf_token_hash' => hashOpaqueToken($csrfToken),
        ':user_agent' => getAuthUserAgent(),
        ':ip_address' => getAuthClientIp(),
        ':issuer_host' => getAuthInstanceId(),
        ':created_at' => formatAuthDate($now),
        ':updated_at' => formatAuthDate($now),
        ':last_seen_at' => formatAuthDate($now),
        ':last_refreshed_at' => formatAuthDate($now),
        ':expires_at' => formatAuthDate($expiresAt),
    ]);
    RuntimeMutationEvidence::record('auth_sessions', 'INSERT', 'http-auth-account', $runtimeEvent, 1);

    return [
        'id' => $sessionId,
        'expires_at' => $expiresAt,
    ];
}

/**
 * Persiste um refresh token da familia atual e encadeia a rotacao quando existir token anterior.
 * Essa funcao e o elo entre a sessão HTTP e a estrategia de rotacao/reuse detection.
 *
 * @since 1.0.0
 */
function persistRefreshToken(PDO $db, string $sessionId, string $refreshToken, DateTimeImmutable $expiresAt, ?string $previousTokenId = null, string $runtimeEvent = 'auth_login'): array
{
    $tokenId = createAuthUuid();
    $now = authNow();

    $stmt = $db->prepare(
        "INSERT INTO auth_refresh_tokens (
            id, session_id, token_hash, previous_token_id, status, created_at, expires_at, ip_address, user_agent
        ) VALUES (
            :id, :session_id, :token_hash, :previous_token_id, 'active', :created_at, :expires_at, :ip_address, :user_agent
        )"
    );
    $stmt->execute([
        ':id' => $tokenId,
        ':session_id' => $sessionId,
        ':token_hash' => hashOpaqueToken($refreshToken),
        ':previous_token_id' => $previousTokenId,
        ':created_at' => formatAuthDate($now),
        ':expires_at' => formatAuthDate($expiresAt),
        ':ip_address' => getAuthClientIp(),
        ':user_agent' => getAuthUserAgent(),
    ]);
    RuntimeMutationEvidence::record('auth_refresh_tokens', 'INSERT', 'http-auth-account', $runtimeEvent, 1);

    if ($previousTokenId) {
        $updatePrevious = $db->prepare(
            "UPDATE auth_refresh_tokens
             SET status = 'rotated',
                 rotated_at = :rotated_at,
                 revoked_at = :revoked_at,
                 revoked_reason = 'rotated',
                 rotated_to_token_id = :rotated_to_token_id
             WHERE id = :id"
        );
        $updatePrevious->execute([
            ':rotated_at' => formatAuthDate($now),
            ':revoked_at' => formatAuthDate($now),
            ':rotated_to_token_id' => $tokenId,
            ':id' => $previousTokenId,
        ]);
        RuntimeMutationEvidence::record('auth_refresh_tokens', 'UPDATE', 'http-auth-account', $runtimeEvent);
    }

    return [
        'id' => $tokenId,
        'token' => $refreshToken,
        'expires_at' => $expiresAt,
    ];
}

/**
 * Atualiza atividade da sessão para acesso comum ou refresh, renovando expiracao quando preciso.
 * Ajuda a rastrear "ultima vez visto" e mantem a sessão coerente com a janela de refresh.
 *
 * @since 1.0.0
 */
function updateSessionHeartbeat(PDO $db, string $sessionId, bool $isRefresh = false): void
{
    $now = authNow();
    $fields = [
        'updated_at = :updated_at',
        'last_seen_at = :last_seen_at',
    ];

    if ($isRefresh) {
        $fields[] = 'last_refreshed_at = :last_refreshed_at';
        $fields[] = 'expires_at = :expires_at';
    }

    $query = "UPDATE auth_sessions SET " . implode(', ', $fields) . " WHERE id = :id";
    $stmt = $db->prepare($query);
    $params = [
        ':updated_at' => formatAuthDate($now),
        ':last_seen_at' => formatAuthDate($now),
        ':id' => $sessionId,
    ];

    if ($isRefresh) {
        $params[':last_refreshed_at'] = formatAuthDate($now);
        $params[':expires_at'] = formatAuthDate($now->modify('+' . getAuthRefreshTokenTtlSeconds() . ' seconds'));
    }

    $stmt->execute($params);
    RuntimeMutationEvidence::record(
        'auth_sessions',
        'UPDATE',
        'http-auth-account',
        $isRefresh ? 'auth_token_refresh' : 'auth_session_heartbeat'
    );
}

/**
 * Monta o access token JWT a partir do usuário autenticado e da sessão ativa.
 * O payload resultante amarra a sessão do banco ao token entregue para o site/app.
 *
 * @since 1.0.0
 */
function buildAccessToken(array $user, string $sessionId, ?int $expiresIn = null): string
{
    $ttl = $expiresIn ?? getAuthAccessTokenTtlSeconds();
    $now = time();

    return JWTAuth::encode([
        'user_id' => (string) $user['id'],
        'email' => (string) ($user['email'] ?? ''),
        'role' => (string) ($user['role'] ?? ''),
        'session_id' => $sessionId,
        'host' => getAuthInstanceId(),
        'issued_server_time' => $now,
    ], $ttl);
}

/**
 * Emite o pacote completo de autenticação de um usuário: sessão, access token, refresh e CSRF.
 * E o ponto usado pelo login e por fluxos que precisam estabelecer a sessão final do site.
 *
 * @since 1.0.0
 */
function issueUserAuthBundle(
    PDO $db,
    array $user,
    bool $exposeRefreshToken = false,
    string $runtimeEvent = 'auth_login',
    bool $setBrowserCookies = true
): array
{
    $csrfToken = createOpaqueAuthToken(24);
    $session = createAuthSessionRow($db, (string) $user['id'], $csrfToken, $runtimeEvent);
    $refreshToken = createOpaqueAuthToken(48);
    $refresh = persistRefreshToken($db, $session['id'], $refreshToken, $session['expires_at'], null, $runtimeEvent);
    $accessToken = buildAccessToken($user, $session['id']);

    if ($setBrowserCookies) {
        setRefreshTokenCookie($refresh['token'], $refresh['expires_at']);
        setCsrfCookie($csrfToken, $session['expires_at']);
    }

    logAuthEvent('auth_session_created', [
        'user_id' => $user['id'] ?? null,
        'session_id' => $session['id'],
        'access_expires_at' => date(DateTimeInterface::ATOM, time() + getAuthAccessTokenTtlSeconds()),
        'refresh_expires_at' => $refresh['expires_at'],
    ]);

    $bundle = [
        'token' => $accessToken,
        'session_id' => $session['id'],
        'csrf_token' => $csrfToken,
        'access_expires_in' => getAuthAccessTokenTtlSeconds(),
        'refresh_expires_at' => $refresh['expires_at']->format(DateTimeInterface::ATOM),
    ];

    if ($exposeRefreshToken) {
        $bundle['refresh_token'] = $refresh['token'];
    }

    return $bundle;
}

/**
 * Verifica o access token atual, registra rejeicoes e atualiza o heartbeat da sessão.
 * Devolve apenas payloads validos e ativos, servindo de base para middlewares e rotas protegidas.
 *
 * @since 1.0.0
 */
function verifyAuthenticatedSession(PDO $db, string $token): ?array
{
    ensureAuthTables($db);

    $result = JWTAuth::verifyDetailed($token, ['db' => $db]);
    if (!$result['valid']) {
        logAuthEvent('access_token_rejected', [
            'reason' => $result['reason'],
            // Nunca registrar JWT bruto, prefixo ou payload: logs possuem vida
            // longa e nao podem se tornar um repositorio de credenciais.
            'has_token' => $token !== '',
        ]);
        return null;
    }

    $payload = $result['payload'];
    updateSessionHeartbeat($db, (string) $payload['session_id']);
    return $payload;
}

/**
 * Resolve a sessão completa a partir do access token, combinando payload JWT e linha do banco.
 * Isso facilita validacoes que dependem tanto do token quanto do estado persistido da sessão.
 *
 * @since 1.0.0
 */
function getAuthenticatedSessionFromAccessToken(PDO $db, string $token): ?array
{
    $payload = verifyAuthenticatedSession($db, $token);
    if (!$payload) {
        return null;
    }

    $stmt = $db->prepare(
        "SELECT id, user_id, status, csrf_token_hash, expires_at, revoked_at
         FROM auth_sessions
         WHERE id = :id
         LIMIT 1"
    );
    $stmt->execute([':id' => $payload['session_id']]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        return null;
    }

    return [
        'payload' => $payload,
        'session' => $session,
    ];
}

/**
 * Revoga toda a familia de refresh tokens de uma sessão e opcionalmente marca reuse detection.
 * E o mecanismo central para logout, expiracao, mismatch de CSRF e reutilizacao indevida.
 *
 * @since 1.0.0
 */
function revokeSessionFamily(PDO $db, string $sessionId, string $reason, bool $markReuse = false): void
{
    ensureAuthTables($db);

    $now = authNow();
    $nowString = formatAuthDate($now);

    $sessionUpdate = $db->prepare(
        "UPDATE auth_sessions
         SET status = :status,
             revoked_at = :revoked_at,
             revoked_reason = :revoked_reason,
             reuse_detected_at = CASE WHEN :mark_reuse = 1 THEN :reuse_detected_at ELSE reuse_detected_at END,
             updated_at = :updated_at
         WHERE id = :id"
    );
    $sessionUpdate->execute([
        ':status' => $markReuse ? 'reuse_detected' : 'revoked',
        ':revoked_at' => $nowString,
        ':revoked_reason' => $reason,
        ':mark_reuse' => $markReuse ? 1 : 0,
        ':reuse_detected_at' => $nowString,
        ':updated_at' => $nowString,
        ':id' => $sessionId,
    ]);
    $runtimeEvent = $reason === 'logout' ? 'auth_logout' : 'auth_session_revoked';
    RuntimeMutationEvidence::record('auth_sessions', 'UPDATE', 'http-auth-account', $runtimeEvent);

    $tokenUpdate = $db->prepare(
        "UPDATE auth_refresh_tokens
         SET status = :status,
             revoked_at = :revoked_at,
             revoked_reason = :revoked_reason,
             reuse_detected_at = CASE WHEN :mark_reuse = 1 THEN :reuse_detected_at ELSE reuse_detected_at END
         WHERE session_id = :session_id
           AND revoked_at IS NULL"
    );
    $tokenUpdate->execute([
        ':status' => $markReuse ? 'reuse_detected' : 'revoked',
        ':revoked_at' => $nowString,
        ':revoked_reason' => $reason,
        ':mark_reuse' => $markReuse ? 1 : 0,
        ':reuse_detected_at' => $nowString,
        ':session_id' => $sessionId,
    ]);
    RuntimeMutationEvidence::record('auth_refresh_tokens', 'UPDATE', 'http-auth-account', $runtimeEvent);
}

/**
 * Revoga todas as sessoes ativas de um usuario sem apagar o historico de auth.
 * A operacao e usada quando a conta entra em fluxo de exclusao para impedir
 * que outra sessao continue acessando dados enquanto a solicitacao e tratada.
 *
 * @since 1.0.0
 */
function revokeAllUserSessionFamilies(PDO $db, string $userId, string $reason = 'account_deletion_requested'): int
{
    ensureAuthTables($db);

    $stmt = $db->prepare(
        "SELECT id
         FROM auth_sessions
         WHERE user_id = :user_id
           AND status = 'active'"
    );
    $stmt->execute([':user_id' => $userId]);
    $sessionIds = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

    foreach ($sessionIds as $sessionId) {
        revokeSessionFamily($db, (string) $sessionId, $reason);
    }

    return count($sessionIds);
}

/**
 * Localiza o refresh token persistido e traz junto o estado atual da sessão associada.
 * Essa consulta sustenta refresh, logout e investigacoes de erro no fluxo de auth.
 *
 * @since 1.0.0
 */
function findRefreshTokenRecord(PDO $db, string $refreshToken): ?array
{
    ensureAuthTables($db);

    $tokenHash = hashOpaqueToken($refreshToken);
    $stmt = $db->prepare(
        "SELECT rt.*, s.user_id, s.status AS session_status, s.revoked_at AS session_revoked_at, s.expires_at AS session_expires_at, s.csrf_token_hash,
                u.status AS user_status, u.deletion_requested_at
         FROM auth_refresh_tokens rt
         JOIN auth_sessions s ON s.id = rt.session_id
         JOIN users u ON u.id = s.user_id
         WHERE rt.token_hash = :token_hash
         LIMIT 1"
    );
    $stmt->execute([':token_hash' => $tokenHash]);

    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    return $record ?: null;
}

/**
 * Busca um refresh token ja persistido pelo id interno, mantendo o mesmo join de sessao.
 * Isso permite seguir a cadeia de rotacao quando duas requisicoes concorrem na mesma familia.
 *
 * @since 1.0.0
 */
function findRefreshTokenRecordById(PDO $db, string $refreshTokenId): ?array
{
    ensureAuthTables($db);

    $stmt = $db->prepare(
        "SELECT rt.*, s.user_id, s.status AS session_status, s.revoked_at AS session_revoked_at, s.expires_at AS session_expires_at, s.csrf_token_hash,
                u.status AS user_status, u.deletion_requested_at
         FROM auth_refresh_tokens rt
         JOIN auth_sessions s ON s.id = rt.session_id
         JOIN users u ON u.id = s.user_id
         WHERE rt.id = :id
         LIMIT 1"
    );
    $stmt->execute([':id' => $refreshTokenId]);

    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    return $record ?: null;
}

/**
 * Compara IP e user-agent atuais com o fingerprint do refresh token persistido.
 * A comparacao e relaxada quando algum lado nao tem dado, mas protege contra reuse distante.
 *
 * @since 1.0.0
 */
function matchesRefreshRequestFingerprint(array $record): bool
{
    $requestIp = trim((string) (getAuthClientIp() ?? ''));
    $recordIp = trim((string) ($record['ip_address'] ?? ''));
    $requestUserAgent = trim((string) (getAuthUserAgent() ?? ''));
    $recordUserAgent = trim((string) ($record['user_agent'] ?? ''));

    $ipMatches = $requestIp === '' || $recordIp === '' || hash_equals($recordIp, $requestIp);
    $userAgentMatches = $requestUserAgent === '' || $recordUserAgent === '' || hash_equals($recordUserAgent, $requestUserAgent);

    return $ipMatches && $userAgentMatches;
}

/**
 * Segue a cadeia de rotacao em uma janela curta para recuperar concorrencia legitima.
 * Isso evita marcar reuse quando duas requisicoes quase simultaneas usam o token antigo.
 *
 * @since 1.0.0
 */
function recoverRotatedRefreshTokenRecord(PDO $db, array $record, DateTimeImmutable $now): ?array
{
    $graceSeconds = getAuthRefreshReuseGraceSeconds();
    if ($graceSeconds < 1 || !matchesRefreshRequestFingerprint($record)) {
        return null;
    }

    $currentRecord = $record;
    for ($depth = 0; $depth < 5; $depth++) {
        $status = strtolower((string) ($currentRecord['status'] ?? ''));
        if ($status !== 'rotated' || !empty($currentRecord['revoked_at'])) {
            return null;
        }

        $rotatedAtRaw = trim((string) ($currentRecord['rotated_at'] ?? ''));
        $rotatedAtTs = $rotatedAtRaw !== '' ? strtotime($rotatedAtRaw) : false;
        if ($rotatedAtTs === false || ($now->getTimestamp() - $rotatedAtTs) > $graceSeconds) {
            return null;
        }

        $nextTokenId = trim((string) ($currentRecord['rotated_to_token_id'] ?? ''));
        if ($nextTokenId === '') {
            return null;
        }

        $nextRecord = findRefreshTokenRecordById($db, $nextTokenId);
        if (!$nextRecord || (string) ($nextRecord['session_id'] ?? '') !== (string) ($record['session_id'] ?? '')) {
            return null;
        }

        if (!matchesRefreshRequestFingerprint($nextRecord)) {
            return null;
        }

        if (empty($nextRecord['revoked_at']) && strtolower((string) ($nextRecord['status'] ?? '')) === 'active') {
            return $nextRecord;
        }

        $currentRecord = $nextRecord;
    }

    return null;
}

/**
 * Rotaciona um refresh token valido, emite novo access token e protege contra reuse/CSRF mismatch.
 * E a implementacao principal do refresh seguro usado pelo frontend para renovar sessão.
 *
 * @since 1.0.0
 */
function refreshAccessTokenUsingToken(
    PDO $db,
    string $refreshToken,
    string $csrfCookie,
    string $csrfHeader,
    bool $setBrowserCookies = true
): array
{
    ensureAuthTables($db);

    if (!$refreshToken) {
        throw new RuntimeException('Refresh token ausente.');
    }

    if (!assertValidCsrfToken($csrfCookie, $csrfHeader)) {
        logAuthEvent('refresh_csrf_rejected', [
            'cookie_present' => (bool) $csrfCookie,
            'header_present' => (bool) $csrfHeader,
        ]);
        throw new RuntimeException('CSRF token invalido.');
    }

    $record = findRefreshTokenRecord($db, $refreshToken);
    if (!$record) {
        logAuthEvent('refresh_rejected', ['reason' => 'refresh_token_not_found']);
        throw new RuntimeException('Refresh token invalido.');
    }

    $sessionId = (string) $record['session_id'];
    $now = authNow();

    if (!hash_equals((string) $record['csrf_token_hash'], hashOpaqueToken((string) $csrfCookie))) {
        revokeSessionFamily($db, $sessionId, 'csrf_mismatch', true);
        if ($setBrowserCookies) {
            clearAuthCookies();
        }
        throw new RuntimeException('CSRF token invalido.');
    }

    if (($record['session_status'] ?? '') !== 'active' || !empty($record['session_revoked_at'])) {
        if ($setBrowserCookies) {
            clearAuthCookies();
        }
        throw new RuntimeException('Sessão revogada.');
    }

    if (!empty($record['deletion_requested_at'])
        || in_array(strtolower((string) ($record['user_status'] ?? '')), ['deleted', 'pending_deletion'], true)
    ) {
        revokeSessionFamily($db, $sessionId, 'account_deletion_requested');
        if ($setBrowserCookies) {
            clearAuthCookies();
        }
        throw new RuntimeException('Sessão indisponível.');
    }

    if (!empty($record['session_expires_at']) && strtotime((string) $record['session_expires_at']) < ($now->getTimestamp() - getAuthClockSkewSeconds())) {
        revokeSessionFamily($db, $sessionId, 'session_expired');
        if ($setBrowserCookies) {
            clearAuthCookies();
        }
        throw new RuntimeException('Sessão expirada.');
    }

    if (!empty($record['revoked_at']) || ($record['status'] ?? '') !== 'active') {
        $recoveredRecord = recoverRotatedRefreshTokenRecord($db, $record, $now);
        if ($recoveredRecord !== null) {
            logAuthEvent('refresh_reuse_recovered', [
                'session_id' => $sessionId,
                'refresh_token_id' => $record['id'] ?? null,
                'active_refresh_token_id' => $recoveredRecord['id'] ?? null,
                'user_id' => $record['user_id'] ?? null,
            ]);
            $record = $recoveredRecord;
        } else {
            revokeSessionFamily($db, $sessionId, 'refresh_token_reuse', true);
            if ($setBrowserCookies) {
                clearAuthCookies();
            }
            logAuthEvent('refresh_reuse_detected', [
                'session_id' => $sessionId,
                'refresh_token_id' => $record['id'] ?? null,
                'user_id' => $record['user_id'] ?? null,
            ]);
            throw new RuntimeException('Refresh token reutilizado.');
        }
    }

    if (!empty($record['expires_at']) && strtotime((string) $record['expires_at']) < ($now->getTimestamp() - getAuthClockSkewSeconds())) {
        revokeSessionFamily($db, $sessionId, 'refresh_token_expired');
        if ($setBrowserCookies) {
            clearAuthCookies();
        }
        throw new RuntimeException('Refresh token expirado.');
    }

    $userStmt = $db->prepare("SELECT id, email, role FROM users WHERE id = :id LIMIT 1");
    $userStmt->execute([':id' => $record['user_id']]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        revokeSessionFamily($db, $sessionId, 'user_not_found');
        if ($setBrowserCookies) {
            clearAuthCookies();
        }
        throw new RuntimeException('Usuário não encontrado.');
    }

    $newRefreshToken = createOpaqueAuthToken(48);
    $newRefreshExpiresAt = $now->modify('+' . getAuthRefreshTokenTtlSeconds() . ' seconds');
    $newRefresh = persistRefreshToken(
        $db,
        $sessionId,
        $newRefreshToken,
        $newRefreshExpiresAt,
        (string) $record['id'],
        'auth_token_refresh'
    );
    $accessToken = buildAccessToken($user, $sessionId);

    updateSessionHeartbeat($db, $sessionId, true);
    if ($setBrowserCookies) {
        setRefreshTokenCookie($newRefresh['token'], $newRefresh['expires_at']);
        setCsrfCookie((string) $csrfCookie, $newRefresh['expires_at']);
    }

    logAuthEvent('refresh_rotated', [
        'session_id' => $sessionId,
        'user_id' => $user['id'] ?? null,
        'previous_refresh_token_id' => $record['id'] ?? null,
        'next_refresh_token_id' => $newRefresh['id'],
        'access_expires_at' => date(DateTimeInterface::ATOM, time() + getAuthAccessTokenTtlSeconds()),
    ]);

    return [
        'token' => $accessToken,
        'user_id' => $user['id'],
        'session_id' => $sessionId,
        'csrf_token' => $csrfCookie,
        'access_expires_in' => getAuthAccessTokenTtlSeconds(),
        'refresh_token' => $newRefresh['token'],
    ];
}

/**
 * Faz o refresh usando o contrato padrao do site: cookies HTTP-only e header de CSRF.
 * Mantem a rota de refresh enxuta, delegando a regra pesada para a funcao central acima.
 *
 * @since 1.0.0
 */
function refreshAccessTokenFromCookie(PDO $db): array
{
    $refreshToken = getRefreshTokenFromCookie();
    $csrfCookie = getCsrfTokenFromCookie();
    $csrfHeader = getCsrfTokenFromRequest();

    return refreshAccessTokenUsingToken(
        $db,
        (string) $refreshToken,
        (string) $csrfCookie,
        (string) $csrfHeader
    );
}

/**
 * Renova uma sessao de cliente nativo usando credenciais armazenadas no
 * keychain/keystore. Como esses valores nao sao cookies ambientes, a rota
 * nativa os recebe explicitamente e nao altera cookies do navegador.
 */
function refreshNativeAccessToken(PDO $db, string $refreshToken, string $csrfToken): array
{
    return refreshAccessTokenUsingToken(
        $db,
        $refreshToken,
        $csrfToken,
        $csrfToken,
        false
    );
}

/**
 * Finaliza a sessão atual por access token ou refresh token e limpa os cookies do navegador.
 * O fluxo e tolerante aos dois modos porque o site pode sair logado por contextos diferentes.
 *
 * @since 1.0.0
 */
function logoutAuthSession(
    PDO $db,
    ?string $explicitRefreshToken = null,
    ?string $explicitCsrfToken = null,
    bool $clearBrowserCookies = true
): void
{
    ensureAuthTables($db);

    $refreshToken = $explicitRefreshToken ?? getRefreshTokenFromCookie();
    $csrfCookie = $explicitCsrfToken ?? getCsrfTokenFromCookie();
    $csrfHeader = $explicitCsrfToken ?? getCsrfTokenFromRequest();
    $accessToken = getBearerTokenFromRequest();
    $sessionId = null;

    if ($accessToken !== '') {
        $access = getAuthenticatedSessionFromAccessToken($db, $accessToken);
        if ($access && !empty($access['session']['id'])) {
            $sessionId = (string) $access['session']['id'];
        }
    }

    if (!$sessionId && $refreshToken) {
        $record = findRefreshTokenRecord($db, $refreshToken);
        if ($record && !empty($record['session_id'])) {
            $sessionId = (string) $record['session_id'];

            if (!assertValidCsrfToken($csrfCookie, $csrfHeader)) {
                if ($clearBrowserCookies) {
                    clearAuthCookies();
                }
                throw new RuntimeException('CSRF token invalido.');
            }
        }
    }

    if ($sessionId) {
        revokeSessionFamily($db, $sessionId, 'logout');
        logAuthEvent('auth_logout', ['session_id' => $sessionId]);
    }

    if ($clearBrowserCookies) {
        clearAuthCookies();
    }
}
