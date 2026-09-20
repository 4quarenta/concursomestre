<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../shared/communications/CommunicationService.php';

function m20f07FixtureOptions(): array
{
    $options = ['mode' => '', 'manifest' => '', 'run' => ''];
    foreach (array_slice($GLOBALS['argv'], 1) as $argument) {
        foreach (array_keys($options) as $key) {
            $prefix = '--' . str_replace('_', '-', $key) . '=';
            if (str_starts_with($argument, $prefix)) {
                $options[$key] = substr($argument, strlen($prefix));
                continue 2;
            }
        }
        throw new InvalidArgumentException('Argumento desconhecido.');
    }
    return $options;
}

function m20f07FixtureManifest(string $path): array
{
    return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
}

try {
    $options = m20f07FixtureOptions();
    $run = preg_replace('/[^a-z0-9-]/i', '-', (string) $options['run']);
    if (!is_string($run) || $run === '') {
        throw new InvalidArgumentException('Run namespace obrigatorio.');
    }
    $db = (new Database('write'))->getConnection();
    $manifestPath = (string) $options['manifest'];
    $manifest = m20f07FixtureManifest($manifestPath);
    $user = array_values(array_filter(
        $manifest['identities'] ?? [],
        static fn (array $identity): bool => ($identity['role'] ?? '') === 'user'
    ))[0] ?? null;
    if (!is_array($user)) {
        throw new RuntimeException('Manifesto nao contem User sintetico.');
    }
    $entityId = 'm20f07-browser-' . $run;
    $prefix = 'm20f07:' . $run . ':browser:';
    if ($options['mode'] === 'publish') {
        $result = CommunicationService::fromDatabase($db)->publish([
            'eventType' => 'support.feedback.reply',
            'idempotencyKey' => $prefix . 'notification',
            'deliveryClass' => CommunicationPolicy::CLASS_TRANSACTIONAL,
            'recipientUserId' => (string) $user['user_id'],
            'recipientEmail' => (string) $user['email'],
            'channels' => [CommunicationPolicy::CHANNEL_IN_APP, CommunicationPolicy::CHANNEL_EMAIL],
            'title' => 'M20F07 synthetic notification',
            'message' => 'Synthetic authenticated browser acceptance notification.',
            'type' => 'info',
            'category' => 'support',
            'link' => '/notifications?m20f07=' . rawurlencode($run),
            'entityType' => 'm20f07_browser_fixture',
            'entityId' => $entityId,
            'payload' => [
                'recipientName' => 'M20F07 Synthetic',
                'emailSubject' => 'M20F07 synthetic browser fixture',
                'emailHtml' => '<p>Canonical synthetic browser fixture.</p>',
                'emailText' => 'Canonical synthetic browser fixture.',
                'templateKey' => 'm20f07_browser_fixture',
            ],
        ]);
        $manifest['browser_fixture'] = [
            'run' => $run,
            'entity_id' => $entityId,
            'idempotency_prefix' => $prefix,
            'intent_id' => (string) ($result['intentId'] ?? ''),
        ];
        file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL);
        echo json_encode(['mode' => 'publish', 'result' => $result]) . PHP_EOL;
        exit(0);
    }
    if ($options['mode'] !== 'cleanup') {
        throw new InvalidArgumentException('Use --publish ou --cleanup.');
    }
    $intentIds = [];
    $statement = $db->prepare('SELECT id FROM communication_intents WHERE idempotency_key LIKE :prefix');
    $statement->execute([':prefix' => $prefix . '%']);
    $intentIds = array_values(array_filter(array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN))));
    if ($intentIds !== []) {
        $placeholders = implode(',', array_fill(0, count($intentIds), '?'));
        $db->prepare("DELETE FROM communication_audit_events WHERE intent_id IN ($placeholders)")->execute($intentIds);
        $db->prepare("DELETE FROM communication_deliveries WHERE intent_id IN ($placeholders)")->execute($intentIds);
        $db->prepare("DELETE FROM platform_event_outbox WHERE event_type = 'communication.intent.dispatch' AND aggregate_id IN ($placeholders)")->execute($intentIds);
        $db->prepare("DELETE FROM communication_intents WHERE id IN ($placeholders)")->execute($intentIds);
    }
    $db->prepare('DELETE FROM notifications WHERE entity_id = :entity_id')->execute([':entity_id' => $entityId]);
    echo json_encode(['mode' => 'cleanup', 'intent_ids' => $intentIds]) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
