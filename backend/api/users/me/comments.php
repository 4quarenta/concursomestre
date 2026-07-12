<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/users/routes.php';

$database = new Database();
$db = $database->getConnection();

unset($_GET['user_id'], $_GET['userId']);
handleUsersCommentsRoute($db);
