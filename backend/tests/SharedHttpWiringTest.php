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

require_once __DIR__ . '/../shared/http/ApiResponse.php';
require_once __DIR__ . '/../api/utils/Response.php';

if (!class_exists('ApiResponse')) {
    fwrite(STDERR, "ApiResponse não foi carregada.\n");
    exit(1);
}

if (!class_exists('Response')) {
    fwrite(STDERR, "Response legado não foi carregado.\n");
    exit(1);
}

if (!is_subclass_of('Response', 'ApiResponse')) {
    fwrite(STDERR, "Response não esta apontando para a camada oficial shared/http.\n");
    exit(1);
}

fwrite(STDOUT, "Shared HTTP bridge OK\n");
