<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/changelog/routes.php';

$database = new Database();
$db = $database->getConnection();

handleChangelogMarkViewedRoute($db);
