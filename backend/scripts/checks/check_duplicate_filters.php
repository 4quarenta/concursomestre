<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

include_once dirname(__DIR__, 2) . '/config/database.php';
$database = new Database();
$db = $database->getConnection();

echo "Duplicate Assuntos in 'filters':\n";
echo str_repeat("-", 80) . "\n";
echo sprintf("%-5s | %-30s | %-20s | %-10s\n", "ID", "Name", "Slug", "Meta Mat.");
echo str_repeat("-", 80) . "\n";
foreach($db->query("SELECT id, name, slug, meta_materia FROM filters WHERE name LIKE '%Língua Portuguesa%' OR name LIKE '%Portuguesa%'") as $row) {
    echo sprintf("%-5s | %-30s | %-20s | %-10s\n", $row['id'], $row['name'], $row['slug'], $row['meta_materia']);
}
?>
