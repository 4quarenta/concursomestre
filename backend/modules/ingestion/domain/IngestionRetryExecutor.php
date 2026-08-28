<?php

declare(strict_types=1);

final class IngestionRetryExecutor
{
    /** @return array{status:string,attempts:int,result:mixed,errorClass:?string} */
    public static function run(callable $operation, IngestionRetryPolicy $policy, ?callable $sleep = null): array
    {
        $sleep ??= static function (int $seconds): void { if ($seconds > 0) usleep($seconds * 1000); };
        for ($attempt = 1; $attempt <= $policy->maxAttempts; $attempt++) {
            try {
                return ['status' => IngestionStateMachine::COMPLETED, 'attempts' => $attempt, 'result' => $operation(), 'errorClass' => null];
            } catch (Throwable $exception) {
                $class = IngestionFailureClassifier::classify($exception);
                if (!$policy->shouldRetry($class, $attempt)) {
                    return [
                        'status' => $class === IngestionFailureClassifier::REVIEW_REQUIRED ? IngestionStateMachine::REVIEW_REQUIRED : ($class === IngestionFailureClassifier::VALIDATION ? IngestionStateMachine::REJECTED : IngestionStateMachine::PERMANENT_FAILED),
                        'attempts' => $attempt,
                        'result' => null,
                        'errorClass' => $class,
                    ];
                }
                $sleep($policy->nextDelaySeconds($attempt));
            }
        }
        return ['status' => IngestionStateMachine::PERMANENT_FAILED, 'attempts' => $policy->maxAttempts, 'result' => null, 'errorClass' => IngestionFailureClassifier::PERMANENT];
    }
}
