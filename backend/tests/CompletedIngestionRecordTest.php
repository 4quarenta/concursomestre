<?php
declare(strict_types=1);
require_once __DIR__ . '/../modules/questions/services/CompletedIngestionRecord.php';
$payload = ['exam' => ['title' => 'Exam', 'fileData' => str_repeat('x', 10000)], 'questions' => [
    ['tempId' => 'q1', 'source' => ['externalId' => '123', 'questionNumber' => '1'], 'content' => 'full question', 'options' => ['answer'], 'filters' => ['subjects' => [['slug' => 'law']]]],
]];
$result = ['count' => 1, 'created' => [$payload], 'batches' => [$payload], 'duplicatesSkipped' => [], 'itemFailures' => []];
$compact = CompletedIngestionRecord::payload($payload, $result);
if (isset($compact['questions'][0]['content']) || isset($compact['exam']['fileData'])) throw new RuntimeException('Raw content retained');
if ($compact['questions'][0]['source'] !== $payload['questions'][0]['source'] || $compact['questions'][0]['tempId'] !== 'q1') throw new RuntimeException('Identity lost');
if (CompletedIngestionRecord::payload($compact, $result) !== $compact) throw new RuntimeException('Not idempotent');
$failed = $result; $failed['itemFailures'] = [['tempId' => 'q1']];
if (CompletedIngestionRecord::payload($payload, $failed) !== $payload) throw new RuntimeException('Retry payload lost');
$multi = ['batches' => [['clientKey' => 'page1', 'payload' => $payload]]];
if (CompletedIngestionRecord::payload($multi, $result)['batches'][0]['clientKey'] !== 'page1') throw new RuntimeException('Client correlation lost');
$summary = CompletedIngestionRecord::result($result);
if ($summary['count'] !== 1 || isset($summary['created']) || isset($summary['batches'])) throw new RuntimeException('Invalid result summary');
echo "Completed ingestion retention: PASS\n";
