<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/contests/routes.php';

$database = new Database('read');
handlePublicContestsDirectoryRoute($database->getConnection());
