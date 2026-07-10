<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/admin/routes.php';

$database = new Database();
$db = $database->getConnection();

handleAdminAnalyticsDashboardRoute($db);
