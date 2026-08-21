<?php

declare(strict_types=1);

/** Relatorio agregado e estritamente read-only para a carga editorial futura. */
final class PublicSimulationReadinessReporter
{
    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed> */
    public function generate(): array
    {
        return [
            'generatedAt' => (new DateTimeImmutable('now'))->format(DATE_ATOM),
            'states' => $this->states(),
            'integrity' => $this->integrity(),
            'duplicateSlugs' => $this->duplicates(),
            'notes' => ['report_only' => true, 'attempts_are_excluded' => true, 'temporary_dataset_is_not_a_quality_gate' => true],
        ];
    }

    /** @return list<array<string,mixed>> */
    private function states(): array
    {
        return $this->db->query("SELECT publication_status, visibility_status, availability_status, COUNT(*) total
            FROM public_simulations GROUP BY publication_status, visibility_status, availability_status
            ORDER BY publication_status, visibility_status, availability_status")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @return array<string,int> */
    private function integrity(): array
    {
        $row = $this->db->query("SELECT
            COUNT(*) total,
            SUM(CASE WHEN BINARY s.slug NOT REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' OR CHAR_LENGTH(s.slug)>190 THEN 1 ELSE 0 END) invalid_slug,
            SUM(CASE WHEN TRIM(s.title)='' THEN 1 ELSE 0 END) missing_title,
            SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM public_simulation_questions sq WHERE sq.simulation_id=s.id) THEN 1 ELSE 0 END) zero_questions,
            SUM(CASE WHEN EXISTS (SELECT 1 FROM public_simulation_questions sq LEFT JOIN questions q ON q.id=sq.question_id WHERE sq.simulation_id=s.id AND q.id IS NULL) THEN 1 ELSE 0 END) broken_question_relations,
            SUM(CASE WHEN EXISTS (SELECT 1 FROM public_simulation_filters sf LEFT JOIN filters f ON f.id=sf.filter_id WHERE sf.simulation_id=s.id AND f.id IS NULL) THEN 1 ELSE 0 END) orphan_filter_relations
            FROM public_simulations s")->fetch(PDO::FETCH_ASSOC) ?: [];
        return array_map('intval', $row);
    }

    /** @return list<array{slug:string,total:int}> */
    private function duplicates(): array
    {
        $rows = $this->db->query("SELECT slug, COUNT(*) total FROM public_simulations
            GROUP BY slug HAVING COUNT(*)>1 ORDER BY total DESC,slug LIMIT 100")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn (array $row): array => ['slug' => (string) $row['slug'], 'total' => (int) $row['total']], $rows);
    }
}
