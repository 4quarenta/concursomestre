<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/questions/PublicQuestionVisibilitySql.php';

$db = new PDO('sqlite::memory:');
$db->sqliteCreateFunction('NOW', static fn (): string => '2026-10-27 12:00:00');
$db->exec('CREATE TABLE questions (id INTEGER, publish_status TEXT, visibility_status TEXT, published_sort_at TEXT)');
$db->exec("INSERT INTO questions VALUES
    (1, 'published', 'public', '2026-10-27 15:00:00'),
    (2, 'published', 'public', '2026-10-27 10:00:00'),
    (3, 'scheduled', 'public', '2026-10-27 15:00:00'),
    (4, 'scheduled', 'public', '2026-10-27 10:00:00'),
    (5, 'draft', 'public', '2026-10-27 10:00:00'),
    (6, 'published', 'private', '2026-10-27 10:00:00')");

$where = PublicQuestionVisibilitySql::scaleColumns('q');
$count = (int) $db->query("SELECT COUNT(*) FROM questions q WHERE {$where}")->fetchColumn();
if ($count !== 3) {
    throw new RuntimeException('Published public questions must not be hidden by a future sort timestamp; future scheduled and private questions must remain hidden.');
}

$db->exec('CREATE TABLE filters (id INTEGER, name TEXT, type TEXT)');
$db->exec('CREATE TABLE question_filters (question_id INTEGER, filter_id INTEGER)');
$db->exec("INSERT INTO filters VALUES (1, '1998', 'ano'), (2, '2027', 'ano')");
$db->exec('INSERT INTO question_filters VALUES (1, 1), (3, 2)');
$years = $db->query("SELECT DISTINCT f.name FROM filters f JOIN question_filters qf ON qf.filter_id = f.id JOIN questions q ON q.id = qf.question_id AND {$where} WHERE f.type = 'ano' ORDER BY f.name")->fetchAll(PDO::FETCH_COLUMN);
if ($years !== ['1998']) {
    throw new RuntimeException('The practice year catalog must include years linked to published questions and exclude future scheduled items.');
}

try {
    PublicQuestionVisibilitySql::scaleColumns('q; DROP TABLE questions');
    throw new RuntimeException('SQL aliases must be validated.');
} catch (InvalidArgumentException) {
}

echo "PublicQuestionVisibilitySqlTest: PASS\n";
