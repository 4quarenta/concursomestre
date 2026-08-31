<?php

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/legal_commentary/routes.php';

@set_time_limit(600);
@ini_set('max_execution_time', '600');

$database = new Database();
$db = $database->getConnection();

handleLegalCommentaryAdminGenerateRoute($db);
