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

echo "Assuntos in 'filters':\n";
echo str_repeat("-", 60) . "\n";
echo sprintf("%-40s | %-10s\n", "Name", "Meta Mat.");
echo str_repeat("-", 60) . "\n";
foreach($db->query("SELECT name, meta_materia FROM filters WHERE type='assunto'") as $row) {
    echo sprintf("%-40s | %-10s\n", $row['name'], $row['meta_materia']);
}
?>
