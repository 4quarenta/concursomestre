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

header("Content-Type: application/json");
echo json_encode([
    "api" => "QuestaoPro Backend",
    "version" => "1.0",
    "status" => "running",
    "runtime" => [
        "public_index" => "ok",
        "api_root" => "/api"
    ]
]);
?>
