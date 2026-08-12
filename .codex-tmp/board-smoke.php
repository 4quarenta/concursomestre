<?php

declare(strict_types=1);

$release = rtrim((string) ($argv[1] ?? ''), '/');
if ($release === '') {
    fwrite(STDERR, "release path required\n");
    exit(2);
}

require_once $release . '/backend/config/database.php';
require_once $release . '/backend/modules/filters/repositories/FiltersRepository.php';
require_once $release . '/backend/modules/filters/validators/FiltersValidator.php';
require_once $release . '/backend/modules/filters/services/FiltersService.php';

$db = (new Database())->getConnection();
$service = new FiltersService(new FiltersRepository($db), new FiltersValidator());
$payload = $service->getPublicBoardDetail('avanca-sp', 1, 12, 'all');
if (!is_array($payload)) {
    fwrite(STDERR, "board not found\n");
    exit(1);
}

fwrite(STDOUT, json_encode([
    'board' => $payload['board'] ?? null,
    'summary' => $payload['examSummary'] ?? null,
    'exams' => count($payload['exams'] ?? []),
    'subjects' => count($payload['topSubjects'] ?? []),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL);
