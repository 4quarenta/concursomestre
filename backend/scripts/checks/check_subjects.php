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

include_once 'config/database.php';
$database = new Database();
$db = $database->getConnection();
$stmt = $db->query("SHOW TABLES LIKE 'subjects'");
if ($stmt->rowCount() > 0) {
    $stmt = $db->query("DESCRIBE subjects");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);
} else {
    echo "Table subjects does not exist";
}
?>
