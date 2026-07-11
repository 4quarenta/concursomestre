<?php

declare(strict_types=1);

http_response_code(410);
header('Content-Type: application/json; charset=UTF-8');
echo json_encode([
    'success' => false,
    'message' => 'O crawler legado da Gran foi removido por seguranca.',
]);
exit;
