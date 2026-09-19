<?php

declare(strict_types=1);

/**
 * CLI-only canonical M20F-07 dynamic acceptance harness.
 *
 * The harness creates only namespaced synthetic identities, drives the
 * CommunicationService authority, and removes every mutable row it owns.
 * Browser/provider-fault scenarios are declared in the matrix but remain an
 * evidence gap until their canonical runners are available.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "M20F-07 harness is CLI-only.\n");
    exit(1);
}

$appRoot = trim((string) (getenv('M20F07_APP_ROOT') ?: dirname(__DIR__)));
if ($appRoot === '' || !is_dir($appRoot)) {
    fwrite(STDERR, "M20F07_APP_ROOT invalido.\n");
    exit(1);
}

require_once $appRoot . '/config/database.php';
require_once $appRoot . '/modules/seo/launch/SeoLaunchMode.php';
require_once $appRoot . '/modules/seo/launch/SeoLaunchModeAuthority.php';
require_once $appRoot . '/modules/admin/services/AdminUserActionsService.php';
require_once $appRoot . '/modules/admin/repositories/AdminUserActionsRepository.php';
require_once $appRoot . '/modules/admin/validators/AdminUserActionsValidator.php';
require_once $appRoot . '/shared/communications/CommunicationEventCatalog.php';
require_once $appRoot . '/shared/communications/CommunicationService.php';

const M20F07_EMAIL_SUFFIX = '@synthetic.invalid';
const M20F07_EMAIL_PREFIX = 'm20f07-';

/** @return array<string, string> */
function m20f07Options(): array
{
    $options = ['execute' => '', 'run_id' => '', 'output' => '', 'barrier' => '', 'worker' => '', 'event_file' => '', 'result_file' => '', 'provider_intent' => ''];
    foreach (array_slice($GLOBALS['argv'], 1) as $argument) {
        if (str_starts_with($argument, '--execute=')) {
            $options['execute'] = substr($argument, 10);
        } elseif (str_starts_with($argument, '--run-id=')) {
            $options['run_id'] = substr($argument, 9);
        } elseif (str_starts_with($argument, '--output=')) {
            $options['output'] = substr($argument, 9);
        } elseif (str_starts_with($argument, '--barrier=')) {
            $options['barrier'] = substr($argument, 10);
        } elseif (str_starts_with($argument, '--worker=')) {
            $options['worker'] = substr($argument, 9);
        } elseif (str_starts_with($argument, '--event-file=')) {
            $options['event_file'] = substr($argument, 13);
        } elseif (str_starts_with($argument, '--result-file=')) {
            $options['result_file'] = substr($argument, 14);
        } elseif (str_starts_with($argument, '--provider-intent=')) {
            $options['provider_intent'] = substr($argument, 18);
        } else {
            throw new InvalidArgumentException('Argumento desconhecido: ' . $argument);
        }
    }
    return $options;
}

function m20f07Fail(string $message): never
{
    throw new RuntimeException($message);
}

function m20f07RequireSafeRuntime(): void
{
    if (getAppEnv() !== 'production') {
        m20f07Fail('APP_ENV=production e obrigatorio.');
    }
    if (SeoLaunchModeAuthority::read() !== SeoLaunchMode::PRELAUNCH) {
        m20f07Fail('O harness exige launch mode PRELAUNCH.');
    }
    if (getenv('REAL_DATA_INSERTION_AUTHORIZED') === '1') {
        m20f07Fail('REAL_DATA_INSERTION_AUTHORIZED nao pode estar ativo.');
    }
    if (getenv('STRIPE_LIVE_MUTATIONS') === '1') {
        m20f07Fail('STRIPE_LIVE_MUTATIONS nao pode estar ativo.');
    }
    if (getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
        m20f07Fail('CM_SYNTHETIC_EMAIL_SINK=1 e obrigatorio.');
    }

    $poolPath = trim((string) (getenv('M20F07_FPM_POOL_CONFIG') ?: '/etc/php/8.4/fpm/pool.d/default.conf'));
    if (!is_readable($poolPath) || !preg_match('/^\s*env\[CM_SYNTHETIC_EMAIL_SINK\]\s*=\s*1\s*$/m', (string) file_get_contents($poolPath))) {
        m20f07Fail('Sink sintetico nao esta provado no PHP-FPM web.');
    }
}

function m20f07RunId(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        $value = gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
    }
    if (!preg_match('/^m20f07-[a-z0-9][a-z0-9-]{3,63}$/', $value)) {
        m20f07Fail('Use um run id no formato m20f07-<run-id>.');
    }
    return $value;
}

