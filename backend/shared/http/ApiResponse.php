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

require_once __DIR__ . '/../errors/ApiErrorDetails.php';
require_once __DIR__ . '/../responses/ApiEnvelope.php';
require_once __DIR__ . '/../observability/RequestContext.php';

/**
 * shared/http/ApiResponse.php
 *
 * Camada oficial de resposta HTTP JSON do backend.
 * Centraliza a emissao HTTP enquanto o envelope e os detalhes de erro
 * ficam em camadas transversais separadas.
 */

class ApiResponse
{
    /**
     * Emite a resposta JSON final, limpando buffers antigos para evitar lixo
     * no corpo retornado por scripts legados.
     */
    protected static function sendJson(array $response, int $code): void
    {
        http_response_code($code);

        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        RequestContext::applyResponseHeaders();
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit();
    }

    /**
     * Resposta de sucesso padronizada.
     * `data` e `pagination` so entram no payload quando realmente existem.
     */
    public static function success($data = [], ?string $message = null, int $code = 200, ?array $pagination = null): void
    {
        self::sendJson(ApiEnvelope::success($data, $message, $pagination), $code);
    }

    /**
     * Resposta de erro padronizada.
     * Detalhes sensiveis so aparecem quando o ambiente de debug esta ativo.
     */
    public static function error(string $message, int $code = 400, $details = null, ?string $errorCode = null): void
    {
        $safeDetails = ($details !== null && getenv('APP_DEBUG') === 'true') ? $details : null;
        self::sendJson(ApiEnvelope::error($message, $safeDetails, $errorCode), $code);
    }

    /**
     * Erro de requisicao invalida.
     */
    public static function badRequest(string $message = 'Bad request', $details = null): void
    {
        self::error($message, 400, $details);
    }

    /**
     * Erro de validação com suporte a payload de campos.
     */
    public static function validationError($errors): void
    {
        $message = (is_array($errors) && isset($errors['message']))
            ? (string) $errors['message']
            : (is_string($errors) ? $errors : 'Validation failed');

        self::error($message, 422, $errors, 'validation_error');
    }

    /**
     * Falha de autenticação.
     */
    public static function unauthorized(string $message = 'Unauthorized'): void
    {
        self::error($message, 401, null, 'unauthorized');
    }

    /**
     * Falha de autorizacao.
     */
    public static function forbidden(string $message = 'Forbidden'): void
    {
        self::error($message, 403, null, 'forbidden');
    }

    /**
     * Recurso não encontrado.
     */
    public static function notFound(string $message = 'Resource not found'): void
    {
        self::error($message, 404, null, 'not_found');
    }

    /**
     * Conflito de estado de negocio.
     */
    public static function conflict(string $message = 'Conflict'): void
    {
        self::error($message, 409, null, 'conflict');
    }

    /**
     * Dependencia externa temporariamente indisponivel.
     */
    public static function serviceUnavailable(string $message = 'Service unavailable', ?Throwable $exception = null, ?string $errorCode = 'service_unavailable'): void
    {
        self::error($message, 503, ApiErrorDetails::fromThrowable($exception), $errorCode);
    }

    /**
     * Erro inesperado do servidor.
     * O stack trace so e exposto em debug para não vazar informações sensíveis.
     */
    public static function serverError(string $message = 'Internal server error', ?Throwable $exception = null): void
    {
        self::error($message, 500, ApiErrorDetails::fromThrowable($exception), 'server_error');
    }
}
