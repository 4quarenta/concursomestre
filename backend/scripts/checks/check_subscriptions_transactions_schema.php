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

$database = new Database();
$db = $database->getConnection();

echo "TRANSACTIONS:\n";
print_r($db->query('DESCRIBE transactions')->fetchAll(PDO::FETCH_ASSOC));

echo "\nUSER_SUBSCRIPTIONS:\n";
print_r($db->query('DESCRIBE user_subscriptions')->fetchAll(PDO::FETCH_ASSOC));
