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

require_once __DIR__ . '/../http/ApiResponse.php';

/**
 * Alias legado interno para manter chamadas `Response::...` dentro dos modulos,
 * sem depender da pasta `api/utils`.
 *
 * @since 1.0.0
 */
class Response extends ApiResponse
{
}