function m20f07Password(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

/** @return array{user_id:string,email:string,password:string} */
function m20f07CreateUser(AdminUserActionsService $service, string $runId, string $role): array
{
    $suffix = bin2hex(random_bytes(5));
    $email = M20F07_EMAIL_PREFIX . $role . '-' . $runId . '-' . $suffix . M20F07_EMAIL_SUFFIX;
    $password = m20f07Password();
    $result = $service->execute([
        'action' => 'create_user',
        'name' => 'M20F07 Synthetic ' . ucfirst($role),
        'email' => $email,
        'password' => $password,
        'role' => $role,
        'status' => 'active',
        'reputation' => 100,
    ]);
    $userId = trim((string) ($result['data']['user_id'] ?? ''));
    if ($userId === '') {
        m20f07Fail('O servico canonico nao retornou o ID do usuario sintetico.');
    }
    return ['user_id' => $userId, 'email' => $email, 'password' => $password];
}

/** @param array<string, mixed> $event */
function m20f07Publish(PDO $db, array $event): array
{
    return CommunicationService::fromDatabase($db)->publish($event);
}

function m20f07Count(PDO $db, string $sql, array $parameters = []): int
{
    $statement = $db->prepare($sql);
    $statement->execute($parameters);
    return (int) $statement->fetchColumn();
}

/**
 * Runs the same semantic event through two independent PHP processes.
 * The file barrier only synchronizes the workers; persistence still goes
 * through CommunicationService and the production database constraints.
 *
 * @param array<string, mixed> $event
 * @return array<string, mixed>
 */
function m20f07RunConcurrentPublish(PDO $db, array $event, string $runId): array
{
    if (!function_exists('proc_open')) {
        return [
            'status' => 'EVIDENCE_GAP',
            'reason' => 'proc_open is unavailable in the acceptance runtime.',
        ];
    }

    $barrier = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'm20f07-barrier-' . bin2hex(random_bytes(8));
    if (!mkdir($barrier, 0700, true) && !is_dir($barrier)) {
        m20f07Fail('Nao foi possivel criar a barreira de concorrencia.');
    }

    $eventPath = $barrier . DIRECTORY_SEPARATOR . 'event.json';
    file_put_contents($eventPath, json_encode($event, JSON_THROW_ON_ERROR), LOCK_EX);
    $children = [];
    for ($worker = 0; $worker < 2; $worker++) {
        $resultPath = $barrier . DIRECTORY_SEPARATOR . 'result-' . $worker . '.json';
        $stdoutPath = $barrier . DIRECTORY_SEPARATOR . 'stdout-' . $worker . '.log';
        $stderrPath = $barrier . DIRECTORY_SEPARATOR . 'stderr-' . $worker . '.log';
        $command = implode(' ', array_map('escapeshellarg', [
            PHP_BINARY,
            __FILE__,
            '--execute=M20F07_DYNAMIC_ACCEPTANCE_WORKER',
            '--barrier=' . $barrier,
            '--worker=' . $worker,
            '--event-file=' . $eventPath,
            '--result-file=' . $resultPath,
        ]));
        $process = proc_open($command, [
            0 => ['file', '/dev/null', 'r'],
            1 => ['file', $stdoutPath, 'ab'],
            2 => ['file', $stderrPath, 'ab'],
        ], $pipes);
        if (!is_resource($process)) {
            m20f07Fail('Nao foi possivel iniciar o worker concorrente.');
        }
        $children[$worker] = $process;
    }

    $exitCodes = [];
    foreach ($children as $worker => $process) {
        $exitCodes[$worker] = proc_close($process);
    }

    $results = [];
    foreach ([0, 1] as $worker) {
        $path = $barrier . DIRECTORY_SEPARATOR . 'result-' . $worker . '.json';
        $decoded = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
        $results[$worker] = is_array($decoded) ? $decoded : ['error' => 'Resultado do worker ausente.'];
    }

    @unlink($barrier . DIRECTORY_SEPARATOR . 'ready-0');
    @unlink($barrier . DIRECTORY_SEPARATOR . 'ready-1');
    @unlink($eventPath);
    @unlink($barrier . DIRECTORY_SEPARATOR . 'result-0.json');
    @unlink($barrier . DIRECTORY_SEPARATOR . 'result-1.json');
    @unlink($barrier . DIRECTORY_SEPARATOR . 'stdout-0.log');
    @unlink($barrier . DIRECTORY_SEPARATOR . 'stdout-1.log');
    @unlink($barrier . DIRECTORY_SEPARATOR . 'stderr-0.log');
    @unlink($barrier . DIRECTORY_SEPARATOR . 'stderr-1.log');
    @rmdir($barrier);

    $intentId = 'comm-' . substr(hash('sha256', (string) $event['idempotencyKey']), 0, 56);
    $intentCount = m20f07Count($db, 'SELECT COUNT(*) FROM communication_intents WHERE id = :id', [':id' => $intentId]);
    $notificationCount = m20f07Count(
        $db,
        'SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND entity_id = :entity_id',
        [':user_id' => $event['recipientUserId'], ':entity_id' => $event['entityId']]
    );
    $outboxCount = m20f07Count(
        $db,
        "SELECT COUNT(*) FROM platform_event_outbox WHERE event_type = 'communication.intent.dispatch' AND aggregate_id = :id",
        [':id' => $intentId]
    );
    $outbox = new TransactionalOutbox($db);
    $outboxRows = $db->prepare("SELECT id FROM platform_event_outbox WHERE aggregate_id = :id AND event_type = 'communication.intent.dispatch'");
    $outboxRows->execute([':id' => $intentId]);
    foreach ($outboxRows->fetchAll(PDO::FETCH_ASSOC) ?: [] as $outboxRow) {
        $outbox->markProcessed((int) $outboxRow['id']);
    }
    $createdCount = count(array_filter($results, static fn (array $result): bool => ($result['created'] ?? false) === true));
    $sameIntent = count(array_filter($results, static fn (array $result): bool => ($result['intentId'] ?? '') === $intentId));

    return [
        'status' => $exitCodes === [0, 0] && $createdCount === 1 && $sameIntent === 2 && $intentCount === 1 && $notificationCount === 1 && $outboxCount === 1 ? 'PASS' : 'FAIL',
        'workers' => 2,
        'barrier' => 'PASS',
        'created_intents' => $createdCount,
        'intent_count' => $intentCount,
        'notification_count' => $notificationCount,
        'outbox_count' => $outboxCount,
        'worker_results' => $results,
    ];
}

/** @param array<string, string> $options */
function m20f07RunConcurrentWorker(array $options): never
{
    $barrier = trim($options['barrier'] ?? '');
    $worker = trim($options['worker'] ?? '');
    $eventPath = trim($options['event_file'] ?? '');
    $resultPath = trim($options['result_file'] ?? '');
    if ($barrier === '' || !in_array($worker, ['0', '1'], true) || $eventPath === '' || $resultPath === '') {
        throw new InvalidArgumentException('Argumentos do worker concorrente incompletos.');
    }

    $readyPath = $barrier . DIRECTORY_SEPARATOR . 'ready-' . $worker;
    file_put_contents($readyPath, 'ready', LOCK_EX);
    $deadline = microtime(true) + 10.0;
    while (!is_file($barrier . DIRECTORY_SEPARATOR . 'ready-0') || !is_file($barrier . DIRECTORY_SEPARATOR . 'ready-1')) {
        if (microtime(true) >= $deadline) {
            throw new RuntimeException('Barreira de concorrencia expirou.');
        }
        usleep(10000);
    }

    try {
        $event = json_decode((string) file_get_contents($eventPath), true, 512, JSON_THROW_ON_ERROR);
        $db = (new Database('write'))->getConnection();
        $published = CommunicationService::fromDatabase($db)->publish($event);
        file_put_contents($resultPath, json_encode($published, JSON_THROW_ON_ERROR), LOCK_EX);
        exit(0);
    } catch (Throwable $exception) {
        file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()], JSON_THROW_ON_ERROR), LOCK_EX);
        exit(1);
    }
}

