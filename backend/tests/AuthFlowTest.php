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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/utils/AuthSession.php';
require_once __DIR__ . '/../api/utils/JWTAuth.php';

function authAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function authTestDb(): PDO
{
    $database = new Database();
    $db = $database->getConnection();
    ensureAuthTables($db);
    return $db;
}

function authUpsertTestUser(PDO $db): array
{
    $id = 'auth-test-suite-user';
    $email = 'auth-suite@concursomestre.local';
    $passwordHash = password_hash('Secret123!', PASSWORD_DEFAULT);

    $stmt = $db->prepare(
        "INSERT INTO users (
            id, name, email, password_hash, role, plan, level, xp, reputation, email_verified, created_at
        ) VALUES (
            :id, 'Auth Suite', :email, :password_hash, 'student', 'Gratuito', 1, 0, 100, 1, NOW()
        )
        ON DUPLICATE KEY UPDATE
            name = 'Auth Suite',
            password_hash = :password_hash,
            email_verified = 1"
    );
    $stmt->execute([
        ':id' => $id,
        ':email' => $email,
        ':password_hash' => $passwordHash,
    ]);

    return [
        'id' => $id,
        'email' => $email,
        'role' => 'student',
    ];
}

function authCleanupSessions(PDO $db, string $userId): void
{
    $stmtTokens = $db->prepare(
        "DELETE rt FROM auth_refresh_tokens rt
         JOIN auth_sessions s ON s.id = rt.session_id
         WHERE s.user_id = :user_id"
    );
    $stmtTokens->execute([':user_id' => $userId]);

    $stmtSessions = $db->prepare("DELETE FROM auth_sessions WHERE user_id = :user_id");
    $stmtSessions->execute([':user_id' => $userId]);
}

try {
    $db = authTestDb();
    $user = authUpsertTestUser($db);
    authCleanupSessions($db, $user['id']);

    $bundle = issueUserAuthBundle($db, $user, true);
    authAssert(!empty($bundle['token']), 'Login deve emitir access token.');
    authAssert(!empty($bundle['refresh_token']), 'Login deve emitir refresh token no motor interno.');
    authAssert(!empty($bundle['session_id']), 'Login deve criar session_id.');
    authAssert(!empty($bundle['csrf_token']), 'Login deve gerar CSRF token.');

    $payload = verifyAuthenticatedSession($db, $bundle['token']);
    authAssert(!empty($payload['user_id']) && $payload['user_id'] === $user['id'], 'Access token emitido deve ser valido.');

    $refreshOne = refreshAccessTokenUsingToken($db, $bundle['refresh_token'], $bundle['csrf_token'], $bundle['csrf_token']);
    authAssert(!empty($refreshOne['token']), 'Refresh deve emitir novo access token.');
    authAssert(!empty($refreshOne['refresh_token']), 'Refresh deve rotacionar o refresh token.');
    authAssert($refreshOne['session_id'] === $bundle['session_id'], 'Refresh deve manter o mesmo session_id.');

    $refreshedPayload = verifyAuthenticatedSession($db, $refreshOne['token']);
    authAssert(!empty($refreshedPayload['user_id']) && $refreshedPayload['user_id'] === $user['id'], 'Access token renovado deve ser valido.');

    $reuseFailed = false;
    try {
        refreshAccessTokenUsingToken($db, $bundle['refresh_token'], $bundle['csrf_token'], $bundle['csrf_token']);
    } catch (RuntimeException $e) {
        $reuseFailed = str_contains($e->getMessage(), 'reutilizado');
    }
    authAssert($reuseFailed, 'Refresh token reutilizado deve ser rejeitado.');

    $revokedPayload = verifyAuthenticatedSession($db, $refreshOne['token']);
    authAssert($revokedPayload === null, 'Sessão deve ser revogada apos reuse detectado.');

    authCleanupSessions($db, $user['id']);
    $bundleTwo = issueUserAuthBundle($db, $user, true);

    $expiredAccessToken = JWTAuth::encode([
        'user_id' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'session_id' => $bundleTwo['session_id'],
        'iss' => getAuthIssuer(),
        'aud' => getAuthAudience(),
        'typ' => 'access',
        'iat' => time() - 120,
        'nbf' => time() - 120,
        'exp' => time() - 5,
        'jti' => createAuthUuid(),
    ], getAuthAccessTokenTtlSeconds());
    authAssert(verifyAuthenticatedSession($db, $expiredAccessToken) !== null, 'Clock skew pequeno deve ser tolerado.');

    $veryExpiredAccessToken = JWTAuth::encode([
        'user_id' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'session_id' => $bundleTwo['session_id'],
        'iss' => getAuthIssuer(),
        'aud' => getAuthAudience(),
        'typ' => 'access',
        'iat' => time() - 360,
        'nbf' => time() - 360,
        'exp' => time() - 180,
        'jti' => createAuthUuid(),
    ], getAuthAccessTokenTtlSeconds());
    authAssert(verifyAuthenticatedSession($db, $veryExpiredAccessToken) === null, 'Token muito expirado deve ser rejeitado.');

    $refreshAfterExpiry = refreshAccessTokenUsingToken($db, $bundleTwo['refresh_token'], $bundleTwo['csrf_token'], $bundleTwo['csrf_token']);
    authAssert(!empty($refreshAfterExpiry['token']), 'Refresh deve funcionar apos expirar o access token.');

    $missingCookieFailed = false;
    try {
        refreshAccessTokenUsingToken($db, '', $bundleTwo['csrf_token'], $bundleTwo['csrf_token']);
    } catch (RuntimeException $e) {
        $missingCookieFailed = str_contains($e->getMessage(), 'ausente');
    }
    authAssert($missingCookieFailed, 'Refresh ausente deve falhar.');

    $newDbConnection = authTestDb();
    $crossInstancePayload = verifyAuthenticatedSession($newDbConnection, $refreshAfterExpiry['token']);
    authAssert(!empty($crossInstancePayload['user_id']) && $crossInstancePayload['user_id'] === $user['id'], 'Sessão deve sobreviver a nova instancia/conexão.');

    revokeSessionFamily($db, $bundleTwo['session_id'], 'logout_test');
    authAssert(verifyAuthenticatedSession($db, $refreshAfterExpiry['token']) === null, 'Logout deve revogar a sessão.');

    echo "AuthFlowTest: PASS\n";
} catch (Throwable $e) {
    fwrite(STDERR, "AuthFlowTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}
