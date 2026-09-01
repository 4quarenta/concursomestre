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

/**
 * Middleware oficial de autenticação.
 * Centraliza a validação de sessão JWT/refresh fora da pasta `api/`.
 */

require_once __DIR__ . '/../auth/JWTAuth.php';
require_once __DIR__ . '/../auth/AuthSession.php';
require_once __DIR__ . '/../http/ApiResponse.php';
require_once __DIR__ . '/../security/IpBanGuard.php';
require_once __DIR__ . '/../../config/database.php';

class AuthMiddleware {
    /**
     * Resolve o bearer token bruto da request atual.
     *
     * @since 1.0.0
     */
    private static function getBearerToken() {
        return getBearerTokenFromRequest();
    }

    /**
     * Exige autenticação valida e retorna o payload da sessão.
     *
     * @since 1.0.0
     */
    public static function requireAuth() {
        $token = self::getBearerToken();

        $database = new Database();
        $db = $database->getConnection();
        ensureAuthTables($db);
        try {
            enforceSecurityIpBanOrFail($db);
        } catch (SecurityIpBannedException) {
            ApiResponse::forbidden('IP bloqueado por seguranca. Contate o suporte.');
        }
        $payload = verifyAuthenticatedSession($db, $token);

        if (!$payload) {
            ApiResponse::unauthorized('Invalid or expired token');
        }
        
        return $payload;
    }
    
    /**
     * Le autenticação opcional sem falhar quando o token não existe.
     *
     * @since 1.0.0
     */
    public static function optionalAuth() {
        $token = self::getBearerToken();
        
        if (empty($token)) {
            return null;
        }

        $database = new Database();
        $db = $database->getConnection();
        ensureAuthTables($db);
        try {
            enforceSecurityIpBanOrFail($db);
        } catch (SecurityIpBannedException) {
            return null;
        }

        return verifyAuthenticatedSession($db, $token);
    }
    
    /**
     * Exige papel administrativo.
     *
     * @since 1.0.0
     */
    public static function requireAdmin() {
        $user = self::requireAuth();

        $role = (string) ($user['role'] ?? '');
        if (!in_array($role, ['admin', 'staff'], true)) {
            ApiResponse::forbidden('Admin or staff access required');
        }

        return $user;
    }
}
?>