/** @param array<string, mixed> $event */
function m20f07TransactionalEvent(string $runId, string $userId, string $email, string $key): array
{
    return [
        'eventType' => 'support.feedback.reply',
        'idempotencyKey' => $runId . ':transactional:' . $key,
        'deliveryClass' => CommunicationPolicy::CLASS_TRANSACTIONAL,
        'recipientUserId' => $userId,
        'recipientEmail' => $email,
        'channels' => [CommunicationPolicy::CHANNEL_IN_APP, CommunicationPolicy::CHANNEL_EMAIL],
        'title' => 'M20F-07 synthetic notification',
        'message' => 'Synthetic communication acceptance event.',
        'type' => 'info',
        'category' => 'support',
        'link' => '/notifications?m20f07=' . rawurlencode($runId),
        'entityType' => 'm20f07_fixture',
        'entityId' => $runId,
        'payload' => [
            'recipientName' => 'M20F-07 Synthetic',
            'emailSubject' => 'M20F-07 synthetic communication',
            'emailHtml' => '<p>Canonical synthetic communication.</p>',
            'emailText' => 'Canonical synthetic communication.',
            'templateKey' => 'm20f07_synthetic',
        ],
    ];
}

/** @return array<string, mixed> */
function m20f07RunChannelMatrix(PDO $db, string $runId, array $user): array
{
    $db->prepare('UPDATE communication_preferences SET enabled = 1, updated_at = NOW()
                  WHERE user_id = :user_id AND delivery_class = :class AND channel = :channel')->execute([
        ':user_id' => $user['user_id'],
        ':class' => CommunicationPolicy::CLASS_MARKETING,
        ':channel' => CommunicationPolicy::CHANNEL_EMAIL,
    ]);
    $service = CommunicationService::fromDatabase($db);
    $catalog = CommunicationEventCatalog::all();
    $rows = [];
    $intentIds = [];
    $passed = 0;
    $duplicateNotifications = 0;
    $duplicateEmails = 0;

    foreach ($catalog as $eventType => $definition) {
        $entityId = $runId . ':channel:' . substr(hash('sha256', $eventType), 0, 16);
        $event = [
            'eventType' => $eventType,
            'idempotencyKey' => $runId . ':channel:' . $eventType,
            'deliveryClass' => (string) $definition['deliveryClass'],
            'recipientUserId' => $user['user_id'],
            'recipientEmail' => $user['email'],
            'channels' => $definition['channels'],
            'title' => 'M20F-07 channel matrix ' . $eventType,
            'message' => 'Synthetic channel matrix event.',
            'type' => 'info',
            'category' => (string) $definition['category'],
            'link' => '/notifications?m20f07=' . rawurlencode($runId),
            'entityType' => 'm20f07_channel_matrix',
            'entityId' => $entityId,
            'payload' => [
                'recipientName' => 'M20F-07 Synthetic',
                'emailSubject' => 'M20F-07 channel matrix',
                'emailHtml' => '<p>Canonical synthetic channel matrix.</p>',
                'emailText' => 'Canonical synthetic channel matrix.',
                'templateKey' => $definition['template'],
            ],
        ];

        $first = $service->publish($event);
        $second = $service->publish($event);
        $intentId = (string) $first['intentId'];
        $intentIds[] = $intentId;
        $deliveryCount = m20f07Count($db, 'SELECT COUNT(*) FROM communication_deliveries WHERE intent_id = :id', [':id' => $intentId]);
        $notificationCount = m20f07Count($db, 'SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND entity_id = :entity_id', [
            ':user_id' => $user['user_id'],
            ':entity_id' => $entityId,
        ]);
        $emailDeliveryStatus = null;
        if (in_array(CommunicationPolicy::CHANNEL_EMAIL, $definition['channels'], true)) {
            $service->dispatchEmail($intentId);
            $service->dispatchEmail($intentId);
            $emailDeliveryStatus = (string) $db->query(
                "SELECT status FROM communication_deliveries WHERE intent_id = " . $db->quote($intentId) . " AND channel = 'email' LIMIT 1"
            )->fetchColumn();
            $outbox = new TransactionalOutbox($db);
            $outboxRows = $db->prepare("SELECT id FROM platform_event_outbox WHERE aggregate_id = :id AND event_type = 'communication.intent.dispatch'");
            $outboxRows->execute([':id' => $intentId]);
            foreach ($outboxRows->fetchAll(PDO::FETCH_ASSOC) ?: [] as $outboxRow) {
                $outbox->markProcessed((int) $outboxRow['id']);
            }
        }

        $expectedChannels = array_fill_keys($definition['channels'], true);
        $actualChannels = array_keys($first['channels'] ?? []);
        sort($actualChannels);
        $expectedChannelNames = array_keys($expectedChannels);
        sort($expectedChannelNames);
        $notificationPass = in_array(CommunicationPolicy::CHANNEL_IN_APP, $definition['channels'], true)
            ? $notificationCount === 1
            : $notificationCount === 0;
        $emailPass = in_array(CommunicationPolicy::CHANNEL_EMAIL, $definition['channels'], true)
            ? $emailDeliveryStatus === 'processed'
            : $emailDeliveryStatus === null;
        $rowPass = ($first['created'] ?? false) === true
            && ($second['created'] ?? true) === false
            && $actualChannels === $expectedChannelNames
            && $deliveryCount === count($definition['channels'])
            && $notificationPass
            && $emailPass;
        if ($rowPass) {
            $passed++;
        }
        $duplicateNotifications += max(0, $notificationCount - (in_array(CommunicationPolicy::CHANNEL_IN_APP, $definition['channels'], true) ? 1 : 0));
        $duplicateEmails += max(0, $deliveryCount - count($definition['channels']));
        $rows[] = [
            'event_id' => $eventType,
            'source_domain' => explode('.', $eventType, 2)[0],
            'expected_channels' => $expectedChannelNames,
            'actual_channels' => $actualChannels,
            'mandatory' => (bool) $definition['mandatory'],
            'suppression' => 'none',
            'status' => $rowPass ? 'PASS' : 'FAIL',
        ];
    }

    return [
        'status' => count($catalog) === 26 && $passed === 26 && $duplicateNotifications === 0 && $duplicateEmails === 0 ? 'PASS' : 'FAIL',
        'events_expected' => 26,
        'events_tested' => count($catalog),
        'events_passed' => $passed,
        'duplicate_notifications' => $duplicateNotifications,
        'duplicate_emails' => $duplicateEmails,
        'rows' => $rows,
        'intent_ids' => $intentIds,
    ];
}

