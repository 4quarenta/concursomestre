<?php

declare(strict_types=1);

final class IngestionFailureClassifier
{
    public const TRANSIENT = 'TRANSIENT';
    public const PERMANENT = 'PERMANENT';
    public const VALIDATION = 'VALIDATION';
    public const REVIEW_REQUIRED = 'REVIEW_REQUIRED';

    public static function classify(Throwable $exception): string
    {
        if ($exception instanceof InvalidArgumentException) {
            return self::VALIDATION;
        }
        if ($exception instanceof DomainException) {
            return self::REVIEW_REQUIRED;
        }
        $message = strtolower($exception->getMessage());
        foreach (['timeout', 'temporar', 'deadlock', '429', 'connection', 'unavailable', 'contention'] as $needle) {
            if (str_contains($message, $needle)) {
                return self::TRANSIENT;
            }
        }
        return self::PERMANENT;
    }
}
