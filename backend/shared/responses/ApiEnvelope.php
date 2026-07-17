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
 * shared/responses/ApiEnvelope.php
 *
 * Centraliza o formato oficial do envelope JSON da API.
 */

class ApiEnvelope
{
    /**
     * Monta o payload padrao de sucesso.
     */
    public static function success($data = [], ?string $message = null, ?array $pagination = null): array
    {
        $response = ['success' => true];

        if ($message !== null && $message !== '') {
            $response['message'] = $message;
        }

        // `data` faz parte do contrato mesmo quando o valor valido e falsy.
        // Remover o campo para [], 0, false, null ou "" altera a semantica
        // da resposta e obriga cada consumidor a inventar um fallback.
        $response['data'] = $data;

        if ($pagination !== null) {
            $response['pagination'] = $pagination;
        }

        return $response;
    }

    /**
     * Monta o payload padrao de erro.
     */
    public static function error(string $message, $details = null, ?string $errorCode = null): array
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($errorCode !== null && $errorCode !== '') {
            $response['error_code'] = $errorCode;
        }

        if ($details !== null) {
            $response['details'] = $details;
        }

        return $response;
    }
}
