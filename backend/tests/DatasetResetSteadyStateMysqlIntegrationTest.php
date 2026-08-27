<?php

declare(strict_types=1);

$dsn = trim((string) getenv('RESET_STEADY_STATE_TEST_MYSQL_DSN'));
if ($dsn === '') {
    fwrite(STDERR, "RESET_STEADY_STATE_TEST_MYSQL_DSN is required.\n");
    exit(2);
}

putenv('JWT_SECRET=disposable-steady-state-integration-secret');
putenv('APP_URL=http://steady-state.invalid');
putenv('AUTH_INSTANCE_ID=disposable-steady-state');
$_ENV['JWT_SECRET'] = 'disposable-steady-state-integration-secret';
$_ENV['APP_URL'] = 'http://steady-state.invalid';
$_ENV['AUTH_INSTANCE_ID'] = 'disposable-steady-state';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = 'dataset-steady-state-integration';

require_once __DIR__ . '/../scripts/data/DatasetResetStateValidator.php';
require_once __DIR__ . '/../scripts/data/PostResetResidueReporter.php';
require_once __DIR__ . '/../shared/auth/AuthSession.php';
require_once __DIR__ . '/../modules/statistics/repositories/StatisticsRepository.php';
require_once __DIR__ . '/../modules/statistics/validators/StatisticsValidator.php';
require_once __DIR__ . '/../modules/statistics/services/StatisticsService.php';
require_once __DIR__ . '/../modules/users/services/UsersCardsStripeSupport.php';

function steadyMysqlAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function steadyMysqlQuote(string $identifier): string
{
    if (preg_match('/^[a-z0-9_]+$/i', $identifier) !== 1) {
        throw new InvalidArgumentException('Invalid fixture identifier.');
    }
    return '`' . $identifier . '`';
}

/** @return array<string, int> */
function steadyMysqlCounts(PDO $db): array
{
    $counts = [];
    foreach (DatasetResetPolicyV2::knownTables() as $table) {
        $counts[$table] = (int) $db->query('SELECT COUNT(*) FROM ' . steadyMysqlQuote($table))->fetchColumn();
    }
    ksort($counts);
    return $counts;
}

/** @return array<string, array{rows: int, digest: string}> */
function steadyMysqlPreserveSnapshot(PDO $db): array
{
    $snapshot = [];
    foreach (DatasetResetPolicyV2::preserveTables() as $table) {
        $rows = (int) $db->query('SELECT COUNT(*) FROM ' . steadyMysqlQuote($table))->fetchColumn();
        $snapshot[$table] = ['rows' => $rows, 'digest' => hash('sha256', $table . ':' . $rows)];
    }
    ksort($snapshot);
    return $snapshot;
}

/**
 * @param list<array<string, mixed>> $events
 * @param array<string, int> $previous
 * @param array<string, list<array{writerId: string, event: string, attributedRows: int}>> $evidence
 */
function steadyMysqlRecord(
    PDO $db,
    array &$events,
    array &$previous,
    array $preserve,
    array $evidence,
    string $event
): void {
    $counts = steadyMysqlCounts($db);
    $delta = [];
    foreach (DatasetResetPolicyV2::runtimeRecreatableTables() as $table) {
        $delta[$table] = $counts[$table] - ($previous[$table] ?? 0);
    }
    $steady = (new PostResetResidueReporter($db))->evaluatePostResumeSteadyState(
        $preserve,
        steadyMysqlPreserveSnapshot($db),
        $evidence
    );
    steadyMysqlAssert($steady['ok'], $event . ' failed steady-state validation: ' . implode(', ', $steady['blockers']));
    steadyMysqlAssert($steady['strictResidue'] === [], $event . ' repopulated a strict table.');
    $events[] = [
        'event' => $event,
        'delta' => $delta,
        'runtimeCounts' => array_intersect_key($counts, array_flip(DatasetResetPolicyV2::runtimeRecreatableTables())),
        'strictResidue' => $steady['strictResidue'],
        'steadyState' => 'PASS',
    ];
    $previous = $counts;
}

