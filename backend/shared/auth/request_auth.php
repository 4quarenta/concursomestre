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
require_once __DIR__ . '/AuthSession.php';
require_once __DIR__ . '/../../config/database.php';

/**
 * Resolve o bearer token da request atual usando o mesmo contrato do nucleo de auth.
 * Serve como helper fino para bridges e modulos que so precisam identificar a sessão corrente.
 *
 * @since 1.0.0
 */
function getRequestBearerToken(): ?string
{
    $token = getBearerTokenFromRequest();
    return $token !== '' ? $token : null;
}

/**
 * Valida a sessão autenticada da request e devolve o payload JWT padronizado do usuário.
 * Quando o contexto exige auth, esta funcao concentra a mensagem de erro e o bootstrap do banco.
 *
 * @since 1.0.0
 */
function verifyAuthenticatedUserPayload(bool $required = true): ?array
{
    $token = getRequestBearerToken();
    if (!$token) {
        if ($required) {
            throw new RuntimeException('Sessão inválida. Faça login novamente.');
        }
        return null;
    }

    $database = new Database();
    $db = $database->getConnection();
    ensureAuthTables($db);

    $payload = verifyAuthenticatedSession($db, $token);
    if (empty($payload['user_id'])) {
        if ($required) {
            throw new RuntimeException('Sessão inválida ou expirada.');
        }
        return null;
    }

    return $payload;
}

/**
 * Resolve o id do usuário autenticado e opcionalmente aceita um fallback legado.
 * Isso ajuda a manter compatibilidade com pontos antigos enquanto o backend usa sessão como fonte de verdade.
 *
 * @since 1.0.0
 */
function resolveAuthenticatedUserId($fallbackPayload = null, bool $allowFallback = false): string
{
    $payload = verifyAuthenticatedUserPayload(false);
    $userId = trim((string) ($payload['user_id'] ?? ''));
    if ($userId !== '') {
        return $userId;
    }

    if ($allowFallback) {
        if (is_object($fallbackPayload)) {
            return trim((string) ($fallbackPayload->user_id ?? ''));
        }

        if (is_array($fallbackPayload)) {
            return trim((string) ($fallbackPayload['user_id'] ?? ''));
        }
    }

    return '';
}
