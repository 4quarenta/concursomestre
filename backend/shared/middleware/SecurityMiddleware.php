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
 * Middleware oficial de seguranca transversal.
 * Aplica checagens defensivas basicas na borda HTTP antes que a request
 * avance para controller, service ou SQL.
 * @since 1.0.0
 */

require_once __DIR__ . '/../http/ApiResponse.php';

class SecurityMiddleware
{
    /**
     * Orquestra as verificacoes defensivas da request atual.
     * Esse ponto costuma ser chamado pelos entrypoints que expoem superficie publica.
     * @since 1.0.0
     */
    public static function checkSecurity()
    {
        self::checkSQLInjection($_GET);
        self::checkSQLInjection($_POST);
        self::checkXSS($_GET);
        self::checkXSS($_POST);

        if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'PATCH'], true)) {
            self::validateContentType();
        }

        self::checkUserAgent();
    }

    /**
     * Procura assinaturas simples de injecao SQL em parametros textuais.
     * O objetivo e bloquear payloads obvios antes que eles contaminem logs ou consultas.
     * @since 1.0.0
     */
    private static function checkSQLInjection($data)
    {
        $patterns = [
            '/(\bUNION\b.*\bSELECT\b)/i',
            '/(\bDROP\b.*\bTABLE\b)/i',
            '/(\bINSERT\b.*\bINTO\b)/i',
            '/(\bDELETE\b.*\bFROM\b)/i',
            '/(\bUPDATE\b.*\bSET\b)/i',
            '/(--|\#|\/\*)/i',
            '/(\bEXEC\b|\bEXECUTE\b)/i',
        ];

        foreach ($data as $value) {
            if (is_string($value)) {
                foreach ($patterns as $pattern) {
                    if (preg_match($pattern, $value)) {
                        self::blockRequest('Potential SQL injection detected');
                    }
                }
            }
        }
    }

    /**
     * Procura marcadores comuns de XSS em GET e POST.
     * Isso complementa sanitizacao de saida e reduz risco de payload malicioso entrar no fluxo.
     * @since 1.0.0
     */
    private static function checkXSS($data)
    {
        $patterns = [
            '/<script\b[^>]*>(.*?)<\/script>/is',
            '/javascript:/i',
            '/on\w+\s*=/i',
        ];

        foreach ($data as $value) {
            if (is_string($value)) {
                foreach ($patterns as $pattern) {
                    if (preg_match($pattern, $value)) {
                        self::blockRequest('Potential XSS attack detected');
                    }
                }
            }
        }
    }

    /**
     * Registra content types fora do contrato esperado para mutacoes HTTP.
     * Aqui o middleware so observa e gera log para triagem operacional.
     * @since 1.0.0
     */
    private static function validateContentType()
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (!preg_match('/^(application\/json|application\/x-www-form-urlencoded)/i', $contentType)) {
            error_log('Suspicious content type: ' . $contentType);
        }
    }

    /**
     * Bloqueia user agents conhecidos de scanners e ferramentas de ataque.
     * Isso reduz ruido operacional nas rotas publicas da plataforma.
     * @since 1.0.0
     */
    private static function checkUserAgent()
    {
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $blockedPatterns = [
            '/sqlmap/i',
            '/nikto/i',
            '/nmap/i',
            '/masscan/i',
        ];

        foreach ($blockedPatterns as $pattern) {
            if (preg_match($pattern, $userAgent)) {
                self::blockRequest('Blocked user agent');
            }
        }
    }

    /**
     * Interrompe a request, registra a causa no log e responde com o contrato HTTP oficial.
     * @since 1.0.0
     */
    private static function blockRequest($reason)
    {
        error_log('Security block: ' . $reason . ' | IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        ApiResponse::error('Request blocked for security reasons', 403);
    }
}

