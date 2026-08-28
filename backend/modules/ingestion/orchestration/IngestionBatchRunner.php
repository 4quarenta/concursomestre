<?php

declare(strict_types=1);

final class IngestionBatchRunner
{
    public function __construct(private readonly IngestionPersistencePort $persistence)
    {
    }

    /**
     * Runs a deterministic batch. The cursor is advanced only after an item
     * result is committed, so a crash can safely replay the last item.
     * @param list<CanonicalIngestionItem> $items
     * @return array{processed:int,cursor:int,results:list<array<string,mixed>>}
     */
    public function run(array $items, IngestionOrchestrator $orchestrator, bool $dryRun = true, int $startAt = 0, ?callable $afterItem = null): array
    {
        $cursor = max(0, min(count($items), $startAt));
        $results = [];
        $runId = self::uuid();
        $leaseKey = $items[$cursor]->sourceProvider ?? null;
        if (is_string($leaseKey) && $leaseKey !== '') {
            $this->persistence->startRun($runId, $leaseKey, 'shared-ingestion.v1');
        }
        if (is_string($leaseKey) && $leaseKey !== '' && !$this->persistence->acquireLease($leaseKey, $runId, 900)) {
            $this->persistence->failRun($runId, IngestionFailureClassifier::TRANSIENT);
            throw new RuntimeException('Outra execucao de ingestao ja possui o lease da fonte.');
        }
        try {
            for (; $cursor < count($items); $cursor++) {
                $result = $orchestrator->processOne($items[$cursor], $runId, $dryRun);
                $results[] = $result;
                if ($afterItem !== null) {
                    $afterItem($cursor, $result);
                }
                $this->persistence->checkpointRun($runId, (string) ($cursor + 1));
            }
            $this->persistence->completeRun($runId);
        } catch (Throwable $exception) {
            $this->persistence->failRun($runId, IngestionFailureClassifier::classify($exception));
            throw $exception;
        } finally {
            if (is_string($leaseKey) && $leaseKey !== '') {
                $this->persistence->releaseLease($leaseKey, $runId);
            }
        }
        return ['processed' => count($results), 'cursor' => $cursor, 'results' => $results];
    }

    private static function uuid(): string
    {
        return bin2hex(random_bytes(16));
    }
}
