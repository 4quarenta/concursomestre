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
$stmt = $db->query("DESCRIBE system_settings");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
$outputDirectory = dirname(__DIR__) . '/outputs';
if (!is_dir($outputDirectory)) {
    mkdir($outputDirectory, 0775, true);
}

$outputPath = $outputDirectory . '/system_settings_structure.txt';
file_put_contents($outputPath, print_r($rows, true));
echo "Structure saved to {$outputPath}\n";
?>
