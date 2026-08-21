<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/materials/public/routes.php';

$database = new Database('read');
handlePublicMaterialLegacyRoute($database->getConnection());
