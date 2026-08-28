<?php

declare(strict_types=1);

final class IngestionRetryPolicy
{
    public function __construct(
        public readonly int $maxAttempts = 5,
        public readonly array $backoffSeconds = [1, 5, 30, 300],
    ) {
        if ($this->maxAttempts < 1 || $this->maxAttempts > 20) {
            throw new InvalidArgumentException('Limite de retry invalido.');
        }
    }

    public function shouldRetry(string $failureClass, int $attempt): bool
    {
        return $failureClass === IngestionFailureClassifier::TRANSIENT
            && $attempt < $this->maxAttempts;
    }

    public function nextDelaySeconds(int $attempt): int
    {
        $index = max(0, $attempt - 1);
        $lastIndex = max(0, count($this->backoffSeconds) - 1);
        return (int) ($this->backoffSeconds[$index] ?? $this->backoffSeconds[$lastIndex] ?? 300);
    }
}
