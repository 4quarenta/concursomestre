<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/simulations/repositories/SimulationsRepository.php';
require_once dirname(__DIR__) . '/modules/simulations/validators/SimulationsValidator.php';
require_once dirname(__DIR__) . '/modules/questions/repositories/QuestionsRepository.php';
require_once dirname(__DIR__) . '/modules/questions/services/QuestionAnswerEvaluator.php';
require_once dirname(__DIR__) . '/modules/simulations/services/SimulationsService.php';

function assertSimulationCreation(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

class RecordingSimulationsRepository extends SimulationsRepository
{
    /** @var array<int, string> */
    public array $events = [];
    public ?string $existingOwnerId = null;

    public function __construct()
    {
    }

    public function transactional(callable $callback): mixed
    {
        $this->events[] = 'begin';
        try {
            $result = $callback();
            $this->events[] = 'commit';
            return $result;
        } catch (Throwable $e) {
            $this->events[] = 'rollback';
            throw $e;
        }
    }

    public function findSimulationOwnerIdForUpdate(string $simulationId): ?string
    {
        $this->events[] = 'owner:' . $simulationId;
        return $this->existingOwnerId;
    }

    public function upsertSimulation(array $payload): void
    {
        $this->events[] = 'parent:' . (string) $payload['id'];
    }

    public function upsertSimulationAnswer(array $payload): void
    {
        $this->events[] = 'answer:' . (string) $payload['question_id'];
    }

    public function deleteStaleSimulationAnswers(string $userId, string $simulationId, array $questionIds): void
    {
        $this->events[] = 'cleanup:' . $simulationId;
    }

    public function applySimulationCompletedGamification(
        string $userId,
        string $simulationId,
        string $simulationName,
        int $answeredCount,
        int $correctCount
    ): array {
        $this->events[] = 'gamification:' . $simulationId;
        return ['applied' => true, 'badge_awarded' => false, 'xp' => 10];
    }

    public function findUserProgressSnapshot(string $userId): ?array
    {
        return ['xp' => 10, 'level' => 1];
    }
}

class SimulationQuestionsRepositoryStub extends QuestionsRepository
{
    public function __construct()
    {
    }

    public function findQuestionAnswerKeysByIds(array $questionIds): array
    {
        $questions = [];
        foreach ($questionIds as $questionId) {
            $questions[(string) $questionId] = ['id' => (int) $questionId];
        }
        return $questions;
    }
}

class SimulationAnswerEvaluatorStub extends QuestionAnswerEvaluator
{
    public function evaluate(array $question, int $selectedOptionIndex): array
    {
        return [
            'selectedOptionIndex' => $selectedOptionIndex,
            'correctOptionIndex' => 1,
            'isCorrect' => $selectedOptionIndex === 1,
        ];
    }
}

function buildSimulationServiceForTest(RecordingSimulationsRepository $repository): SimulationsService
{
    return new SimulationsService(
        $repository,
        new SimulationsValidator(),
        new SimulationQuestionsRepositoryStub(),
        new SimulationAnswerEvaluatorStub()
    );
}

$payload = [
    'id' => 'sim-new',
    'status' => 'completed',
    'score' => 999,
    'startTime' => 1000,
    'endTime' => 2000,
    'config' => ['name' => 'Simulado de regressao'],
    'answers' => ['7' => ['index' => 1, 'time_taken' => 15]],
];
$auth = ['user_id' => 'user-owner'];

$repository = new RecordingSimulationsRepository();
$result = buildSimulationServiceForTest($repository)->saveSimulation($payload, $auth);

$parentPosition = array_search('parent:sim-new', $repository->events, true);
$answerPosition = array_search('answer:7', $repository->events, true);
$commitPosition = array_search('commit', $repository->events, true);
assertSimulationCreation($parentPosition !== false, 'Simulation parent was not persisted.');
assertSimulationCreation($answerPosition !== false, 'Simulation answer was not persisted.');
assertSimulationCreation($parentPosition < $answerPosition, 'Simulation parent must be persisted before user_answers.');
assertSimulationCreation($commitPosition !== false && $answerPosition < $commitPosition, 'Answers must be committed atomically with the simulation.');
assertSimulationCreation(($result['score'] ?? null) === 1, 'Score must be calculated by the backend.');

$foreignRepository = new RecordingSimulationsRepository();
$foreignRepository->existingOwnerId = 'another-user';
$blocked = false;
try {
    buildSimulationServiceForTest($foreignRepository)->saveSimulation($payload, $auth);
} catch (DomainException) {
    $blocked = true;
}

assertSimulationCreation($blocked, 'A user must not overwrite another user simulation.');
assertSimulationCreation(in_array('rollback', $foreignRepository->events, true), 'Ownership failure must roll back the transaction.');
assertSimulationCreation(!in_array('parent:sim-new', $foreignRepository->events, true), 'Foreign simulation must not be changed.');

$routesSource = file_get_contents(dirname(__DIR__) . '/modules/simulations/routes.php');
assertSimulationCreation(is_string($routesSource), 'Unable to read simulations routes.');
$pdoCatchPosition = strpos($routesSource, 'catch (PDOException $e)');
$runtimeCatchPosition = strpos($routesSource, 'catch (RuntimeException $e)');
assertSimulationCreation(
    $pdoCatchPosition !== false && $runtimeCatchPosition !== false && $pdoCatchPosition < $runtimeCatchPosition,
    'PDOException must be handled before RuntimeException to avoid false unauthorized responses.'
);

fwrite(STDOUT, "Simulation creation transaction assertions passed.\n");
