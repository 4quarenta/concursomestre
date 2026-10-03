<?php
declare(strict_types=1);
require_once __DIR__ . '/../modules/questions/repositories/QuestionsRepository.php';

$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE questions (id INTEGER PRIMARY KEY, publish_status TEXT, import_fingerprint TEXT, source_exam_key TEXT, source_question_number TEXT, source_provider TEXT, source_external_id TEXT)');
$insert = $db->prepare('INSERT INTO questions VALUES (?,?,?,?,?,?,?)');
$insert->execute([1, 'published', 'original-fingerprint', 'same-exam', '1', 'gran', '100']);
$insert->execute([2, 'published', 'colliding-fingerprint', 'same-exam', '1', 'gran', '200']);
$insert->execute([3, 'draft', 'draft-fingerprint', 'draft-exam', '2', 'gran', '300']);
$insert->execute([4, 'published', 'other-provider', 'same-exam', '1', 'other', '100']);
$repository = new QuestionsRepository($db);
// SQLite fixture already has the columns; production readiness is covered by wiring tests.
$ready = new ReflectionProperty(QuestionsRepository::class, 'publicationColumnsEnsured');
$ready->setValue($repository, true);

$cases = [
    ['external match wins over newer exam/number collision', ['colliding-fingerprint', 'same-exam', '1', 'gran', '100'], 1],
    ['unknown external ID does not fall back to exam/number', ['colliding-fingerprint', 'same-exam', '1', 'gran', '999'], null],
    ['provider is part of external identity', ['colliding-fingerprint', 'same-exam', '1', 'missing-provider', '100'], null],
    ['external identity is trimmed', ['', '', '', ' gran ', ' 100 '], 1],
    ['draft identity remains available for publication', ['', '', '', 'gran', '300'], 3],
    ['legacy fingerprint without external ID', ['original-fingerprint', '', '', 'gran', ''], 1],
    ['legacy exam and number without external ID', ['', 'same-exam', '1', null, null], 4],
    ['empty identity does not match', ['', '', '', null, null], null],
];
foreach ($cases as [$name, $arguments, $expected]) {
    $row = $repository->findQuestionByImportIdentity(...$arguments);
    $actual = $row === null ? null : (int) $row['id'];
    if ($actual !== $expected) throw new RuntimeException($name . ': unexpected identity match');
}
echo 'Imported question identity priority: PASS ' . count($cases) . '/' . count($cases) . PHP_EOL;
