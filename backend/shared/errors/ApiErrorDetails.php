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
 * shared/errors/ApiErrorDetails.php
 *
 * Concentra a serializacao segura de excecoes para ambientes de debug.
 */

class ApiErrorDetails
{
    /**
     * Monta um payload seguro de debug para respostas inesperadas.
     */
    public static function fromThrowable(?Throwable $exception): ?array
    {
        if ($exception === null || getenv('APP_DEBUG') !== 'true') {
            return null;
        }

        return [
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
        ];
    }
}