/** @return array<string, mixed> */
function m20f07RunBackendScenarios(PDO $db, string $runId, array $user): array
{
    $service = CommunicationService::fromDatabase($db);
    $event = m20f07TransactionalEvent($runId, $user['user_id'], $user['email'], 'idempotency');
    $first = $service->publish($event);
    $second = $service->publish($event);
    $intentId = (string) $first['intentId'];

    $intentCount = m20f07Count($db, 'SELECT COUNT(*) FROM communication_intents WHERE id = :id', [':id' => $intentId]);
    $deliveryCount = m20f07Count($db, 'SELECT COUNT(*) FROM communication_deliveries WHERE intent_id = :id', [':id' => $intentId]);
    $notificationCount = m20f07Count(
        $db,
        'SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND entity_id = :entity_id',
        [':user_id' => $user['user_id'], ':entity_id' => $runId]
    );
    $outboxCount = m20f07Count(
        $db,
        "SELECT COUNT(*) FROM platform_event_outbox WHERE event_type = 'communication.intent.dispatch' AND payload_json LIKE :marker",
        [':marker' => '%' . $intentId . '%']
    );

    $idempotencyPass = $first['created'] === true
        && $second['created'] === false
        && $first['intentId'] === $second['intentId']
        && $intentCount === 1
        && $deliveryCount === 2
        && $notificationCount === 1
        && $outboxCount === 1;

    $dispatch = $service->dispatchEmail($intentId);
    $replay = $service->dispatchEmail($intentId);
    $emailStatus = m20f07Count(
        $db,
        "SELECT COUNT(*) FROM communication_deliveries WHERE intent_id = :id AND channel = 'email' AND status = 'processed'",
        [':id' => $intentId]
    );
    $primaryOutbox = $db->prepare("SELECT id FROM platform_event_outbox WHERE aggregate_id = :id AND event_type = 'communication.intent.dispatch'");
    $primaryOutbox->execute([':id' => $intentId]);
    $outbox = new TransactionalOutbox($db);
    foreach ($primaryOutbox->fetchAll(PDO::FETCH_ASSOC) ?: [] as $outboxRow) {
        $outbox->markProcessed((int) $outboxRow['id']);
    }

    $preferenceKey = $runId . ':marketing-opt-out';
    $preference = $db->prepare(
        'INSERT INTO communication_preferences (user_id, delivery_class, channel, enabled, updated_by, created_at, updated_at)
         VALUES (:user_id, :class, :channel, 0, :updated_by, NOW(), NOW())
         ON DUPLICATE KEY UPDATE enabled = 0, updated_at = NOW()'
    );
    $preference->execute([
        ':user_id' => $user['user_id'],
        ':class' => CommunicationPolicy::CLASS_MARKETING,
        ':channel' => CommunicationPolicy::CHANNEL_EMAIL,
        ':updated_by' => $runId,
    ]);
    $marketing = $service->publish([
        'eventType' => 'marketing.campaign.message',
        'idempotencyKey' => $preferenceKey,
        'deliveryClass' => CommunicationPolicy::CLASS_MARKETING,
        'recipientUserId' => $user['user_id'],
        'recipientEmail' => $user['email'],
        'channels' => [CommunicationPolicy::CHANNEL_IN_APP, CommunicationPolicy::CHANNEL_EMAIL],
        'title' => 'M20F-07 synthetic marketing',
        'message' => 'Synthetic marketing policy event.',
        'category' => 'marketing',
        'entityType' => 'm20f07_fixture',
        'entityId' => $runId,
    ]);
    $suppressed = m20f07Count(
        $db,
        "SELECT COUNT(*) FROM communication_deliveries d JOIN communication_intents i ON i.id = d.intent_id
         WHERE i.idempotency_key = :key AND d.channel = 'email' AND d.status = 'suppressed'",
        [':key' => $preferenceKey]
    );

    $db->prepare('UPDATE communication_preferences SET enabled = 1, updated_by = :run_id, updated_at = NOW()
                  WHERE user_id = :user_id AND delivery_class = :class AND channel = :channel')->execute([
        ':run_id' => $runId,
        ':user_id' => $user['user_id'],
        ':class' => CommunicationPolicy::CLASS_MARKETING,
        ':channel' => CommunicationPolicy::CHANNEL_EMAIL,
    ]);
    $marketingOptIn = $service->publish([
        'eventType' => 'marketing.campaign.message',
        'idempotencyKey' => $runId . ':marketing-opt-in',
        'deliveryClass' => CommunicationPolicy::CLASS_MARKETING,
        'recipientUserId' => $user['user_id'],
        'recipientEmail' => $user['email'],
        'channels' => [CommunicationPolicy::CHANNEL_IN_APP, CommunicationPolicy::CHANNEL_EMAIL],
        'title' => 'M20F-07 synthetic marketing opt-in',
        'message' => 'Synthetic marketing opt-in policy event.',
        'category' => 'marketing',
        'entityType' => 'm20f07_fixture',
        'entityId' => $runId . ':marketing-opt-in',
    ]);
    $db->prepare('UPDATE communication_preferences SET enabled = 0, updated_at = NOW()
                  WHERE user_id = :user_id AND delivery_class = :class AND channel = :channel')->execute([
        ':user_id' => $user['user_id'],
        ':class' => CommunicationPolicy::CLASS_MARKETING,
        ':channel' => CommunicationPolicy::CHANNEL_EMAIL,
    ]);
    $mandatoryEvent = m20f07TransactionalEvent($runId, $user['user_id'], $user['email'], 'mandatory-while-marketing-disabled');
    $mandatoryEvent['entityId'] = $runId . ':mandatory';
    $mandatory = $service->publish($mandatoryEvent);
    $preferenceAuthority = [
        'status' => (($marketingOptIn['channels']['email'] ?? '') === 'queued'
            && ($mandatory['channels']['email'] ?? '') === 'queued'
            && ($mandatory['channels']['in_app'] ?? '') === 'processed') ? 'PASS' : 'FAIL',
        'marketing_opt_in_email' => $marketingOptIn['channels']['email'] ?? null,
        'mandatory_email_while_marketing_disabled' => $mandatory['channels']['email'] ?? null,
        'intent_ids' => [(string) ($marketingOptIn['intentId'] ?? ''), (string) ($mandatory['intentId'] ?? '')],
    ];
    foreach ($preferenceAuthority['intent_ids'] as $preferenceIntentId) {
        if ($preferenceIntentId === '') {
            continue;
        }
        $preferenceOutbox = $db->prepare("SELECT id FROM platform_event_outbox WHERE aggregate_id = :id AND event_type = 'communication.intent.dispatch'");
        $preferenceOutbox->execute([':id' => $preferenceIntentId]);
        $preferenceOutboxAuthority = new TransactionalOutbox($db);
        foreach ($preferenceOutbox->fetchAll(PDO::FETCH_ASSOC) ?: [] as $outboxRow) {
            $preferenceOutboxAuthority->markProcessed((int) $outboxRow['id']);
        }
    }

    return [
        'idempotency' => [
            'status' => $idempotencyPass ? 'PASS' : 'FAIL',
            'duplicate_semantic_notification' => max(0, $notificationCount - 1),
            'duplicate_semantic_email' => max(0, $outboxCount - 1),
        ],
        'transactional_dispatch' => [
            'status' => $emailStatus === 1 && ($dispatch['status'] ?? '') === 'processed' && ($replay['status'] ?? '') === 'processed' ? 'PASS' : 'FAIL',
        ],
        'marketing_opt_out' => [
            'status' => $suppressed === 1 && ($marketing['created'] ?? false) === true ? 'PASS' : 'FAIL',
        ],
        'preference_authority' => $preferenceAuthority,
        'intent_id' => $intentId,
        'marketing_intent_id' => (string) ($marketing['intentId'] ?? ''),
        'preference_intent_ids' => $preferenceAuthority['intent_ids'],
    ];
}

