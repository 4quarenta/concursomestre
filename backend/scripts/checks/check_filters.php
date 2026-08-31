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
$query = "SELECT type, count(*) as count FROM filters GROUP BY type";
$stmt = $db->prepare($query);
$stmt->execute();
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
