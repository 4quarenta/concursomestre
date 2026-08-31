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

echo "\nStructure for 'filters':\n";
echo str_repeat("-", 60) . "\n";
echo sprintf("%-20s | %-15s | %-5s | %-5s\n", "Field", "Type", "Null", "Key");
echo str_repeat("-", 60) . "\n";
foreach($db->query("DESCRIBE filters") as $row) {
    echo sprintf("%-20s | %-15s | %-5s | %-5s\n", $row[0], $row[1], $row[2], $row[3]);
}
?>