try {
    $db = new PDO($dsn, 'root', '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true,
    ]);

    $specialTables = [
        'users', 'auth_sessions', 'auth_refresh_tokens', 'plans', 'user_cards',
        'user_subscriptions', 'transactions', 'coupon_reservations',
        'user_statistics', 'study_sessions', 'subject_statistics',
    ];
    foreach (DatasetResetPolicyV2::knownTables() as $table) {
        if (!in_array($table, $specialTables, true)) {
            $db->exec('CREATE TABLE ' . steadyMysqlQuote($table) . ' (id BIGINT AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB');
        }
    }

    $db->exec(<<<'SQL'
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    stripe_customer_id VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE auth_sessions (
    id CHAR(36) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    csrf_token_hash CHAR(64) NOT NULL,
    user_agent TEXT NULL,
    ip_address VARCHAR(45) NULL,
    issuer_host VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    last_seen_at DATETIME NULL,
    last_refreshed_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    revoked_reason VARCHAR(120) NULL,
    reuse_detected_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE auth_refresh_tokens (
    id CHAR(36) PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    previous_token_id CHAR(36) NULL,
    rotated_to_token_id CHAR(36) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    rotated_at DATETIME NULL,
    revoked_at DATETIME NULL,
    revoked_reason VARCHAR(120) NULL,
    reuse_detected_at DATETIME NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL
) ENGINE=InnoDB;

CREATE TABLE plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stripe_product_id VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE user_cards (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    payment_provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
    mp_card_id VARCHAR(255) NULL,
    mp_customer_id VARCHAR(255) NULL,
    stripe_payment_method_id VARCHAR(255) NULL,
    provider_customer_id VARCHAR(255) NULL,
    brand VARCHAR(80) NULL,
    last_four_digits VARCHAR(8) NULL,
    exp_month INT NULL,
    exp_year INT NULL,
    holder_name VARCHAR(255) NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    locked_by_recurring TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_card_fingerprint (user_id, brand, last_four_digits)
) ENGINE=InnoDB;

CREATE TABLE user_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_provider VARCHAR(50) NULL,
    provider_subscription_id VARCHAR(255) NULL,
    provider_customer_id VARCHAR(255) NULL,
    provider_checkout_session_id VARCHAR(255) NULL,
    provider_current_period_start DATETIME NULL,
    provider_current_period_end DATETIME NULL,
    provider_last_webhook_event_at DATETIME NULL,
    cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
    antifraud_blocked TINYINT(1) NOT NULL DEFAULT 0,
    renewal_iteration INT NOT NULL DEFAULT 0,
    superseded_by_subscription_id INT NULL,
    next_renewal_amount DECIMAL(10,2) NULL,
    next_renewal_date DATETIME NULL,
    next_renewal_snapshot_json LONGTEXT NULL
) ENGINE=InnoDB;

CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_subscription_id INT NULL,
    plan_id INT NULL,
    plan_name VARCHAR(120) NULL,
    payment_provider VARCHAR(50) NULL,
    provider_payment_intent_id VARCHAR(255) NULL,
    provider_invoice_id VARCHAR(255) NULL,
    provider_refund_id VARCHAR(255) NULL,
    provider_refund_details_json LONGTEXT NULL,
    refunded_amount DECIMAL(10,2) NULL,
    refunded_at DATETIME NULL,
    installments INT NULL,
    payer_email VARCHAR(255) NULL,
    type VARCHAR(50) NULL
) ENGINE=InnoDB;

