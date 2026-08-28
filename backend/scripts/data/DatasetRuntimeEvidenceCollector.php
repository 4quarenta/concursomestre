<?php

declare(strict_types=1);

require_once __DIR__ . '/DatasetResetPolicyV2.php';

final class DatasetRuntimeEvidenceCollector
{
    /**
     * @param iterable<string> $lines
     * @return array{records: list<array<string, mixed>>, invalidRecords: int}
     */
    public static function collect(iterable $lines): array
    {
        $records = [];
        $invalidRecords = 0;

        foreach ($lines as $line) {
            $jsonOffset = strpos($line, '{');
            if ($jsonOffset === false) {
                continue;
            }
            $payload = json_decode(substr($line, $jsonOffset), true);
            if (!is_array($payload) || ($payload['event'] ?? null) !== 'runtime_mutation') {
                continue;
            }

            $context = is_array($payload['context'] ?? null) ? $payload['context'] : [];
            $record = [
                'timestamp' => trim((string) ($payload['timestamp'] ?? '')),
                'correlationId' => trim((string) ($context['correlation_id'] ?? ($payload['request_id'] ?? ''))),
                'writerId' => trim((string) ($context['writer_id'] ?? '')),
                'event' => trim((string) ($context['event_code'] ?? '')),
                'targetTable' => trim((string) ($context['target_table'] ?? '')),
                'operation' => strtoupper(trim((string) ($context['operation'] ?? ''))),
                'rowDelta' => (int) ($context['row_delta'] ?? 0),
                'runtimePolicyClass' => trim((string) ($context['runtime_policy_class'] ?? '')),
            ];

            if (!self::isStructurallyValid($record)) {
                $invalidRecords++;
                continue;
            }
            $record['allowlisted'] = DatasetResetPolicyV2::isRuntimeEvidenceAllowed(
                $record['targetTable'],
                $record['writerId'],
                $record['event']
            );
            $records[] = $record;
        }

        return ['records' => $records, 'invalidRecords' => $invalidRecords];
    }

    /**
     * @param list<array<string, mixed>> $records
     * @return array<string, list<array{writerId: string, event: string, attributedRows: int}>>
     */
    public static function validatorEvidence(array $records): array
    {
        $grouped = [];
        foreach ($records as $record) {
            $rowDelta = (int) ($record['rowDelta'] ?? 0);
            if ($rowDelta === 0) {
                continue;
            }
            $table = (string) ($record['targetTable'] ?? '');
            $key = implode('|', [$table, (string) ($record['writerId'] ?? ''), (string) ($record['event'] ?? '')]);
            $grouped[$key] ??= [
                'table' => $table,
                'writerId' => (string) ($record['writerId'] ?? ''),
                'event' => (string) ($record['event'] ?? ''),
                'attributedRows' => 0,
            ];
            $grouped[$key]['attributedRows'] += $rowDelta;
        }

        $evidence = [];
        foreach ($grouped as $entry) {
            if ($entry['attributedRows'] === 0) {
                continue;
            }
            $table = $entry['table'];
            unset($entry['table']);
            $evidence[$table][] = $entry;
        }
        ksort($evidence);
        return $evidence;
    }

    /** @param array<string, mixed> $record */
    private static function isStructurallyValid(array $record): bool
    {
        return preg_match('/^[a-z][a-z0-9_]{1,63}$/', (string) $record['targetTable']) === 1
            && preg_match('/^[a-z][a-z0-9_.:-]{1,119}$/', (string) $record['writerId']) === 1
            && preg_match('/^[a-z][a-z0-9_.:-]{1,119}$/', (string) $record['event']) === 1
            && in_array((string) $record['operation'], ['INSERT', 'UPDATE', 'UPSERT', 'DELETE'], true)
            && abs((int) $record['rowDelta']) <= 1_000_000
            && (string) $record['runtimePolicyClass'] === DatasetResetPolicyV2::CLASS_RESETTABLE_RECREATABLE_RUNTIME
            && (string) $record['timestamp'] !== ''
            && (string) $record['correlationId'] !== '';
    }
}
