<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Esta tarefa so pode ser executada via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/repositories/QuestionsRepository.php';
require_once __DIR__ . '/../../modules/questions/services/GranExamFileMaterializer.php';

$limit = max(1, min(1000, (int) ($argv[1] ?? 250)));
$afterId = max(0, (int) ($argv[2] ?? 0));
$db = (new Database())->getConnection();
$repository = new QuestionsRepository($db);
$materializer = new GranExamFileMaterializer();

$stmt = $db->prepare(
    "SELECT id, source_external_id, metadata_json
     FROM provas
     WHERE source_provider = 'gran'
       AND id > :after_id
       AND metadata_json IS NOT NULL
       AND metadata_json LIKE '%sourceUrl%'
     ORDER BY id ASC
     LIMIT {$limit}"
);
$stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
$stmt->execute();

$result = [
    'examined' => 0,
    'materializedExams' => 0,
    'attachedFiles' => 0,
    'skipped' => 0,
    'failures' => [],
    'lastExamId' => $afterId,
];

foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $examId = (int) ($row['id'] ?? 0);
    $result['examined']++;
    $result['lastExamId'] = max($result['lastExamId'], $examId);
    $metadata = json_decode((string) ($row['metadata_json'] ?? ''), true);
    if (!is_array($metadata)) {
        $result['skipped']++;
        continue;
    }

    $candidates = [];
    foreach ([$metadata['raw']['files'] ?? null, $metadata['files'] ?? null, $metadata['examFiles'] ?? null] as $files) {
        if (!is_array($files)) {
            continue;
        }
        foreach ($files as $file) {
            if (!is_array($file) || trim((string) ($file['sourceUrl'] ?? '')) === '') {
                continue;
            }
            $kind = strtolower(trim((string) ($file['kind'] ?? '')));
            if (in_array($kind, ['edital', 'prova', 'gabarito'], true) && !isset($candidates[$kind])) {
                $candidates[$kind] = $file;
            }
        }
    }
    if ($candidates === []) {
        $result['skipped']++;
        continue;
    }

    try {
        $payload = $materializer->materialize([
            'import' => ['diagnostics' => []],
            'exam' => [
                'externalId' => trim((string) ($row['source_external_id'] ?? '')) ?: (string) $examId,
                'files' => array_values($candidates),
            ],
            'questions' => [],
        ]);
        $files = is_array($payload['exam']['files'] ?? null) ? $payload['exam']['files'] : [];
        if ($files === []) {
            $result['failures'][] = [
                'examId' => $examId,
                'diagnostics' => $payload['import']['diagnostics'] ?? ['Nenhum arquivo foi materializado.'],
            ];
            continue;
        }
        $attached = $repository->attachMaterializedExamFiles($examId, $files);
        $result['materializedExams']++;
        $result['attachedFiles'] += $attached;
    } catch (Throwable $exception) {
        $result['failures'][] = ['examId' => $examId, 'message' => $exception->getMessage()];
    }
}

$result['finishedAt'] = gmdate('c');
fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);

