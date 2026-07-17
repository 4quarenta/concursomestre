<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/http/Request.php';
require_once __DIR__ . '/../../modules/admin/routes.php';

if (Request::method() === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$database = new Database();
$db = $database->getConnection();

handleAdminBrandAssetUploadRoute($db);
