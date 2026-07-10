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

echo "Tables in Database:\n";
echo str_repeat("-", 40) . "\n";
foreach($db->query("SHOW TABLES") as $row) {
    echo $row[0] . "\n";
}

echo "\nUsers Table Schema:\n";
echo str_repeat("-", 60) . "\n";
foreach($db->query("DESCRIBE users") as $row) {
    echo sprintf("%-20s | %-20s\n", $row['Field'], $row['Type']);
}

// Check for specific payment/subscription related tables
$targetTables = ['user_subscriptions', 'subscriptions', 'plans', 'transactions', 'payments'];
foreach ($targetTables as $table) {
    $check = $db->query("SHOW TABLES LIKE '$table'");
    if ($check->rowCount() > 0) {
        echo "\n$table Table Schema:\n";
        echo str_repeat("-", 60) . "\n";
        foreach($db->query("DESCRIBE $table") as $row) {
            echo sprintf("%-20s | %-20s\n", $row['Field'], $row['Type']);
        }
    }
}
?>
