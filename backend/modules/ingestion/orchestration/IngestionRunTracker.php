<?php

declare(strict_types=1);

/** In-memory run/checkpoint model used by the dry-run and rehearsal harness. */
final class IngestionRunTracker
{
    /** @var array<string,array<string,mixed>> */
    private array $runs = [];

    public function start(string $runId, string $provider, string $contractVersion): void
    {
        if ($runId === '' || isset($this->runs[$runId])) {
            throw new InvalidArgumentException('Run de ingestao invalido ou duplicado.');
        }
        $this->runs[$runId] = [
            'runId' => $runId,
            'sourceProvider' => $provider,
            'contractVersion' => $contractVersion,
            'status' => IngestionStateMachine::RECEIVED,
            'cursor' => null,
            'lastAttemptedCursor' => null,
        ];
    }

    public function checkpoint(string $runId, string $cursor): void
    {
        $this->assertRun($runId);
        $this->runs[$runId]['lastAttemptedCursor'] = $cursor;
        $this->runs[$runId]['cursor'] = $cursor;
    }

    public function complete(string $runId): void
    {
        $this->assertRun($runId);
        $this->runs[$runId]['status'] = IngestionStateMachine::COMPLETED;
    }

    public function fail(string $runId, string $failureClass): void
    {
        $this->assertRun($runId);
        $this->runs[$runId]['status'] = $failureClass === IngestionFailureClassifier::TRANSIENT
            ? IngestionStateMachine::RETRYABLE_FAILED
            : IngestionStateMachine::REVIEW_REQUIRED;
        $this->runs[$runId]['lastErrorClass'] = $failureClass;
    }

    /** @return array<string,mixed> */
    public function get(string $runId): array
    {
        $this->assertRun($runId);
        return $this->runs[$runId];
    }

    private function assertRun(string $runId): void
    {
        if (!isset($this->runs[$runId])) {
            throw new OutOfBoundsException('Run de ingestao nao encontrado.');
        }
    }
}