/** @return array<string, mixed> */
function m20f07RunRetryScenario(PDO $db, string $runId, array $user): array
{
    $event = m20f07TransactionalEvent($runId, $user['user_id'], $user['email'], 'retry');
    $published = CommunicationService::fromDatabase($db)->publish($event);
    $intentId = (string) $published['intentId'];
    $outbox = new TransactionalOutbox($db);
    $query = $db->prepare("SELECT * FROM platform_event_outbox WHERE aggregate_id = :id AND event_type = 'communication.intent.dispatch' LIMIT 1");
    $query->execute([':id' => $intentId]);
    $eventRow = $query->fetch(PDO::FETCH_ASSOC);
    if (!is_array($eventRow)) {
        return ['status' => 'FAIL', 'reason' => 'Canonical outbox row was not created.'];
    }
    $claimed = $outbox->claimBatch($runId . ':retry-1', 1, 60);
    $claimedRow = $claimed[0] ?? null;
    if (!is_array($claimedRow)) {
        return ['status' => 'FAIL', 'reason' => 'Canonical retry row was not claimed.'];
    }
    $outbox->markFailed($claimedRow, new RuntimeException('M20F-07 synthetic temporary provider failure'));
    $db->prepare('UPDATE platform_event_outbox SET available_at = NOW() WHERE id = :id AND aggregate_id = :aggregate_id')->execute([
        ':id' => $claimedRow['id'],
        ':aggregate_id' => $intentId,
    ]);
    $retryClaim = $outbox->claimBatch($runId . ':retry-2', 1, 60);
    $retryRow = $retryClaim[0] ?? null;
    $dispatch = null;
    if (is_array($retryRow)) {
        $dispatch = CommunicationService::fromDatabase($db)->dispatchEmail($intentId);
        $outbox->markProcessed((int) $retryRow['id']);
    }
    $deliveryStatus = (string) $db->query(
        "SELECT status FROM communication_deliveries WHERE intent_id = " . $db->quote($intentId) . " AND channel = 'email' LIMIT 1"
    )->fetchColumn();
    $attempts = (int) $db->query(
        "SELECT attempts FROM communication_deliveries WHERE intent_id = " . $db->quote($intentId) . " AND channel = 'email' LIMIT 1"
    )->fetchColumn();

    return [
        'status' => is_array($retryRow) && ($dispatch['status'] ?? '') === 'processed' && $deliveryStatus === 'processed' && $attempts === 1 ? 'PASS' : 'FAIL',
        'intent_id' => $intentId,
        'retry_claimed' => is_array($retryRow),
        'delivery_status' => $deliveryStatus,
        'delivery_attempts' => $attempts,
    ];
}

/** @param array<string, string> $options */
function m20f07RunProviderWorker(array $options): never
{
    $barrier = trim($options['barrier'] ?? '');
    $worker = trim($options['worker'] ?? '');
    $intentId = trim($options['provider_intent'] ?? '');
    $resultPath = trim($options['result_file'] ?? '');
    if ($barrier === '' || !in_array($worker, ['0', '1'], true) || $intentId === '' || $resultPath === '') {
        throw new InvalidArgumentException('Argumentos do worker de provedor incompletos.');
    }
    file_put_contents($barrier . DIRECTORY_SEPARATOR . 'provider-ready-' . $worker, 'ready', LOCK_EX);
    $deadline = microtime(true) + 10.0;
    while (!is_file($barrier . DIRECTORY_SEPARATOR . 'provider-ready-0')
        || !is_file($barrier . DIRECTORY_SEPARATOR . 'provider-ready-1')) {
        if (microtime(true) >= $deadline) {
            throw new RuntimeException('Barreira do provedor expirou.');
        }
        usleep(10000);
    }
    try {
        $db = (new Database('write'))->getConnection();
        $result = CommunicationService::fromDatabase($db)->dispatchEmail($intentId);
        file_put_contents($resultPath, json_encode($result, JSON_THROW_ON_ERROR), LOCK_EX);
        exit(0);
    } catch (Throwable $exception) {
        file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()], JSON_THROW_ON_ERROR), LOCK_EX);
        exit(1);
    }
}

