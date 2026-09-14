<?php

declare(strict_types=1);

require_once __DIR__ . '/../IngestionPipeline.php';

/**
 * Canonical control-plane facade for provider import sessions.
 *
 * Domain importers may keep mature publication queues, but M20F-05-owned
 * provider collection must expose one session authority for lifecycle,
 * selection, preview and publication-guard evidence.
 */
final class CanonicalImportSessionService
{
    public const PROVIDER_FIXTURE = 'm20f05-fixture';

    /** @var array<string,list<string>> */
    private const TRANSITIONS = [
        'CREATED' => ['COLLECTING', 'CANCELLED', 'FAILED'],
        'COLLECTING' => ['COLLECTED', 'FAILED', 'CANCELLED'],
        'COLLECTED' => ['PREVIEWED', 'FAILED', 'CANCELLED'],
        'PREVIEWED' => ['READY', 'FAILED', 'CANCELLED'],
        'READY' => ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        'PROCESSING' => ['COMPLETED', 'FAILED'],
        'FAILED' => ['COLLECTING', 'CANCELLED'],
        'CANCELLED' => [],
        'COMPLETED' => [],
    ];

    public function __construct(private readonly IngestionPersistencePort $persistence)
    {
    }

    public function start(string $runId, string $provider, string $contractVersion): array
    {
        $this->assertIdentity($runId, 'runId');
        $this->assertIdentity($provider, 'provider');
        $this->persistence->startRun($runId, $provider, $contractVersion);
        $this->recordCheckpoint($runId, 'CREATED', [
            'provider' => $provider,
            'synthetic' => $provider === self::PROVIDER_FIXTURE,
            'candidateCounts' => ['received' => 0, 'selected' => 0],
        ]);

        return ['runId' => $runId, 'provider' => $provider, 'status' => 'CREATED'];
    }

    public function transition(string $runId, string $from, string $to, array $checkpoint = []): array
    {
        if (!in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new LogicException(sprintf('Transicao de sessao de importacao invalida: %s -> %s.', $from, $to));
        }
        $this->recordCheckpoint($runId, $to, $checkpoint);

        if ($to === 'COMPLETED') {
            $this->persistence->completeRun($runId);
        } elseif ($to === 'FAILED') {
            $this->persistence->failRun($runId, IngestionFailureClassifier::TRANSIENT);
        } else {
            $this->persistence->checkpointRun($runId, json_encode(
                ['status' => $to, 'checkpoint' => self::safeCheckpoint($checkpoint)],
                JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            ));
        }

        return ['runId' => $runId, 'status' => $to];
    }

    public function preview(string $runId, array $items, array $selectedSourceIds): array
    {
        $selected = array_fill_keys(array_map('strval', $selectedSourceIds), true);
        $preview = [];
        foreach ($items as $item) {
            if (!$item instanceof CanonicalIngestionItem) {
                continue;
            }
            $preview[] = [
                'sourceProvider' => $item->sourceProvider,
                'sourceEntityType' => $item->sourceEntityType,
                'sourceEntityId' => $item->sourceEntityId,
                'selected' => isset($selected[$item->sourceEntityId]),
                'idempotencyKey' => $item->idempotencyKey(),
                'contentHash' => $item->contentHash(),
                'publicationEligibility' => isset($selected[$item->sourceEntityId])
                    ? 'SYNTHETIC_PRELAUNCH_REVIEW_REQUIRED'
                    : 'NOT_SELECTED',
            ];
        }
        $this->transition($runId, 'COLLECTED', 'PREVIEWED', [
            'candidateCounts' => [
                'received' => count($items),
                'selected' => count($selectedSourceIds),
            ],
        ]);

        return ['runId' => $runId, 'items' => $preview];
    }

    /** @return list<string> */
    public static function states(): array
    {
        return array_keys(self::TRANSITIONS);
    }

    public static function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    private function recordCheckpoint(string $runId, string $status, array $checkpoint): void
    {
        $this->persistence->checkpointRun($runId, json_encode(
            ['status' => $status, 'checkpoint' => self::safeCheckpoint($checkpoint)],
            JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        ));
    }

    private static function safeCheckpoint(array $checkpoint): array
    {
        $safe = [];
        foreach ($checkpoint as $key => $value) {
            $key = (string) $key;
            if (preg_match('/payload|content|body|token|secret|password|cookie/i', $key) === 1) {
                continue;
            }
            if (is_scalar($value) || $value === null) {
                $safe[$key] = $value;
                continue;
            }
            if (is_array($value)) {
                $encoded = json_encode($value, JSON_UNESCAPED_SLASHES);
                if (is_string($encoded) && strlen($encoded) <= 2000) {
                    $safe[$key] = $value;
                }
            }
        }
        return $safe;
    }

    private function assertIdentity(string $value, string $field): void
    {
        if ($value === '' || strlen($value) > 190 || preg_match('/[\r\n\x00]/', $value) === 1) {
            throw new InvalidArgumentException('Identidade de sessao de importacao invalida: ' . $field);
        }
    }
}
