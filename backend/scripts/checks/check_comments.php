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

include_once __DIR__ . '/config/database.php';
$database = new Database();
$db = $database->getConnection();

echo "Checking comments table...\n";
try {
    $stmt = $db->query("SELECT * FROM comments");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Total comments: " . count($rows) . "\n\n";
    foreach ($rows as $row) {
        echo "ID: " . $row['id'] . " | Target: " . $row['target_id'] . " | Parent: " . ($row['parent_id'] ?? 'NULL') . " | Content: " . substr($row['content'], 0, 30) . "...\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
