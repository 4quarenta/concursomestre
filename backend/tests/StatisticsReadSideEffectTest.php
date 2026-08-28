<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/statistics/repositories/StatisticsRepository.php';
require_once __DIR__ . '/../modules/statistics/validators/StatisticsValidator.php';
require_once __DIR__ . '/../modules/statistics/services/StatisticsService.php';

function statisticsReadAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

final class StatisticsReadFixtureRepository extends StatisticsRepository
{
    public int $findCalls = 0;
    public int $subjectCalls = 0;

    /** @param array<string, mixed>|null $row */
    public function __construct(PDO $db, private ?array $row)
    {
        parent::__construct($db);
    }

    public function findUserStatisticsByUserId(string $userId): ?array
    {
        $this->findCalls++;
        return $this->row;
    }

    public function listSubjectStatisticsByUserId(string $userId): array
    {
        $this->subjectCalls++;
        return [];
    }
}

$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$missingRepository = new StatisticsReadFixtureRepository($db, null);
$service = new StatisticsService($missingRepository, new StatisticsValidator(), $db);
$identity = ['user_id' => 'fixture-user', 'role' => 'user'];

$first = $service->getUserStatistics($identity, ['user_id' => 'fixture-user']);
$second = $service->getUserStatistics($identity, ['user_id' => 'fixture-user']);
statisticsReadAssert($first === $second, 'Repeated empty statistics reads must return a stable neutral DTO.');
statisticsReadAssert($first['userId'] === 'fixture-user', 'Neutral statistics DTO lost user identity.');
statisticsReadAssert($first['totalQuestionsAnswered'] === 0, 'Neutral statistics DTO must contain zero totals.');
statisticsReadAssert($first['lastActivity'] === '', 'Neutral statistics DTO must not invent persisted activity.');
statisticsReadAssert($missingRepository->findCalls === 2, 'Each read must perform only the expected lookup.');
statisticsReadAssert($missingRepository->subjectCalls === 2, 'Subject breakdown read contract changed.');

$existingRow = [
    'user_id' => 'fixture-user',
    'total_questions_answered' => 7,
    'correct_answers' => 5,
    'wrong_answers' => 2,
    'accuracy_rate' => 71.43,
    'current_streak' => 3,
    'best_streak' => 4,
    'total_study_time' => 120,
    'question_study_time' => 90,
    'reading_study_time' => 30,
    'last_activity' => '2026-08-28 12:00:00',
];
$existingRepository = new StatisticsReadFixtureRepository($db, $existingRow);
$existing = (new StatisticsService($existingRepository, new StatisticsValidator(), $db))
    ->getUserStatistics($identity, ['user_id' => 'fixture-user']);
statisticsReadAssert($existing['totalQuestionsAnswered'] === 7, 'Existing statistics contract regressed.');
statisticsReadAssert($existing['totalStudyTime'] === 120, 'Existing study-time aggregate regressed.');

$serviceSource = (string) file_get_contents(__DIR__ . '/../modules/statistics/services/StatisticsService.php');
$readMethod = substr(
    $serviceSource,
    (int) strpos($serviceSource, 'public function getUserStatistics'),
    (int) strpos($serviceSource, 'public function recordStudySession') - (int) strpos($serviceSource, 'public function getUserStatistics')
);
foreach (['createUserStatistics', 'ensureStudyTimeSchema', 'ensureSubjectStatisticsTable', 'INSERT ', 'UPDATE ', 'DELETE '] as $writeSignal) {
    statisticsReadAssert(!str_contains($readMethod, $writeSignal), 'Statistics read path contains write signal: ' . $writeSignal);
}

fwrite(STDOUT, "StatisticsReadSideEffectTest: PASS\n");
