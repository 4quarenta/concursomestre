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
echo "--- system_settings ---\n";
$stmt = $db->query("SHOW CREATE TABLE system_settings");
print_r($stmt->fetch(PDO::FETCH_ASSOC));
echo "\n--- cache_settings ---\n";
$stmt = $db->query("SHOW CREATE TABLE cache_settings");
print_r($stmt->fetch(PDO::FETCH_ASSOC));
?>
