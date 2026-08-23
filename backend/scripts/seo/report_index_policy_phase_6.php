<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Reporter disponivel apenas por CLI.\n");
}

require_once __DIR__ . '/../../modules/seo/reports/IndexPolicyPhase6Reporter.php';

$options = getopt('', ['evidence::']);
$evidence = strtolower(trim((string) ($options['evidence'] ?? 'fixture')));
$db = null;
if ($evidence === 'real-db') {
    require_once __DIR__ . '/../../config/database.php';
    try {
        $db = (new Database('read'))->getConnection();
    } catch (Throwable $error) {
        fwrite(STDERR, "INDEX_POLICY_REAL_DATA_BLOCKED: {$error->getMessage()}\n");
        exit(2);
    }
} elseif ($evidence !== 'fixture') {
    fwrite(STDERR, "Evidence mode must be fixture or real-db.\n");
    exit(2);
}

$report = (new IndexPolicyPhase6Reporter())->report($db);
fwrite(STDOUT, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
exit(($report['valid'] ?? false) === true ? 0 : 1);
