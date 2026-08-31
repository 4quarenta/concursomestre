<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../modules/exams/repositories/ExamsRepository.php';

$options = getopt('', ['apply', 'backup-dir:', 'limit::']);
$apply = array_key_exists('apply', $options);
$backupDir = rtrim((string) ($options['backup-dir'] ?? (__DIR__ . '/../storage/backups')), DIRECTORY_SEPARATOR);
$limit = isset($options['limit']) ? max(0, (int) $options['limit']) : 0;

$db = (new Database())->getConnection();
$repository = new ExamsRepository($db);
$repository->ensureSchema();

$stmt = $db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'examBank' LIMIT 1");
$stmt->execute();
$raw = $stmt->fetchColumn();

if (!$raw) {
    echo "Nenhum systemSettings.examBank encontrado. Nada a migrar.\n";
    exit(0);
}

$decoded = json_decode((string) $raw, true);
if (!is_array($decoded)) {
    echo "systemSettings.examBank existe, mas nao e JSON valido. Nada foi alterado.\n";
    exit(1);
}

$examBank = array_values(array_filter($decoded, 'is_array'));
if ($limit > 0) {
    $examBank = array_slice($examBank, 0, $limit);
}

if (!$examBank) {
    echo "examBank esta vazio. Nada a migrar.\n";
    exit(0);
}

if (!is_dir($backupDir)) {
    mkdir($backupDir, 0775, true);
}
$backupPath = $backupDir . DIRECTORY_SEPARATOR . 'exam_bank_legacy_' . date('Ymd_His') . '.json';
file_put_contents($backupPath, json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

$summary = [
    'mode' => $apply ? 'apply' : 'dry-run',
    'backup' => $backupPath,
    'seen' => count($examBank),
    'created_or_updated' => 0,
    'skipped' => 0,
    'errors' => [],
];

foreach ($examBank as $index => $exam) {
    $name = trim((string) ($exam['nome'] ?? $exam['name'] ?? ''));
    if ($name === '') {
        $summary['skipped']++;
        $summary['errors'][] = [
            'index' => $index,
            'reason' => 'nome_vazio',
        ];
        continue;
    }

    $payload = $exam;
    $payload['metadata'] = array_merge($exam['metadata'] ?? [], [
        'legacySource' => 'systemSettings.examBank',
        'legacyMigratedAt' => date(DATE_ATOM),
        'legacyIndex' => $index,
    ]);

    if (!$apply) {
        $summary['created_or_updated']++;
        continue;
    }

    try {
        $repository->save($payload, 'legacy-exam-bank-migration');
        $summary['created_or_updated']++;
    } catch (Throwable $exception) {
        $summary['errors'][] = [
            'index' => $index,
            'name' => $name,
            'reason' => $exception->getMessage(),
        ];
    }
}

$reportPath = $backupDir . DIRECTORY_SEPARATOR . 'exam_bank_legacy_report_' . date('Ymd_His') . '.json';
file_put_contents($reportPath, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
echo "Relatorio: {$reportPath}\n";