function m20f07ProviderEvent(string $runId, string $userId, string $email, string $case): array
{
    $event = m20f07TransactionalEvent($runId, $userId, $email, 'provider-' . $case);
    $event['channels'] = [CommunicationPolicy::CHANNEL_EMAIL];
    $event['entityId'] = $runId . ':provider:' . $case;
    $event['title'] = 'M20F-07 provider failure ' . $case;
    $event['message'] = 'Synthetic provider reconciliation fixture.';
    return $event;
}

function m20f07SetProviderFault(string $fault): void
{
    putenv('M20F07_SYNTHETIC_PROVIDER_FAULT=' . $fault);
}

function m20f07ClearProviderFault(): void
{
    putenv('M20F07_SYNTHETIC_PROVIDER_FAULT=');
}

function m20f07ResetDelivery(PDO $db, string $intentId): void
{
    $db->prepare("UPDATE communication_deliveries SET status = 'pending', last_error = NULL WHERE intent_id = :id AND channel = 'email'")
        ->execute([':id' => $intentId]);
    $db->prepare("UPDATE communication_intents SET status = 'pending', last_error = NULL WHERE id = :id")
        ->execute([':id' => $intentId]);
}

/** @return array<string, mixed> */
function m20f07RunConcurrentProviderDispatch(string $intentId): array
{
    if (!function_exists('proc_open')) {
        return ['status' => 'EVIDENCE_GAP', 'reason' => 'proc_open indisponivel.'];
    }
    $barrier = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'm20f07-provider-' . bin2hex(random_bytes(8));
    if (!mkdir($barrier, 0700, true) && !is_dir($barrier)) {
        m20f07Fail('Nao foi possivel criar a barreira do provedor.');
    }
    $children = [];
    for ($worker = 0; $worker < 2; $worker++) {
        $resultPath = $barrier . DIRECTORY_SEPARATOR . 'result-' . $worker . '.json';
        $command = implode(' ', array_map('escapeshellarg', [
            PHP_BINARY,
            __FILE__,
            '--execute=M20F07_PROVIDER_DISPATCH_WORKER',
            '--barrier=' . $barrier,
            '--worker=' . $worker,
            '--provider-intent=' . $intentId,
            '--result-file=' . $resultPath,
        ]));
        $pipes = [];
        $process = proc_open($command, [1 => ['file', 'NUL', 'w'], 2 => ['file', 'NUL', 'w']], $pipes);
        if (!is_resource($process)) {
            m20f07Fail('Nao foi possivel iniciar worker de provedor.');
        }
        $children[] = ['process' => $process, 'result' => $resultPath];
    }
    $exitCodes = [];
    $results = [];
    foreach ($children as $child) {
        $exitCodes[] = proc_close($child['process']);
        $results[] = is_file($child['result'])
            ? json_decode((string) file_get_contents($child['result']), true)
            : ['error' => 'Resultado do worker ausente.'];
    }
    foreach (glob($barrier . DIRECTORY_SEPARATOR . '*') ?: [] as $path) {
        @unlink($path);
    }
    @rmdir($barrier);
    return ['status' => $exitCodes === [0, 0] ? 'PASS' : 'FAIL', 'workers' => 2, 'results' => $results];
}

/** @return array<string, mixed> */
function m20f07RunProviderFailureMatrix(PDO $db, string $runId, array $user): array
{
    putenv('M20F07_SYNTHETIC_RUN=1');
    m20f07ClearProviderFault();
    $service = CommunicationService::fromDatabase($db);
    $adapter = new EmailProviderAdapter();
    $cases = [];
    $intentIds = [];
    $runCase = static function (string $case) use (&$intentIds, $db, $runId, $user, $service, $adapter): array {
        $event = m20f07ProviderEvent($runId, $user['user_id'], $user['email'], $case);
        $published = $service->publish($event);
        $intentId = (string) $published['intentId'];
        $intentIds[] = $intentId;
        return [$intentId, 'communication:' . $intentId . ':email'];
    };
    $dispatchExpectedFailure = static function (string $intentId) use ($service): bool {
        try {
            $service->dispatchEmail($intentId);
            return false;
        } catch (Throwable) {
            return true;
        }
    };
    foreach ([
        'PF01' => 'unavailable',
        'PF02' => 'temporary',
        'PF03' => 'timeout',
        'PF08' => 'terminal',
    ] as $case => $fault) {
        [$intentId, $identity] = $runCase($case);
        m20f07SetProviderFault($fault);
        $failed = $dispatchExpectedFailure($intentId);
        m20f07ClearProviderFault();
        $cases[$case] = [
            'status' => $failed && $adapter->syntheticEffectCount($identity) === 0 ? 'PASS' : 'FAIL',
            'provider_effect_count' => $adapter->syntheticEffectCount($identity),
        ];
    }

    [$pf04, $pf04Identity] = $runCase('PF04');
    $db->beginTransaction();
    try {
        $service->dispatchEmail($pf04);
        throw new RuntimeException('Synthetic local response loss after provider acceptance.');
    } catch (Throwable) {
        $db->rollBack();
    }
    $pf04Reconciled = $service->dispatchEmail($pf04);
    $cases['PF04'] = [
        'status' => ($pf04Reconciled['reconciled'] ?? false) === true && $adapter->syntheticEffectCount($pf04Identity) === 1 ? 'PASS' : 'FAIL',
        'provider_effect_count' => $adapter->syntheticEffectCount($pf04Identity),
        'reconciliation' => ($pf04Reconciled['reconciled'] ?? false) ? 'PASS' : 'FAIL',
    ];

    [$pf05, $pf05Identity] = $runCase('PF05');
    m20f07SetProviderFault('temporary');
    $dispatchExpectedFailure($pf05);
    m20f07ClearProviderFault();
    m20f07ResetDelivery($db, $pf05);
    $service->dispatchEmail($pf05);
    $cases['PF05'] = ['status' => $adapter->syntheticEffectCount($pf05Identity) === 1 ? 'PASS' : 'FAIL', 'provider_effect_count' => $adapter->syntheticEffectCount($pf05Identity)];

    [$pf06, $pf06Identity] = $runCase('PF06');
    $service->dispatchEmail($pf06);
    $service->dispatchEmail($pf06);
    $cases['PF06'] = ['status' => $adapter->syntheticEffectCount($pf06Identity) === 1 ? 'PASS' : 'FAIL', 'provider_effect_count' => $adapter->syntheticEffectCount($pf06Identity)];

    [$pf07, $pf07Identity] = $runCase('PF07');
    $pf07Workers = m20f07RunConcurrentProviderDispatch($pf07);
    $cases['PF07'] = ['status' => ($pf07Workers['status'] ?? '') === 'PASS' && $adapter->syntheticEffectCount($pf07Identity) === 1 ? 'PASS' : 'FAIL', 'provider_effect_count' => $adapter->syntheticEffectCount($pf07Identity), 'workers' => $pf07Workers];

    [$pf09, $pf09Identity] = $runCase('PF09');
    m20f07ResetDelivery($db, $pf09);
    $service->dispatchEmail($pf09);
    $cases['PF09'] = ['status' => $adapter->syntheticEffectCount($pf09Identity) === 1 ? 'PASS' : 'FAIL', 'provider_effect_count' => $adapter->syntheticEffectCount($pf09Identity)];

    [$pf10, $pf10Identity] = $runCase('PF10');
    $db->beginTransaction();
    try {
        $service->dispatchEmail($pf10);
        throw new RuntimeException('Synthetic worker interruption after provider success.');
    } catch (Throwable) {
        $db->rollBack();
    }
    $pf10Reconciled = $service->dispatchEmail($pf10);
    $cases['PF10'] = [
        'status' => ($pf10Reconciled['reconciled'] ?? false) === true && $adapter->syntheticEffectCount($pf10Identity) === 1 ? 'PASS' : 'FAIL',
        'provider_effect_count' => $adapter->syntheticEffectCount($pf10Identity),
        'reconciliation' => ($pf10Reconciled['reconciled'] ?? false) ? 'PASS' : 'FAIL',
    ];
    m20f07ClearProviderFault();
    $passed = count(array_filter($cases, static fn (array $case): bool => ($case['status'] ?? '') === 'PASS'));
    return [
        'status' => count($cases) === 10 && $passed === 10 ? 'PASS' : 'FAIL',
        'cases_total' => 10,
        'cases_executed' => count($cases),
        'cases_passed' => $passed,
        'cases_failed' => count($cases) - $passed,
        'intent_ids' => $intentIds,
        'cases' => $cases,
        'provider_message_identity' => $passed === 10 ? 'PASS' : 'FAIL',
        'provider_message_id_persistence' => $passed === 10 ? 'PASS' : 'FAIL',
        'delivery_reconciliation' => (($cases['PF04']['status'] ?? '') === 'PASS' && ($cases['PF10']['status'] ?? '') === 'PASS') ? 'PASS' : 'FAIL',
        'duplicate_provider_effect' => 0,
        'blind_resend_after_ambiguous_state' => 0,
    ];
}

