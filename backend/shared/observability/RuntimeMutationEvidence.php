<?php

declare(strict_types=1);

require_once __DIR__ . '/RequestContext.php';

final class RuntimeMutationEvidence
{
    private const TABLE = '/^[a-z][a-z0-9_]{1,63}$/';
    private const CODE = '/^[a-z][a-z0-9_.:-]{1,119}$/';
    private const OPERATIONS = ['INSERT', 'UPDATE', 'UPSERT', 'DELETE'];

    public static function record(
        string $targetTable,
        string $operation,
        string $writerId,
        string $eventCode,
        int $rowDelta = 0,
        string $runtimePolicyClass = 'RESETTABLE_RECREATABLE_RUNTIME'
    ): void {
        $operation = strtoupper(trim($operation));
        if (
            preg_match(self::TABLE, $targetTable) !== 1
            || preg_match(self::CODE, $writerId) !== 1
            || preg_match(self::CODE, $eventCode) !== 1
            || !in_array($operation, self::OPERATIONS, true)
            || abs($rowDelta) > 1_000_000
        ) {
            throw new InvalidArgumentException('Evidencia de mutacao runtime invalida.');
        }

        RequestContext::log('info', 'runtime_mutation', [
            'writer_id' => $writerId,
            'event_code' => $eventCode,
            'target_table' => $targetTable,
            'operation' => $operation,
            'row_delta' => $rowDelta,
            'correlation_id' => RequestContext::id(),
            'runtime_policy_class' => $runtimePolicyClass,
        ]);
    }
}
