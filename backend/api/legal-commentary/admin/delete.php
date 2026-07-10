<?php

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/legal_commentary/routes.php';

$database = new Database();
$db = $database->getConnection();

handleLegalCommentaryAdminDeleteRoute($db);