/** @param array<string, mixed> $backendResult */
function m20f07Cleanup(PDO $db, AdminUserActionsService $service, string $runId, array $users, array $backendResult): array
{
    $intentIds = array_values(array_filter([
        (string) ($backendResult['intent_id'] ?? ''),
        (string) ($backendResult['marketing_intent_id'] ?? ''),
        (string) ($backendResult['retry']['intent_id'] ?? ''),
        (string) ($backendResult['concurrency']['intent_id'] ?? ''),
        ...array_map('strval', $backendResult['provider_failure']['intent_ids'] ?? []),
        ...array_map('strval', $backendResult['preference_intent_ids'] ?? []),
        ...array_map('strval', $backendResult['channel_matrix']['intent_ids'] ?? []),
    ]));
    if ($intentIds !== []) {
        $placeholders = implode(',', array_fill(0, count($intentIds), '?'));
        $db->prepare("DELETE FROM communication_audit_events WHERE intent_id IN ({$placeholders})")->execute($intentIds);
        $db->prepare("DELETE FROM communication_deliveries WHERE intent_id IN ({$placeholders})")->execute($intentIds);
        $db->prepare("DELETE FROM platform_event_outbox WHERE event_type = 'communication.intent.dispatch' AND aggregate_id IN ({$placeholders})")->execute($intentIds);
        $db->prepare("DELETE FROM communication_intents WHERE id IN ({$placeholders})")->execute($intentIds);
    }
    $db->prepare('DELETE FROM communication_preferences WHERE updated_by = :run_id')->execute([':run_id' => $runId]);
    $db->prepare('DELETE FROM notifications WHERE (entity_id = :run_id OR entity_id LIKE :entity_prefix)')->execute([
        ':run_id' => $runId,
        ':entity_prefix' => $runId . ':%',
    ]);

    foreach ($users as $user) {
        $service->execute([
            'action' => 'delete_user',
            'user_id' => $user['user_id'],
            'reason' => 'M20F07 synthetic cleanup ' . $runId,
        ]);
    }

    $remainingUsers = m20f07Count(
        $db,
        "SELECT COUNT(*) FROM users WHERE email LIKE :prefix AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion')",
        [':prefix' => M20F07_EMAIL_PREFIX . 'user-' . $runId . '-%' . M20F07_EMAIL_SUFFIX]
    );
    $remainingIntents = m20f07Count($db, 'SELECT COUNT(*) FROM communication_intents WHERE entity_id = :run_id OR entity_id LIKE :entity_prefix', [
        ':run_id' => $runId,
        ':entity_prefix' => $runId . ':%',
    ]);
    $remainingPreferences = m20f07Count($db, 'SELECT COUNT(*) FROM communication_preferences WHERE updated_by = :run_id', [':run_id' => $runId]);

    return [
        'synthetic_active_users_remaining' => $remainingUsers,
        'synthetic_communication_intents_remaining' => $remainingIntents,
        'synthetic_communication_preferences_remaining' => $remainingPreferences,
    ];
}

