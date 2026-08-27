<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

require_once __DIR__ . '/DatasetResetPolicyV2.php';
require_once __DIR__ . '/DatasetResetStateValidator.php';

final class PostResetResidueReporter
{
    public function __construct(private readonly PDO $db)
    {
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    /**
     * @param array<string, array{rows: int, digest: string}> $beforePreserveSnapshots
     * @param array<string, array{rows: int, digest: string}> $afterPreserveSnapshots
     * @return array<string, mixed>
     */
    public function evaluate(array $beforePreserveSnapshots, array $afterPreserveSnapshots): array
    {
        return $this->evaluateResetCompletion($beforePreserveSnapshots, $afterPreserveSnapshots);
    }

    /**
     * Gate autoritativo executado ainda com writers congelados.
     *
     * @param array<string, array{rows: int, digest: string}> $beforePreserveSnapshots
     * @param array<string, array{rows: int, digest: string}> $afterPreserveSnapshots
     * @return array<string, mixed>
     */
    public function evaluateResetCompletion(array $beforePreserveSnapshots, array $afterPreserveSnapshots): array
    {
        $result = DatasetResetStateValidator::evaluateResetCompletion(
            $this->tableCounts(),
            $beforePreserveSnapshots,
            $afterPreserveSnapshots
        );

        return [
            ...$result,
            'unexpectedResidue' => array_merge($result['strictResidue'], $result['runtimeResidue']),
            'expectedEmptyTables' => count(DatasetResetPolicyV2::resetTables()),
        ];
    }

    /**
     * Gate posterior ao resume. Tabelas estritas continuam vazias e cada row
     * recreavel precisa de atribuicao a writer/evento allowlisted.
     *
     * @param array<string, array{rows: int, digest: string}> $beforePreserveSnapshots
     * @param array<string, array{rows: int, digest: string}> $afterPreserveSnapshots
     * @param array<string, list<array{writerId: string, event: string, attributedRows: int}>> $runtimeEvidence
     * @return array<string, mixed>
     */
    public function evaluatePostResumeSteadyState(
        array $beforePreserveSnapshots,
        array $afterPreserveSnapshots,
        array $runtimeEvidence
    ): array {
        return DatasetResetStateValidator::evaluatePostResumeSteadyState(
            $this->tableCounts(),
            $beforePreserveSnapshots,
            $afterPreserveSnapshots,
            $runtimeEvidence
        );
    }

    /** @return array<string, int> */
    private function tableCounts(): array
    {
        $counts = [];
        foreach (DatasetResetPolicyV2::knownTables() as $table) {
            $counts[$table] = (int) $this->db->query(
                'SELECT COUNT(*) FROM ' . $this->quoteIdentifier($table)
            )->fetchColumn();
        }
        ksort($counts);
        return $counts;
    }

    private function quoteIdentifier(string $identifier): string
    {
        if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
            throw new InvalidArgumentException('Invalid SQL identifier.');
        }
        return '`' . $identifier . '`';
    }
}
