<?php

declare(strict_types=1);

final class IngestionPlan
{
    public const CREATE = 'CREATE';
    public const UPDATE = 'UPDATE';
    public const NO_CHANGE = 'NO_CHANGE';
    public const DUPLICATE = 'DUPLICATE';
    public const REJECT = 'REJECT';
    public const REVIEW_REQUIRED = 'REVIEW_REQUIRED';
    public const DEPRECATE = 'DEPRECATE';

    public function __construct(
        public readonly string $action,
        public readonly string $state,
        public readonly array $reasonCodes = [],
        public readonly ?string $canonicalEntityId = null,
        public readonly array $mergedPayload = [],
    ) {
        if (!in_array($action, [self::CREATE, self::UPDATE, self::NO_CHANGE, self::DUPLICATE, self::REJECT, self::REVIEW_REQUIRED, self::DEPRECATE], true)) {
            throw new InvalidArgumentException('Acao de ingestao invalida.');
        }
    }
}
