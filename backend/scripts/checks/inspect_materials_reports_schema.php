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

echo "<h2>Tables:</h2>";
$tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
echo "<ul>";
foreach ($tables as $table) {
    echo "<li>$table</li>";
}
echo "</ul>";

echo "<h2>Materials Columns:</h2>";
if (in_array('materials', $tables)) {
    $cols = $db->query("DESCRIBE materials")->fetchAll(PDO::FETCH_ASSOC);
    echo "<pre>" . json_encode($cols, JSON_PRETTY_PRINT) . "</pre>";
} else {
    echo "Table 'materials' does not exist.";
}

echo "<h2>Reports/Denúncias Columns:</h2>";
// Check for likely names
$reportTable = in_array('reports', $tables) ? 'reports' : (in_array('denúncias', $tables) ? 'denúncias' : null);
if ($reportTable) {
    echo "Found table: $reportTable<br>";
    $cols = $db->query("DESCRIBE $reportTable")->fetchAll(PDO::FETCH_ASSOC);
    echo "<pre>" . json_encode($cols, JSON_PRETTY_PRINT) . "</pre>";
    
    echo "<h3>Row Count:</h3>";
    $count = $db->query("SELECT COUNT(*) FROM $reportTable")->fetchColumn();
    echo "Rows: $count";
} else {
    echo "Table 'reports' or 'denúncias' does not exist.";
}
?>
