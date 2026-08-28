<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/statistics/repositories/StatisticsRepository.php';
require_once __DIR__ . '/../modules/statistics/validators/StatisticsValidator.php';
require_once __DIR__ . '/../modules/statistics/services/StatisticsService.php';

function statisticsMysqlAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function statisticsMysqlConnection(): PDO
{
    return new PDO(
        (string) getenv('STATISTICS_TEST_MYSQL_DSN'),
        (string) getenv('STATISTICS_TEST_MYSQL_USER'),
        (string) getenv('STATISTICS_TEST_MYSQL_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
}

$dsn = trim((string) getenv('STATISTICS_TEST_MYSQL_DSN'));
if ($dsn === '') {
    fwrite(STDERR, "STATISTICS_TEST_MYSQL_DSN is required.\n");
    exit(2);
}

if (($argv[1] ?? '') === '--worker') {
    try {
        $db = statisticsMysqlConnection();
        $userId = (string) ($argv[2] ?? 'concurrent-user');
        $service = new StatisticsService(new StatisticsRepository($db), new StatisticsValidator(), $db);
        $service->recordStudySession(
            ['user_id' => $userId, 'role' => 'user'],
            ['practice_seconds' => 1, 'ended_at' => '2026-08-28 12:00:00']
        );
        exit(0);
    } catch (Throwable $error) {
        fwrite(STDERR, $error->getMessage() . PHP_EOL);
        exit(1);
    }
}

$db = statisticsMysqlConnection();
$db->exec('DROP TABLE IF EXISTS study_sessions');
$db->exec('DROP TABLE IF EXISTS subject_statistics');
$db->exec('DROP TABLE IF EXISTS user_statistics');
$db->exec('CREATE TABLE user_statistics (
    user_id VARCHAR(64) PRIMARY KEY,
    total_questions_answered INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
    current_streak INT DEFAULT 0,
    best_streak INT DEFAULT 0,
    total_study_time INT DEFAULT 0,
    question_study_time INT DEFAULT 0,
    reading_study_time INT DEFAULT 0,
    last_activity DATETIME NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB');
$db->exec('CREATE TABLE subject_statistics (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
    average_time INT DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_subject (user_id, subject)
) ENGINE=InnoDB');
$db->exec('CREATE TABLE study_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    practice_study_time INT DEFAULT 0,
    simulation_study_time INT DEFAULT 0,
    reading_study_time INT DEFAULT 0,
    question_study_time INT DEFAULT 0,
    total_study_time INT DEFAULT 0,
    started_at DATETIME NULL,
    ended_at DATETIME NOT NULL,
    source_context JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB');

try {
    $service = new StatisticsService(new StatisticsRepository($db), new StatisticsValidator(), $db);
    $identity = ['user_id' => 'missing-user', 'role' => 'user'];
    $before = (int) $db->query('SELECT COUNT(*) FROM user_statistics')->fetchColumn();
    $neutral = $service->getUserStatistics($identity, ['user_id' => 'missing-user']);
    $afterFirstRead = (int) $db->query('SELECT COUNT(*) FROM user_statistics')->fetchColumn();
    $service->getUserStatistics($identity, ['user_id' => 'missing-user']);
    $afterSecondRead = (int) $db->query('SELECT COUNT(*) FROM user_statistics')->fetchColumn();
    statisticsMysqlAssert($neutral['totalQuestionsAnswered'] === 0, 'Missing user did not receive a neutral DTO.');
    statisticsMysqlAssert($before === 0 && $afterFirstRead === 0 && $afterSecondRead === 0, 'Statistics read persisted a row.');

    $service->recordStudySession($identity, ['practice_seconds' => 5, 'reading_seconds' => 3, 'ended_at' => '2026-08-28 12:00:00']);
    $persisted = $db->query("SELECT * FROM user_statistics WHERE user_id = 'missing-user'")->fetch(PDO::FETCH_ASSOC);
    statisticsMysqlAssert(is_array($persisted), 'Legitimate study mutation did not initialize statistics.');
    statisticsMysqlAssert((int) $persisted['total_study_time'] === 8, 'Legitimate study mutation persisted wrong totals.');

    $existing = $service->getUserStatistics($identity, ['user_id' => 'missing-user']);
    statisticsMysqlAssert($existing['totalStudyTime'] === 8, 'Existing statistics behavior regressed.');

    $db->exec('DELETE FROM study_sessions');
    $db->exec('DELETE FROM user_statistics');
    $workers = [];
    for ($index = 0; $index < 4; $index++) {
        $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' --worker concurrent-user';
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, __DIR__);
        statisticsMysqlAssert(is_resource($process), 'Could not start concurrent statistics worker.');
        $workers[] = [$process, $pipes];
    }
    foreach ($workers as [$process, $pipes]) {
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        statisticsMysqlAssert($exit === 0, 'Concurrent statistics worker failed: ' . trim($stdout . ' ' . $stderr));
    }
    $concurrentRows = (int) $db->query("SELECT COUNT(*) FROM user_statistics WHERE user_id = 'concurrent-user'")->fetchColumn();
    $concurrentTotal = (int) $db->query("SELECT total_study_time FROM user_statistics WHERE user_id = 'concurrent-user'")->fetchColumn();
    statisticsMysqlAssert($concurrentRows === 1, 'Concurrent initialization created duplicate statistics rows.');
    statisticsMysqlAssert($concurrentTotal === 4, 'Concurrent initialization lost a study-time update.');

    echo json_encode([
        'engineVersion' => (string) $db->query('SELECT VERSION()')->fetchColumn(),
        'readDbDelta' => $afterSecondRead - $before,
        'firstMutationPersistence' => 'PASS',
        'existingBehavior' => 'PASS',
        'concurrentWorkers' => 4,
        'concurrentRows' => $concurrentRows,
        'concurrentTotalStudyTime' => $concurrentTotal,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    fwrite(STDOUT, "StatisticsReadSideEffectMysqlIntegrationTest: PASS\n");
} finally {
    $db->exec('DROP TABLE IF EXISTS study_sessions');
    $db->exec('DROP TABLE IF EXISTS subject_statistics');
    $db->exec('DROP TABLE IF EXISTS user_statistics');
}
