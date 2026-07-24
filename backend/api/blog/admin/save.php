<?php

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/blog/routes.php';

$db = (new Database())->getConnection();
handleBlogAdminSaveRoute($db);
