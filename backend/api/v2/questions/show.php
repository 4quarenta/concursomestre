<?php

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/questions/routes.php';

$db = getDatabaseConnection();
handleQuestionsV2ShowRoute($db);