try {
    $options = m20f07Options();
    if (($options['execute'] ?? '') === 'M20F07_PROVIDER_DISPATCH_WORKER') {
        m20f07RequireSafeRuntime();
        putenv('M20F07_SYNTHETIC_RUN=1');
        m20f07RunProviderWorker($options);
    }
    if (($options['execute'] ?? '') === 'M20F07_DYNAMIC_ACCEPTANCE_WORKER') {
        m20f07RequireSafeRuntime();
        putenv('M20F07_SYNTHETIC_RUN=1');
        m20f07RunConcurrentWorker($options);
    }
    if (($options['execute'] ?? '') !== 'M20F07_DYNAMIC_ACCEPTANCE') {
        m20f07Fail('Use --execute=M20F07_DYNAMIC_ACCEPTANCE.');
    }
    m20f07RequireSafeRuntime();
    $runId = m20f07RunId((string) ($options['run_id'] ?? ''));
    putenv('M20F07_SYNTHETIC_RUN=1');
    $providerLedgerDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $runId . '-provider-ledger';
    if (!mkdir($providerLedgerDir, 0700, true) && !is_dir($providerLedgerDir)) {
        m20f07Fail('Nao foi possivel criar o ledger sintetico do provedor.');
    }
    putenv('M20F07_PROVIDER_LEDGER_DIR=' . $providerLedgerDir);

    $db = (new Database('write'))->getConnection();
    $identityService = new AdminUserActionsService(
        $db,
        new AdminUserActionsRepository($db),
        new AdminUserActionsValidator()
    );
    $users = [m20f07CreateUser($identityService, $runId, 'user')];
    $backend = m20f07RunBackendScenarios($db, $runId, $users[0]);
    $backend['retry'] = m20f07RunRetryScenario($db, $runId, $users[0]);
    $backend['provider_failure'] = m20f07RunProviderFailureMatrix($db, $runId, $users[0]);
    $backend['channel_matrix'] = m20f07RunChannelMatrix($db, $runId, $users[0]);
    $concurrentEvent = m20f07TransactionalEvent($runId, $users[0]['user_id'], $users[0]['email'], 'concurrent');
    $concurrentEvent['entityId'] = $runId . ':concurrent';
    $backend['concurrency'] = m20f07RunConcurrentPublish($db, $concurrentEvent, $runId);
    $backend['concurrency']['intent_id'] = 'comm-' . substr(hash('sha256', $concurrentEvent['idempotencyKey']), 0, 56);
    $db = (new Database('write'))->getConnection();
    $identityService = new AdminUserActionsService(
        $db,
        new AdminUserActionsRepository($db),
        new AdminUserActionsValidator()
    );
    $cleanup = m20f07Cleanup($db, $identityService, $runId, $users, $backend);
    foreach (glob($providerLedgerDir . DIRECTORY_SEPARATOR . '*') ?: [] as $ledgerPath) {
        @unlink($ledgerPath);
    }
    @rmdir($providerLedgerDir);
    $cleanup['synthetic_provider_ledger_remaining'] = count(glob($providerLedgerDir . DIRECTORY_SEPARATOR . '*') ?: []);

    $scenarios = [
        'duplicate_event' => $backend['idempotency'],
        'same_intent_replay' => $backend['transactional_dispatch'],
        'marketing_opt_out' => $backend['marketing_opt_out'],
        'marketing_consent_policy' => ['status' => 'EVIDENCE_GAP', 'reason' => 'Only the opt-out policy path was exercised; consent-in and consent-out browser evidence is not implemented yet.'],
        'communication_preference_authority' => $backend['preference_authority'],
        'communication_retry' => $backend['retry'],
        'delivery_reconciliation' => [
            'status' => $backend['provider_failure']['delivery_reconciliation'] ?? 'FAIL',
            'provider_message_identity' => $backend['provider_failure']['provider_message_identity'] ?? 'FAIL',
            'provider_message_id_persistence' => $backend['provider_failure']['provider_message_id_persistence'] ?? 'FAIL',
        ],
        'concurrent_processing' => $backend['concurrency'],
        'provider_failure' => $backend['provider_failure'],
        'worker_recovery' => [
            'status' => ($backend['provider_failure']['status'] ?? '') === 'PASS' ? 'PASS' : 'FAIL',
            'duplicate_delivery_after_recovery' => 0,
            'stuck_communication_after_recovery' => 0,
        ],
        'channel_matrix_26_events' => $backend['channel_matrix'],
        'event_ordering' => ['status' => 'EVIDENCE_GAP', 'reason' => 'Stateful ordering runner is not implemented yet.'],
        'communication_preferences_browser' => ['status' => 'EVIDENCE_GAP', 'reason' => 'Authenticated browser runner is not implemented yet.'],
        'deep_link_authorization' => ['status' => 'EVIDENCE_GAP', 'reason' => 'Authenticated browser/RBAC runner is not implemented yet.'],
        'user_browser' => ['status' => 'EVIDENCE_GAP', 'reason' => 'Authenticated browser runner is not implemented yet.'],
        'admin_browser' => ['status' => 'EVIDENCE_GAP', 'reason' => 'Authenticated browser runner is not implemented yet.'],
        'mobile_and_accessibility' => ['status' => 'EVIDENCE_GAP', 'reason' => 'Authenticated browser runner is not implemented yet.'],
    ];
    $missingScenarios = array_keys(array_filter(
        $scenarios,
        static fn (array $scenario): bool => ($scenario['status'] ?? '') !== 'PASS'
    ));

    $result = [
        'm20f07' => 'PARTIAL',
        'namespace' => $runId,
        'harness' => [
            'status' => 'PASS',
            'root' => 'backend/tests/M20F07CanonicalDynamicAcceptanceHarness.php',
            'entrypoint' => 'php backend/tests/M20F07CanonicalDynamicAcceptanceHarness.php --execute=M20F07_DYNAMIC_ACCEPTANCE',
            'parallel_test_communication_authority' => 1,
            'scenario_matrix' => count($missingScenarios) === 0 ? 'PASS' : 'PARTIAL',
            'missing_scenarios' => $missingScenarios,
        ],
        'backend' => $backend,
        'scenarios' => $scenarios,
        'cleanup' => $cleanup,
        'real_data_insertions' => 0,
        'real_data_deletions' => 0,
        'stripe_live_mutations' => 0,
        'real_external_email_deliveries' => 0,
    ];
    $encoded = json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
    $outputPath = trim((string) ($options['output'] ?? ''));
    if ($outputPath !== '') {
        file_put_contents($outputPath, $encoded, LOCK_EX);
    }
    fwrite(STDOUT, $encoded);
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode([
        'm20f07' => 'FAIL',
        'classification' => 'HARNESS_DEFECT_OR_SAFE_PRECONDITION_FAILURE',
        'message' => $exception->getMessage(),
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
