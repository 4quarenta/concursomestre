<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/legal_commentary/public/routes.php';

$database = new Database('read');
handlePublicLawArticleDetailRoute($database->getConnection());
