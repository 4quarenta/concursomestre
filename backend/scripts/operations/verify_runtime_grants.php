<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Runtime grant verifier is CLI-only.\n");
}

require_once __DIR__ . '/RuntimeGrantContract.php';

$options = getopt('', ['required::']);
$required = [];
if (is_array($options) && isset($options['required'])) {
    $required = array_values(array_filter(array_map('trim', explode(',', (string) $options['required']))));
}

$lines = file('php://stdin', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
$result = RuntimeGrantContract::evaluate($lines, $required);
echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
exit($result['ok'] === true ? 0 : 2);
