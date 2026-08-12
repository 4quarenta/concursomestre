<?php

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/changelog/routes.php';

$db = (new Database())->getConnection();
handleChangelogAdminSuggestionsRoute($db);
