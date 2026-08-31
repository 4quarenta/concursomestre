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

echo "Questions Table Schema:\n";
echo str_repeat("-", 60) . "\n";
echo sprintf("%-20s | %-20s\n", "Field", "Type");
echo str_repeat("-", 60) . "\n";
foreach($db->query("DESCRIBE questions") as $row) {
    echo sprintf("%-20s | %-20s\n", $row['Field'], $row['Type']);
}
?>
