<?php
require_once dirname(__DIR__, 3) . '/config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    // Create user_highlights table
    $queryHighlights = "CREATE TABLE IF NOT EXISTS user_highlights (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        material_id INT NOT NULL,
        page_num INT NOT NULL,
        color VARCHAR(7) DEFAULT '#ffeb3b',
        rects JSON NOT NULL,
        text TEXT,
        type VARCHAR(20) DEFAULT 'highlight',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $db->exec($queryHighlights);
    echo "Table 'user_highlights' created or already exists.<br>";

    // Create user_bookmarks table
    $queryBookmarks = "CREATE TABLE IF NOT EXISTS user_bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        material_id INT NOT NULL,
        page_num INT NOT NULL,
        label VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $db->exec($queryBookmarks);
    echo "Table 'user_bookmarks' created or already exists.<br>";

} catch(PDOException $e) {
    echo "Error creating tables: " . $e->getMessage();
}
?>

