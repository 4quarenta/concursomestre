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

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/admin/routes.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$database = new Database();
$db = $database->getConnection();

$candidateLogPaths = [
    '/var/log/nginx/concursomestre.error.log',
    '/var/log/nginx/error.log',
    '/var/log/apache2/error.log',
    '/var/log/php8.3-fpm.log',
    '/var/log/php8.2-fpm.log',
    '/var/log/php-fpm/error.log',
    'C:\\xampp\\apache\\logs\\error.log',
];

$logPath = $candidateLogPaths[0];
foreach ($candidateLogPaths as $candidateLogPath) {
    if (is_readable($candidateLogPath)) {
        $logPath = $candidateLogPath;
        break;
    }
}

handleAdminSystemLogsRoute($db, $logPath);
