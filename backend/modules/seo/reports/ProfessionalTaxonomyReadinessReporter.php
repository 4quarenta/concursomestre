<?php

declare(strict_types=1);

/** Relatorio agregado e somente leitura para validar o dataset real de Carreiras e Cargos. */
final class ProfessionalTaxonomyReadinessReporter
{
    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed> */
    public function generate(): array
    {
        return [
            'generatedAt' => (new DateTimeImmutable('now'))->format(DATE_ATOM),
            'entities' => $this->entityCounts(),
            'relations' => $this->relationCounts(),
            'duplicateCanonicalSlugs' => $this->duplicateCanonicalSlugs(),
            'duplicateNames' => $this->duplicateNames(),
            'notes' => [
                'report_only' => true,
                'volume_is_not_an_instance_readiness_gate' => true,
                'dataset_must_be_revalidated_after_the_final_import' => true,
            ],
        ];
    }

    /** @return list<array<string,mixed>> */
    private function entityCounts(): array
    {
        $sql = "SELECT type,
                    COUNT(*) total,
                    SUM(CASE WHEN COALESCE(taxonomy_level,'') IN ('pending','internal','technical') THEN 1 ELSE 0 END) publication_blocked,
                    SUM(CASE WHEN TRIM(name)='' THEN 1 ELSE 0 END) missing_name,
                    SUM(CASE WHEN BINARY slug NOT REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' OR CHAR_LENGTH(slug)>190 THEN 1 ELSE 0 END) invalid_slug,
                    SUM(CASE WHEN LOWER(TRIM(name)) IN ('outros','outras','diversos','diversas','geral','nao informado','não informado','sem classificacao','sem classificação','a definir','cargo nao identificado','cargo não identificado') THEN 1 ELSE 0 END) placeholder
                FROM filters WHERE type IN ('carreira','cargo') GROUP BY type ORDER BY type";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @return array<string,int> */
    private function relationCounts(): array
    {
        $sql = "SELECT
                    COUNT(*) total,
                    SUM(CASE WHEN cargo.id IS NULL OR career.id IS NULL THEN 1 ELSE 0 END) orphan,
                    SUM(CASE WHEN (cargo.id IS NOT NULL AND cargo.type<>'cargo') OR (career.id IS NOT NULL AND career.type<>'carreira') THEN 1 ELSE 0 END) wrong_type,
                    SUM(CASE WHEN COALESCE(cargo.taxonomy_level,'') IN ('pending','internal','technical') OR COALESCE(career.taxonomy_level,'') IN ('pending','internal','technical') THEN 1 ELSE 0 END) nonpublic
                FROM filter_relationships r
                LEFT JOIN filters cargo ON cargo.id=r.source_filter_id
                LEFT JOIN filters career ON career.id=r.target_filter_id
                WHERE r.relation_type='cargo_career'";
        $row = $this->db->query($sql)->fetch(PDO::FETCH_ASSOC) ?: [];
        return array_map('intval', $row);
    }

    /** @return list<array{type:string,slug:string,total:int}> */
    private function duplicateCanonicalSlugs(): array
    {
        $stmt = $this->db->query("SELECT type,slug,COUNT(*) total FROM filters
            WHERE type IN ('carreira','cargo') AND TRIM(slug)<>''
            GROUP BY type,slug HAVING COUNT(*)>1 ORDER BY total DESC,type,slug LIMIT 100");
        return array_map(static fn (array $row): array => [
            'type' => (string) $row['type'], 'slug' => (string) $row['slug'], 'total' => (int) $row['total'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    /** @return list<array{type:string,name:string,total:int}> */
    private function duplicateNames(): array
    {
        $stmt = $this->db->query("SELECT type,name,COUNT(*) total FROM filters
            WHERE type IN ('carreira','cargo') AND TRIM(name)<>''
            GROUP BY type,name HAVING COUNT(*)>1 ORDER BY total DESC,type,name LIMIT 100");
        return array_map(static fn (array $row): array => [
            'type' => (string) $row['type'], 'name' => (string) $row['name'], 'total' => (int) $row['total'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }
}
