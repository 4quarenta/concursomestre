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

declare(strict_types=1);

include_once dirname(__DIR__, 2) . '/config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $stmt = $db->prepare('DESCRIBE user_feedback');
    $stmt->execute();
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (in_array('parent_id', $columns, true)) {
        echo "SUCCESS: parent_id column exists.\n";
        exit(0);
    }

    echo "FAILURE: parent_id column missing.\n";
    print_r($columns);
    exit(1);
} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
    exit(1);
}