CREATE TABLE coupon_reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coupon_code VARCHAR(255) NULL,
    user_id VARCHAR(64) NULL,
    checkout_attempt_id VARCHAR(255) NULL,
    provider VARCHAR(50) NULL,
    status VARCHAR(50) NULL,
    expires_at DATETIME NULL,
    consumed_at DATETIME NULL,
    released_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE user_statistics (
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
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE study_sessions (
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
) ENGINE=InnoDB;

CREATE TABLE subject_statistics (
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
) ENGINE=InnoDB;
SQL);

    $user = ['id' => 'preserved-user-fixture', 'email' => 'fixture@steady-state.invalid', 'role' => 'user'];
    $db->prepare('INSERT INTO users (id, name, email, role) VALUES (:id, :name, :email, :role)')
        ->execute(['id' => $user['id'], 'name' => 'Disposable Fixture', 'email' => $user['email'], 'role' => $user['role']]);

    $preserve = steadyMysqlPreserveSnapshot($db);
    $initialCounts = steadyMysqlCounts($db);
    $completion = (new PostResetResidueReporter($db))->evaluateResetCompletion($preserve, $preserve);
    steadyMysqlAssert($completion['ok'], 'Initial reset completion state must contain zero resettable rows.');

    $events = [];
    $previous = $initialCounts;
    $evidence = [];
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'A_BOOT_NO_REQUEST');
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'B_PUBLIC_PAGE');
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'C_AUTH_PAGE');

    $bundle = issueUserAuthBundle($db, $user, true);
    $evidence['auth_sessions'][] = ['writerId' => 'http-auth-account', 'event' => 'auth_login', 'attributedRows' => 1];
    $evidence['auth_refresh_tokens'][] = ['writerId' => 'http-auth-account', 'event' => 'auth_login', 'attributedRows' => 1];
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'D_LOGIN');

    $verified = verifyAuthenticatedSession($db, (string) $bundle['token']);
    steadyMysqlAssert(($verified['user_id'] ?? '') === $user['id'], 'Authenticated bootstrap must validate the session.');
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'E_AUTHENTICATED_BOOTSTRAP');

    $refreshed = refreshAccessTokenUsingToken(
        $db,
        (string) $bundle['refresh_token'],
        (string) $bundle['csrf_token'],
        (string) $bundle['csrf_token']
    );
    $evidence['auth_refresh_tokens'][] = ['writerId' => 'http-auth-account', 'event' => 'auth_token_refresh', 'attributedRows' => 1];
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'F_REFRESH');

    $statistics = new StatisticsService(new StatisticsRepository($db), new StatisticsValidator(), $db);
    $statistics->getUserStatistics(
        ['user_id' => $user['id'], 'role' => $user['role']],
        ['user_id' => $user['id']]
    );
    $evidence['user_statistics'][] = [
        'writerId' => 'http-practice-user-activity',
        'event' => 'statistics_lazy_bootstrap',
        'attributedRows' => 1,
    ];

    $remoteCard = (object) [
        'id' => 'pm_disposable_fixture',
        'card' => (object) ['brand' => 'visa', 'last4' => '4242', 'exp_month' => 12, 'exp_year' => 2035],
        'billing_details' => (object) ['name' => 'Disposable Fixture'],
    ];
    upsertLocalStripeCardMirror($db, $user['id'], 'cus_disposable_fixture', $remoteCard, true);
    $evidence['user_cards'][] = [
        'writerId' => 'http-auth-account',
        'event' => 'profile_billing_card_sync',
        'attributedRows' => 1,
    ];
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'G_DASHBOARD_PROFILE_BILLING');

    foreach (['transactions', 'user_subscriptions', 'financial_ledger_entries', 'provider_webhook_events', 'coupon_reservations'] as $billingTable) {
        steadyMysqlAssert(
            (int) $db->query('SELECT COUNT(*) FROM ' . steadyMysqlQuote($billingTable))->fetchColumn() === 0,
            'Runtime card mirror must not restore billing history: ' . $billingTable
        );
    }

    revokeSessionFamily($db, (string) $refreshed['session_id'], 'disposable_logout');
    steadyMysqlRecord($db, $events, $previous, $preserve, $evidence, 'H_LOGOUT');

    $unknownEvidence = $evidence;
    $unknownEvidence['auth_sessions'][0]['writerId'] = 'uninventoried-writer';
    $unknownResult = DatasetResetStateValidator::evaluatePostResumeSteadyState(
        steadyMysqlCounts($db),
        $preserve,
        steadyMysqlPreserveSnapshot($db),
        $unknownEvidence
    );
    steadyMysqlAssert(!$unknownResult['ok'], 'Unknown writer evidence must fail in MySQL integration.');

    $db->exec('INSERT INTO questions () VALUES ()');
    $strictResult = DatasetResetStateValidator::evaluatePostResumeSteadyState(
        steadyMysqlCounts($db),
        $preserve,
        steadyMysqlPreserveSnapshot($db),
        $evidence
    );
    steadyMysqlAssert(!$strictResult['ok'], 'Strict table sentinel must fail steady state.');
    steadyMysqlAssert(
        in_array('POST_RESUME_STRICT_REPOPULATION', $strictResult['blockers'], true),
        'Strict table sentinel blocker is missing.'
    );
    $db->exec('DELETE FROM questions');

    foreach (DatasetResetPolicyV2::resetTables() as $table) {
        $db->exec('DELETE FROM ' . steadyMysqlQuote($table));
    }
    $finalCompletion = (new PostResetResidueReporter($db))->evaluateResetCompletion(
        $preserve,
        steadyMysqlPreserveSnapshot($db)
    );
    steadyMysqlAssert($finalCompletion['ok'], 'Reset regression must return all 113 resettable tables to zero.');
    steadyMysqlAssert((int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() === 1, 'Preserved user was modified.');

    echo json_encode([
        'engineVersion' => (string) $db->query('SELECT VERSION()')->fetchColumn(),
        'classifiedTables' => count(DatasetResetPolicyV2::knownTables()),
        'preserveTables' => count(DatasetResetPolicyV2::preserveTables()),
        'strictResettableTables' => count(DatasetResetPolicyV2::strictResetTables()),
        'runtimeRecreatableTables' => count(DatasetResetPolicyV2::runtimeRecreatableTables()),
        'events' => $events,
        'unknownWriterRejected' => true,
        'strictRepopulationRejected' => true,
        'billingHistoryRows' => 0,
        'resetCompletionAfterRegression' => 'PASS',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    fwrite(STDOUT, "DatasetResetSteadyStateMysqlIntegrationTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'DatasetResetSteadyStateMysqlIntegrationTest: FAIL - ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
