<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/filters/routes.php';

$database = new Database();
$db = $database->getConnection();

if (strtolower(trim((string) ($_GET['view'] ?? ''))) === 'hierarchy') {
    handlePublicTaxonomyHierarchyRoute($db);
    return;
}

handlePublicTaxonomyDirectoryRoute($db);
