<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/filters/routes.php';

$db = (new Database('read'))->getConnection();
handlePublicFeaturedOrganizationsRoute($db);
