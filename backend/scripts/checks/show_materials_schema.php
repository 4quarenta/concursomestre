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

try {
    $stmt = $db->query("SHOW CREATE TABLE materials");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    print_r($result);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
