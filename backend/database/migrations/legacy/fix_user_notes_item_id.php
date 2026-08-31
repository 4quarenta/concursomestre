<?php
// migrations/fix_user_notes_item_id.php
require_once dirname(__DIR__, 3) . '/config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    echo "Attempting to modify user_notes table...<br>";
    
    // Modify item_id to be VARCHAR(36) to support UUIDs
    $query = "ALTER TABLE user_notes MODIFY item_id VARCHAR(36) NOT NULL";
    $db->exec($query);
    
    echo "Successfully modified 'item_id' column in 'user_notes' table to VARCHAR(36).<br>";

} catch(PDOException $e) {
    echo "Error modifying table: " . $e->getMessage();
}
?>

