<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/filters/professional/routes.php';

$database = new Database('read');
handlePublicProfessionalDirectoryRoute($database->getConnection());
