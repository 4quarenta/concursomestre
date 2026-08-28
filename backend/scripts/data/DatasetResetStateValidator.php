<?php

declare(strict_types=1);

require_once __DIR__ . '/DatasetResetPolicyV2.php';

final class DatasetResetStateValidator
{
    /**
     * @param array<string, int> $tableCounts
     * @param array<string, array{rows: int, digest: string}> $beforePreserveSnapshots
     * @param array<string, array{rows: int, digest: string}> $afterPreserveSnapshots
     * @return array<string, mixed>
     */
    public static function evaluateResetCompletion(
        array $tableCounts,
        array $beforePreserveSnapshots,
        array $afterPreserveSnapshots
    ): array {
        $blockers = self::classificationBlockers($tableCounts);
        $preserveMismatch = self::preserveMismatch($beforePreserveSnapshots, $afterPreserveSnapshots);
        $strictResidue = self::positiveCounts($tableCounts, DatasetResetPolicyV2::strictResetTables());
        $runtimeResidue = self::positiveCounts($tableCounts, DatasetResetPolicyV2::runtimeRecreatableTables());

        if ($preserveMismatch !== []) {
            $blockers[] = 'PRESERVE_SNAPSHOT_MISMATCH';
        }
        if ($strictResidue !== []) {
            $blockers[] = 'RESET_COMPLETION_STRICT_RESIDUE';
        }
        if ($runtimeResidue !== []) {
            $blockers[] = 'RESET_COMPLETION_RUNTIME_RESIDUE';
        }

        $blockers = self::normalizeBlockers($blockers);

        return [
            'gate' => 'RESET_COMPLETION_GATE',
            'ok' => $blockers === [],
            'blockers' => $blockers,
            'preserveMismatch' => $preserveMismatch,
            'strictResidue' => $strictResidue,
            'runtimeResidue' => $runtimeResidue,
            'expectedResettableTables' => count(DatasetResetPolicyV2::resetTables()),
            'expectedStrictTables' => count(DatasetResetPolicyV2::strictResetTables()),
            'expectedRuntimeRecreatableTables' => count(DatasetResetPolicyV2::runtimeRecreatableTables()),
        ];
    }

    /**
     * Evidence is aggregated by rows attributable to an allowlisted event.
     * Counts are intentionally not fixed: every current row must instead have
     * a known writer/event attribution.
     *
     * @param array<string, int> $tableCounts
     * @param array<string, array{rows: int, digest: string}> $beforePreserveSnapshots
     * @param array<string, array{rows: int, digest: string}> $afterPreserveSnapshots
     * @param array<string, list<array{writerId: string, event: string, attributedRows: int}>> $runtimeEvidence
     * @return array<string, mixed>
     */
    public static function evaluatePostResumeSteadyState(
        array $tableCounts,
        array $beforePreserveSnapshots,
        array $afterPreserveSnapshots,
        array $runtimeEvidence
    ): array {
        $blockers = self::classificationBlockers($tableCounts);
        $preserveMismatch = self::preserveMismatch($beforePreserveSnapshots, $afterPreserveSnapshots);
        $strictResidue = self::positiveCounts($tableCounts, DatasetResetPolicyV2::strictResetTables());
        $runtimeAssessment = [];

        if ($preserveMismatch !== []) {
            $blockers[] = 'PRESERVE_SNAPSHOT_MISMATCH';
        }
        if ($strictResidue !== []) {
            $blockers[] = 'POST_RESUME_STRICT_REPOPULATION';
        }

        foreach (array_keys($runtimeEvidence) as $evidenceTable) {
            if (!in_array($evidenceTable, DatasetResetPolicyV2::runtimeRecreatableTables(), true)) {
                $blockers[] = 'EVIDENCE_FOR_NON_RUNTIME_TABLE:' . $evidenceTable;
            }
        }

        foreach (DatasetResetPolicyV2::runtimeRecreatableTables() as $table) {
            $currentRows = max(0, (int) ($tableCounts[$table] ?? 0));
            $attributedRows = 0;
            $invalidEvidence = [];

            foreach ($runtimeEvidence[$table] ?? [] as $entry) {
                $writerId = trim((string) ($entry['writerId'] ?? ''));
                $event = trim((string) ($entry['event'] ?? ''));
                $rows = (int) ($entry['attributedRows'] ?? 0);

                if ($rows === 0 || !DatasetResetPolicyV2::isRuntimeEvidenceAllowed($table, $writerId, $event)) {
                    $invalidEvidence[] = [
                        'writerId' => $writerId,
                        'event' => $event,
                        'attributedRows' => $rows,
                    ];
                    continue;
                }

                $attributedRows += $rows;
            }

            if ($invalidEvidence !== []) {
                $blockers[] = 'UNAUTHORIZED_RUNTIME_EVIDENCE:' . $table;
            }
            if ($attributedRows !== $currentRows) {
                $blockers[] = 'UNATTRIBUTED_RUNTIME_ROWS:' . $table;
            }

            $runtimeAssessment[$table] = [
                'currentRows' => $currentRows,
                'attributedRows' => $attributedRows,
                'invalidEvidence' => $invalidEvidence,
                'ok' => $invalidEvidence === [] && $attributedRows === $currentRows,
            ];
        }

        $blockers = self::normalizeBlockers($blockers);

        return [
            'gate' => 'POST_RESUME_STEADY_STATE_GATE',
            'ok' => $blockers === [],
            'blockers' => $blockers,
            'preserveMismatch' => $preserveMismatch,
            'strictResidue' => $strictResidue,
            'runtimeAssessment' => $runtimeAssessment,
        ];
    }

    /** @param array<string, int> $tableCounts @return list<string> */
    private static function classificationBlockers(array $tableCounts): array
    {
        $blockers = [];
        foreach (DatasetResetPolicyV2::knownTables() as $table) {
            if (!array_key_exists($table, $tableCounts)) {
                $blockers[] = 'MISSING_TABLE_COUNT:' . $table;
            }
        }
        foreach (array_keys($tableCounts) as $table) {
            if (DatasetResetPolicyV2::classificationFor((string) $table) === null) {
                $blockers[] = 'UNKNOWN_TABLE_CLASSIFICATION:' . $table;
            }
        }
        return $blockers;
    }

    /**
     * @param array<string, array{rows: int, digest: string}> $before
     * @param array<string, array{rows: int, digest: string}> $after
     * @return list<string>
     */
    private static function preserveMismatch(array $before, array $after): array
    {
        $mismatch = [];
        foreach (DatasetResetPolicyV2::preserveTables() as $table) {
            if (($before[$table] ?? null) !== ($after[$table] ?? null)) {
                $mismatch[] = $table;
            }
        }
        sort($mismatch);
        return $mismatch;
    }

    /** @param array<string, int> $tableCounts @param list<string> $tables @return array<string, int> */
    private static function positiveCounts(array $tableCounts, array $tables): array
    {
        $positive = [];
        foreach ($tables as $table) {
            $count = max(0, (int) ($tableCounts[$table] ?? 0));
            if ($count > 0) {
                $positive[$table] = $count;
            }
        }
        ksort($positive);
        return $positive;
    }

    /** @param list<string> $blockers @return list<string> */
    private static function normalizeBlockers(array $blockers): array
    {
        $blockers = array_values(array_unique($blockers));
        sort($blockers);
        return $blockers;
    }
}
