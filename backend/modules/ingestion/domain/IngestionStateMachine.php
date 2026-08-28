<?php

declare(strict_types=1);

final class IngestionStateMachine
{
    public const RECEIVED = 'RECEIVED';
    public const VALIDATED = 'VALIDATED';
    public const NORMALIZED = 'NORMALIZED';
    public const RESOLVED = 'RESOLVED';
    public const PLANNED = 'PLANNED';
    public const PERSISTED = 'PERSISTED';
    public const POST_PROCESSED = 'POST_PROCESSED';
    public const COMPLETED = 'COMPLETED';
    public const REJECTED = 'REJECTED';
    public const RETRYABLE_FAILED = 'RETRYABLE_FAILED';
    public const PERMANENT_FAILED = 'PERMANENT_FAILED';
    public const REVIEW_REQUIRED = 'REVIEW_REQUIRED';

    /** @var array<string,list<string>> */
    private const TRANSITIONS = [
        self::RECEIVED => [self::VALIDATED, self::REJECTED, self::RETRYABLE_FAILED],
        self::VALIDATED => [self::NORMALIZED, self::REJECTED, self::REVIEW_REQUIRED],
        self::NORMALIZED => [self::RESOLVED, self::REJECTED, self::REVIEW_REQUIRED],
        self::RESOLVED => [self::PLANNED, self::REVIEW_REQUIRED, self::REJECTED],
        self::PLANNED => [self::PERSISTED, self::COMPLETED, self::REVIEW_REQUIRED],
        self::PERSISTED => [self::POST_PROCESSED, self::COMPLETED, self::RETRYABLE_FAILED],
        self::POST_PROCESSED => [self::COMPLETED, self::RETRYABLE_FAILED],
        self::RETRYABLE_FAILED => [self::RECEIVED, self::PERMANENT_FAILED, self::REVIEW_REQUIRED],
        self::REVIEW_REQUIRED => [self::RECEIVED, self::COMPLETED],
    ];

    public static function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public static function assertTransition(string $from, string $to): void
    {
        if (!self::canTransition($from, $to)) {
            throw new LogicException(sprintf('Transicao de ingestao invalida: %s -> %s.', $from, $to));
        }
    }
}
