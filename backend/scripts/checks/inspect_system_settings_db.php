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

try {
    echo "--- Estrutura da tabela system_settings ---\n";
    $stmt = $db->query("DESCRIBE system_settings");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }

    echo "\n--- Conteúdo atual (chaves) ---\n";
    $stmt = $db->query("SELECT key_name FROM system_settings");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $row['key_name'] . "\n";
    }

    echo "\n--- Verificando se existe índice UNIQUE em key_name ---\n";
    $stmt = $db->query("SHOW INDEX FROM system_settings WHERE Column_name = 'key_name'");
    $index = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($index) {
        echo "Índice UNIQUE encontrado em key_name.\n";
    } else {
        echo "AVISO: Índice UNIQUE NÃO encontrado em key_name! O 'ON DUPLICATE KEY UPDATE' não funcionará como esperado.\n";
    }

} catch (Exception $e) {
    echo "Erro: " . $e->getMessage();
}
?>
