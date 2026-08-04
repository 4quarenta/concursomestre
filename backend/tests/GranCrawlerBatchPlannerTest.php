<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/questions/services/PrivateQuestionIngestionService.php';

function granBatchPlannerAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

final class GranBatchPlannerPdo extends PDO
{
    public function __construct()
    {
    }
}

/** @return array<string,mixed> */
function granBatchPayload(int $start, int $count, string $examKey): array
{
    $questions = [];
    for ($offset = 0; $offset < $count; $offset++) {
        $number = $start + $offset;
        $questions[] = [
            'tempId' => 'q_' . $number,
            'source' => [
                'provider' => 'gran',
                'externalId' => (string) $number,
                'questionNumber' => $number,
            ],
            'content' => ['statement' => 'Questao ' . $number],
            'questions' => [],
        ];
    }

    return [
        'schemaVersion' => 'question-import.v2',
        'exam' => ['sourceKey' => $examKey, 'questionRange' => ['start' => $start, 'end' => $start + $count - 1, 'total' => $count]],
        'contexts' => [],
        'questions' => $questions,
    ];
}

putenv('QUESTION_INGESTION_MAX_QUESTIONS_PER_JOB=1000');
putenv('QUESTION_INGESTION_MAX_BODY_BYTES=15000000');

$service = new PrivateQuestionIngestionService(new GranBatchPlannerPdo());
$split = new ReflectionMethod(PrivateQuestionIngestionService::class, 'splitCanonicalPayloads');
$split->setAccessible(true);
$flatten = new ReflectionMethod(PrivateQuestionIngestionService::class, 'flattenPayloadQuestions');
$flatten->setAccessible(true);
$validateCount = new ReflectionMethod(PrivateQuestionIngestionService::class, 'assertBatchQuestionCount');
$validateCount->setAccessible(true);
$sanitizeFailure = new ReflectionMethod(PrivateQuestionIngestionService::class, 'sanitizePublicFailureMessage');
$sanitizeFailure->setAccessible(true);

foreach ([51, 1000] as $count) {
    $jobs = $split->invoke($service, [granBatchPayload(1, $count, 'exam-single')]);
    granBatchPlannerAssert(count($jobs) === 1, $count . ' questoes deveriam permanecer em um job.');
}

$jobs = $split->invoke($service, [granBatchPayload(1, 5000, 'exam-large')]);
granBatchPlannerAssert(count($jobs) === 5, '5.000 questoes devem ser divididas em cinco jobs de 1.000.');
foreach ($jobs as $job) {
    $questions = $flatten->invoke($service, $job);
    granBatchPlannerAssert(count($questions) <= 1000, 'Um job excedeu 1.000 questoes.');
    granBatchPlannerAssert(
        strlen(json_encode($job, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)) <= 15_000_000,
        'Um job excedeu 15 MB.'
    );
}

$smallExamPayloads = [];
for ($exam = 0; $exam < 100; $exam++) {
    $smallExamPayloads[] = granBatchPayload(($exam * 10) + 1, 10, 'exam-' . $exam);
}
$jobs = $split->invoke($service, $smallExamPayloads);
granBatchPlannerAssert(count($jobs) === 2, 'Cem provas pequenas devem ser compactadas em dois jobs de ate 50 provas.');
granBatchPlannerAssert(count($jobs[0]['batches'] ?? []) === 50, 'O primeiro job deveria conter 50 provas.');

$validateCount->invoke(null, 5000);
$rejected = false;
try {
    $validateCount->invoke(null, 5001);
} catch (ReflectionException $exception) {
    throw $exception;
} catch (Throwable $exception) {
    $cause = $exception instanceof ReflectionException ? $exception : ($exception->getPrevious() ?: $exception);
    $rejected = $cause instanceof InvalidArgumentException;
}
granBatchPlannerAssert($rejected, 'Uma submissao de 5.001 questoes deve ser rejeitada.');

granBatchPlannerAssert(
    $sanitizeFailure->invoke($service, 'A questao nao possui alternativas publicaveis.') === 'A questao nao possui alternativas publicaveis.',
    'Uma mensagem editorial segura deve ser preservada para a revisao.'
);
granBatchPlannerAssert(
    !str_contains($sanitizeFailure->invoke($service, 'SQLSTATE[23000]: INSERT INTO questions falhou'), 'SQLSTATE'),
    'Detalhes internos do banco nao podem ser expostos no card.'
);

fwrite(STDOUT, "GranCrawlerBatchPlannerTest: PASS\n");
